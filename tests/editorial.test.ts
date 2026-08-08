import { describe, it, expect } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { AgentRepository } from "../src/repositories/agentRepository.js";
import { DeterministicEditorialEngine } from "../src/agent/editorial.js";
import { FakeClock } from "./fakeClock.js";
import type { Agent, TopicCandidate } from "../src/models/index.js";

describe("DeterministicEditorialEngine (Phase 2C)", () => {
  const clock = new FakeClock();
  const agent: Agent = {
    id: "agent-1",
    persona: { name: "Ada", domain: "AI Security" },
    status: "active",
    config: {},
    createdAt: "2026-08-08T00:00:00.000Z",
  };
  const engine = new DeterministicEditorialEngine(clock, { threshold: 60 });

  it("approves a strong topic matching persona and high quality", async () => {
    const candidate: TopicCandidate = {
      title: "Critical Vulnerability Discovered in Major LLM Agent Framework",
      summary:
        "A severe prompt injection and privilege escalation vulnerability was identified in leading multi-agent AI frameworks, allowing arbitrary remote code execution during automated tool calls.",
      sourceUrl: "https://arxiv.org/abs/2608.12345",
      sourceName: "arXiv",
      discoveredAt: "2026-08-08T10:00:00.000Z",
      publishedAt: "2026-08-08T09:30:00.000Z",
    };

    const verdicts = await engine.evaluate(agent, [candidate]);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]!.decision).toBe("publish");
    expect((verdicts[0]!.reasoning as any).totalScore).toBeGreaterThanOrEqual(60);
    expect((verdicts[0]!.reasoning as any).reasons).toBeInstanceOf(Array);
  });

  it("rejects a weak topic with low relevance and missing detail", async () => {
    const candidate: TopicCandidate = {
      title: "Local bakery opens new branch",
      summary: "Good cakes.",
      sourceUrl: "https://example.com/bakery",
      sourceName: "Local News",
      discoveredAt: "2026-08-08T10:00:00.000Z",
      publishedAt: "2026-08-08T09:30:00.000Z",
    };

    const verdicts = await engine.evaluate(agent, [candidate]);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]!.decision).toBe("reject");
    expect((verdicts[0]!.reasoning as any).totalScore).toBeLessThan(60);
  });

  it("handles stale / old topics properly with lower freshness score", async () => {
    const candidate: TopicCandidate = {
      title: "Old AI Model Security Paper from Last Year",
      summary: "Security vulnerabilities in legacy LLMs from 2025.",
      sourceUrl: "https://example.com/old",
      sourceName: "Blog",
      discoveredAt: "2026-08-08T10:00:00.000Z",
      publishedAt: "2026-07-01T00:00:00.000Z", // over a month ago
    };

    const verdicts = await engine.evaluate(agent, [candidate]);
    expect(verdicts).toHaveLength(1);
    const reasoning = verdicts[0]!.reasoning as any;
    expect(reasoning.dimensionScores.freshness).toBeLessThan(50);
  });
});
