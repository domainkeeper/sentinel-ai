import { describe, it, expect } from "vitest";
import { SqliteAgentMemory, normalizeText, tokenize, jaccardSimilarity } from "../src/agent/sqliteMemory.js";
import { PublishingPolicy } from "../src/agent/publishingPolicy.js";
import { AgentRepository } from "../src/repositories/agentRepository.js";
import { PostRepository } from "../src/repositories/postRepository.js";
import { DatabaseSync } from "node:sqlite";
import { createSchema } from "../src/db/schema.js";
import { FakeClock } from "./fakeClock.js";
import type { Post, TopicCandidate } from "../src/models/index.js";

describe("Phase 3A — Memory & Publication Policy", () => {
  function setupTestDb() {
    const db = new DatabaseSync(":memory:");
    createSchema(db);
    const agentRepo = new AgentRepository(db);
    const postRepo = new PostRepository(db);
    agentRepo.create({
      id: "agent-a",
      persona: { name: "Ada", domain: "AI Security" },
      status: "active",
      config: {},
      createdAt: new Date().toISOString(),
    });
    agentRepo.create({
      id: "agent-b",
      persona: { name: "Bob", domain: "Finance" },
      status: "active",
      config: {},
      createdAt: new Date().toISOString(),
    });
    return { db, agentRepo, postRepo };
  }

  it("normalizes text and computes token overlap correctly", () => {
    const norm = normalizeText("  Hello, World! AI Security Vulnerability  ");
    expect(norm).toBe("hello world ai security vulnerability");

    const tokens = tokenize("AI Security Vulnerability in LLM Agents");
    expect(tokens.has("security")).toBe(true);
    expect(tokens.has("in")).toBe(false); // <= 2 chars filtered

    const sim = jaccardSimilarity(new Set(["a", "b", "c"]), new Set(["b", "c", "d"]));
    expect(sim).toBe(2 / 4); // intersection 2, union 4
  });

  it("detects exact and near-duplicates with agent isolation", async () => {
    const { postRepo } = setupTestDb();
    const memory = new SqliteAgentMemory(postRepo, 0.7, 7);

    const post1: Post = {
      id: "p1",
      agentId: "agent-a",
      createdAt: new Date().toISOString(),
      text: "Critical zero-day vulnerability discovered in multi-agent orchestration frameworks.",
      rationale: "High relevance to AI security.",
      sources: ["https://example.com/advisory-1"],
    };
    postRepo.create(post1);

    const candidateSameUrl: TopicCandidate = {
      title: "Different Title",
      summary: "Different summary text.",
      sourceUrl: "https://example.com/advisory-1",
      sourceName: "Source",
      discoveredAt: new Date().toISOString(),
    };

    const candidateNearDup: TopicCandidate = {
      title: "Zero-Day Vulnerability Found in Multi-Agent Frameworks",
      summary: "Critical zero-day vulnerability discovered in multi-agent orchestration frameworks.",
      sourceUrl: "https://example.com/advisory-2",
      sourceName: "Source",
      discoveredAt: new Date().toISOString(),
    };

    const candidateNew: TopicCandidate = {
      title: "Completely unrelated breakthrough in quantum computing algorithms",
      summary: "Quantum researchers announce new benchmarking results.",
      sourceUrl: "https://example.com/quantum",
      sourceName: "Source",
      discoveredAt: new Date().toISOString(),
    };

    // Agent A detects duplicates
    expect(await memory.isDuplicate("agent-a", candidateSameUrl)).toBe(true);
    expect(await memory.isDuplicate("agent-a", candidateNearDup)).toBe(true);
    expect(await memory.isDuplicate("agent-a", candidateNew)).toBe(false);

    // Agent B has no memory, so Agent B does not see Agent A's duplicate
    expect(await memory.isDuplicate("agent-b", candidateSameUrl)).toBe(false);
  });

  it("enforces publishing cooldown and sliding window frequency limits", () => {
    const { postRepo } = setupTestDb();
    const clock = new FakeClock(new Date("2026-08-08T10:00:00Z"));
    const policy = new PublishingPolicy(postRepo, clock, {
      cooldownMinutes: 60,
      maxPostsPerWindow: 2,
      postWindowHours: 24,
    });

    // 1. First post should be allowed
    const decision1 = policy.evaluate("agent-a");
    expect(decision1.allowed).toBe(true);

    // Publish a post
    postRepo.create({
      id: "p1",
      agentId: "agent-a",
      createdAt: clock.now().toISOString(),
      text: "Test post 1",
      rationale: "Test rationale",
      sources: ["https://example.com/1"],
    });

    // 2. Immediate second post should be blocked by cooldown
    const decision2 = policy.evaluate("agent-a");
    expect(decision2.allowed).toBe(false);
    expect(decision2.reason).toContain("Cooldown active");

    // Advance clock past cooldown (e.g. 70 minutes)
    clock.advance(70 * 60 * 1000);

    // 3. Second post allowed after cooldown
    const decision3 = policy.evaluate("agent-a");
    expect(decision3.allowed).toBe(true);

    // Publish second post at the advanced time
    postRepo.create({
      id: "p2",
      agentId: "agent-a",
      createdAt: clock.now().toISOString(),
      text: "Test post 2",
      rationale: "Test rationale",
      sources: ["https://example.com/2"],
    });

    // Immediate third post should now hit cooldown again OR window limit if cooldown passed.
    // Since maxPostsPerWindow = 2 and 2 posts were just made within the window, cooldown blocks it first.
    // Let's test window limit by advancing clock past cooldown again (70 mins) but keeping within 24h window,
    // where maxPostsPerWindow (2) blocks it with "Publication window limit reached".
    clock.advance(70 * 60 * 1000);
    const decision4 = policy.evaluate("agent-a");
    expect(decision4.allowed).toBe(false);
    expect(decision4.reason).toContain("Publication window limit reached");
  });
});
