import { describe, it, expect } from "vitest";
import { buildGenerationPrompt, validateAndSanitizeOutput } from "../src/agent/generatorImpl.js";
import { LlmContentGenerator } from "../src/agent/llmContentGenerator.js";
import type { Agent, TopicCandidate } from "../src/models/index.js";
import type { EditorialVerdict } from "../src/agent/editorial.js";

describe("Content Generator & Prompt Builder (Phase 2D)", () => {
  const agent: Agent = {
    id: "agent-1",
    persona: {
      name: "Ada",
      domain: "AI Security",
    },
    status: "active",
    config: {},
    createdAt: new Date().toISOString(),
  };

  const candidate: TopicCandidate = {
    title: "New Zero-Day Vulnerability in LLM Agent Frameworks",
    summary: "Researchers discover prompt injection bypass in multi-agent orchestration tools.",
    sourceUrl: "https://example.com/sec-advisory-1",
    sourceName: "Security Bulletin",
    discoveredAt: new Date().toISOString(),
  };

  const verdict: EditorialVerdict = {
    candidate,
    decision: "publish",
    score: 85,
    reasoning: {
      relevanceScore: 90,
      freshnessScore: 85,
      noveltyScore: 80,
      sourceQualityScore: 90,
      personaFitScore: 85,
      summary: "High relevance to AI security domain with verifiable source.",
    },
  };

  it("builds prompt with strict boundaries and untrusted source warning", () => {
    const { systemInstruction, userPrompt } = buildGenerationPrompt({
      agent,
      candidate,
      verdict,
      runnerUps: [],
    });

    expect(systemInstruction).toContain("Ada");
    expect(systemInstruction).toContain("AI Security");
    expect(systemInstruction).toContain("UNTRUSTED");
    expect(userPrompt).toContain("New Zero-Day Vulnerability");
    expect(userPrompt).toContain("https://example.com/sec-advisory-1");
  });

  it("validates and sanitizes valid LLM output", () => {
    const raw = {
      text: "A critical advisory highlights prompt injection vectors in agent frameworks.",
      rationale: "Selected because it directly impacts AI security practitioners with concrete evidence.",
    };

    const draft = validateAndSanitizeOutput(raw, candidate.sourceUrl);
    expect(draft.text).toBe(raw.text);
    expect(draft.rationale).toBe(raw.rationale);
    expect(draft.sources).toEqual([candidate.sourceUrl]);
  });

  it("rejects malformed or empty LLM output", () => {
    expect(() => validateAndSanitizeOutput(null, candidate.sourceUrl)).toThrow();
    expect(() => validateAndSanitizeOutput({ text: "", rationale: "valid" }, candidate.sourceUrl)).toThrow();
    expect(() => validateAndSanitizeOutput({ text: "valid", rationale: "" }, candidate.sourceUrl)).toThrow();
  });

  it("generates draft content successfully using mock provider", async () => {
    const generator = new LlmContentGenerator({
      env: "test",
      port: 3000,
      databasePath: ":memory:",
      logLevel: "info",
      schedulerIntervalSeconds: 3600,
      llmProvider: "mock",
      llmApiKey: "",
      llmModel: "mock-model",
      llmTimeoutMs: 5000,
      discoveryRssFeeds: [],
      discoveryHttpTimeoutMs: 15000,
    });

    const draft = await generator.generate(agent, candidate, verdict, []);
    expect(draft.text.length).toBeGreaterThan(0);
    expect(draft.rationale.length).toBeGreaterThan(0);
    expect(draft.sources).toEqual([candidate.sourceUrl]);
  });
});
