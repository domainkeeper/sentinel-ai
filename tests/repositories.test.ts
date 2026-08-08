import { describe, it, expect } from "vitest";
import { buildTestApp } from "./helpers.js";
import type { Agent, Post, TopicRecord } from "../src/models/index.js";

describe("AgentRepository", () => {
  it("persists and retrieves an agent", () => {
    const { agents } = buildTestApp();
    const agent: Agent = {
      id: "a1",
      persona: { name: "Ada", domain: "AI Security" },
      status: "active",
      config: { theme: "security" },
      createdAt: "2026-08-07T10:00:00.000Z",
    };
    agents.create(agent);

    const found = agents.findById("a1");
    expect(found).toEqual(agent);
  });

  it("returns undefined for an unknown agent", () => {
    const { agents } = buildTestApp();
    expect(agents.findById("nope")).toBeUndefined();
  });

  it("updates agent status", () => {
    const { agents } = buildTestApp();
    agents.create({
      id: "a1",
      persona: { name: "Ada", domain: "AI Security" },
      status: "active",
      config: {},
      createdAt: "2026-08-07T10:00:00.000Z",
    });
    agents.updateStatus("a1", "paused");
    expect(agents.findById("a1")?.status).toBe("paused");
  });
});

describe("PostRepository", () => {
  it("lists posts newest first", () => {
    const { posts, agents } = buildTestApp();
    // Must create the owning agent first to satisfy the FK constraint.
    agents.create({
      id: "a1",
      persona: { name: "Ada", domain: "AI Security" },
      status: "active",
      config: {},
      createdAt: "2026-08-07T09:00:00.000Z",
    });
    const older: Post = {
      id: "p1",
      agentId: "a1",
      createdAt: "2026-08-07T10:00:00.000Z",
      text: "older",
      rationale: "r1",
      sources: ["https://a"],
    };
    const newer: Post = {
      id: "p2",
      agentId: "a1",
      createdAt: "2026-08-07T11:00:00.000Z",
      text: "newer",
      rationale: "r2",
      sources: ["https://b"],
    };
    posts.create(older);
    posts.create(newer);

    const list = posts.listByAgent("a1");
    expect(list.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(posts.countByAgent("a1")).toBe(2);
  });

  it("returns empty list for an agent with no posts", () => {
    const { posts } = buildTestApp();
    expect(posts.listByAgent("a1")).toEqual([]);
  });
});

describe("TopicRepository", () => {
  it("persists and lists topic decisions", () => {
    const { topics, agents } = buildTestApp();
    // Must create the owning agent first to satisfy the FK constraint.
    agents.create({
      id: "a1",
      persona: { name: "Ada", domain: "AI Security" },
      status: "active",
      config: {},
      createdAt: "2026-08-07T09:00:00.000Z",
    });
    const record: TopicRecord = {
      id: "t1",
      agentId: "a1",
      title: "A new jailbreak technique",
      summary: "Researchers found a new jailbreak.",
      sourceUrl: "https://example.com/post",
      sourceName: "Example Blog",
      discoveredAt: "2026-08-07T10:00:00.000Z",
      decidedAt: "2026-08-07T10:05:00.000Z",
      decision: "reject",
      reasoning: { novelty: 0.1, reason: "near-duplicate of t0" },
    };
    topics.create(record);

    const list = topics.listByAgent("a1");
    expect(list).toHaveLength(1);
    expect(list[0]!.decision).toBe("reject");
    expect(list[0]!.reasoning).toEqual({ novelty: 0.1, reason: "near-duplicate of t0" });
  });
});