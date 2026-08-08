import { describe, it, expect } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { AgentRepository, TopicRepository } from "../src/repositories/index.js";
import {
  AutonomousLifecycle,
  NoopAgentMemory,
  NoopContentGenerator,
  NoopEditorialEngine,
  SqliteAgentMemory,
  PublishingPolicy,
} from "../src/agent/index.js";
import { PostRepository } from "../src/repositories/index.js";
import type { TopicDiscovery } from "../src/agent/index.js";
import type { Agent, TopicCandidate } from "../src/models/index.js";
import { FakeClock } from "./fakeClock.js";

function makeAgent(repo: AgentRepository, id: string): Agent {
  const agent: Agent = {
    id,
    persona: { name: "Ada", domain: "AI Security" },
    status: "active",
    config: {},
    createdAt: "2026-08-08T00:00:00.000Z",
  };
  repo.create(agent);
  return agent;
}

function candidate(over: Partial<TopicCandidate> = {}): TopicCandidate {
  return {
    title: "A live topic",
    summary: "summary",
    sourceUrl: "https://example.com/a",
    sourceName: "Example Blog",
    discoveredAt: "2026-08-08T05:00:00.000Z",
    ...over,
  };
}

class StubDiscovery implements TopicDiscovery {
  constructor(private readonly candidates: TopicCandidate[]) {}
  async discover(_agentId: string): Promise<TopicCandidate[]> {
    return this.candidates;
  }
}

function lifecycleSetup(candidates: TopicCandidate[]) {
  const db = openDatabase({ databasePath: ":memory:" });
  const agents = new AgentRepository(db);
  const topics = new TopicRepository(db);
  const posts = new PostRepository(db);
  const clock = new FakeClock();
  const lifecycle = new AutonomousLifecycle(
    new StubDiscovery(candidates),
    new NoopEditorialEngine(),
    new NoopContentGenerator(),
    new SqliteAgentMemory(posts),
    new PublishingPolicy(posts, clock),
    clock,
    topics,
    posts,
  );
  return { db, agents, topics, posts, lifecycle };
}

describe("AutonomousLifecycle + discovery persistence", () => {
  it("persists discovered candidates as `discovered` initially and updates decision after editorial", async () => {
    const { db, agents, topics, lifecycle } = lifecycleSetup([
      candidate({ sourceUrl: "https://example.com/1" }),
      candidate({ sourceUrl: "https://example.com/2" }),
    ]);
    const agent = makeAgent(agents, "a1");

    const result = await lifecycle.tick(agent);

    // Editorial stub rejects everything: decision is reject.
    expect(result.decision).toBe("reject");
    expect(result.considered).toHaveLength(2);

    const stored = topics.listByAgent("a1");
    expect(stored).toHaveLength(2);
    for (const t of stored) {
      expect(t.decision).toBe("reject");
      expect(t.decidedAt).toBeDefined();
      expect(t.sourceName).toBe("Example Blog");
    }
    db.close();
  });

  it("does not re-persist a repeated source item across cycles", async () => {
    const { db, agents, topics, lifecycle } = lifecycleSetup([candidate()]);
    const agent = makeAgent(agents, "a1");

    await lifecycle.tick(agent); // first cycle
    await lifecycle.tick(agent); // same candidate again

    expect(topics.listByAgent("a1")).toHaveLength(1); // de-duped, not duplicated
    db.close();
  });

  it("preserves the source publication timestamp on the discovered record", async () => {
    const { db, agents, topics, lifecycle } = lifecycleSetup([
      candidate({ publishedAt: "2026-08-07T09:00:00.000Z" }),
    ]);
    const agent = makeAgent(agents, "a1");

    await lifecycle.tick(agent);
    expect(topics.listByAgent("a1")[0]!.publishedAt).toBe("2026-08-07T09:00:00.000Z");
    db.close();
  });
});