import type { Agent, TopicCandidate } from "../models/index.js";
import type { EditorialVerdict } from "../agent/editorial.js";
import type { AppConfig } from "../config/env.js";
import type { ContentGenerator, DraftContent } from "./generator.js";
import {
  buildGenerationPrompt,
  validateAndSanitizeOutput,
} from "./generatorImpl.js";

/**
 * Real LLM Content Generator supporting Gemini, OpenAI, and mock providers.
 * Handles timeouts, rate limits, network errors, and output validation safely.
 */
export class LlmContentGenerator implements ContentGenerator {
  constructor(private readonly config: AppConfig) {}

  async generate(
    agent: Agent,
    candidate: TopicCandidate,
    verdict: EditorialVerdict,
    allVerdicts: EditorialVerdict[] = [],
  ): Promise<DraftContent> {
    const runnerUps = allVerdicts.filter(
      (v) => v.candidate.sourceUrl !== candidate.sourceUrl && v.decision === "reject",
    );

    const { systemInstruction, userPrompt } = buildGenerationPrompt({
      agent,
      candidate,
      verdict,
      runnerUps,
    });

    const rawOutput = await this.callLlmProvider(systemInstruction, userPrompt);
    return validateAndSanitizeOutput(rawOutput, candidate.sourceUrl);
  }

  private async callLlmProvider(systemInstruction: string, userPrompt: string): Promise<unknown> {
    const provider = this.config.llmProvider.toLowerCase();
    const apiKey = this.config.llmApiKey;
    const model = this.config.llmModel;
    const timeoutMs = this.config.llmTimeoutMs;

    if (provider === "mock" || !apiKey) {
      // Mock / fallback generation for testing or unconfigured environments
      return {
        text: `Analysis on recent developments in ${model}: Evaluating technical substance and architectural implications.`,
        rationale: `Selected based on high technical relevance and fresh source grounding. Chosen over alternative candidates due to superior evidence and direct domain fit.`,
      };
    }

    if (provider === "gemini") {
      return this.callGemini(apiKey, model, systemInstruction, userPrompt, timeoutMs);
    } else if (provider === "openai") {
      return this.callOpenAi(apiKey, model, systemInstruction, userPrompt, timeoutMs);
    } else {
      throw new Error(`Unsupported LLM provider: '${provider}'`);
    }
  }

  private async callGemini(
    apiKey: string,
    model: string,
    systemInstruction: string,
    userPrompt: string,
    timeoutMs: number,
  ): Promise<unknown> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new Error("LLM provider rate limit exceeded (429)");
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`LLM provider HTTP error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as any;
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        throw new Error("Invalid or empty response structure from Gemini API");
      }

      return JSON.parse(candidateText);
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`LLM generation timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async callOpenAi(
    apiKey: string,
    model: string,
    systemInstruction: string,
    userPrompt: string,
    timeoutMs: number,
  ): Promise<unknown> {
    const url = "https://api.openai.com/v1/chat/completions";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new Error("LLM provider rate limit exceeded (429)");
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`LLM provider HTTP error ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Invalid or empty response structure from OpenAI API");
      }

      return JSON.parse(content);
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`LLM generation timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
