import { describe, it, expect } from "vitest";
import { rmSync } from "node:fs";
import { openDatabase } from "../src/db/connection.js";
import { AgentRepository, SchedulingRepository } from "../src/repositories/index.js";
import type { Agent, SchedulingState } from "../src/models/index.js";

function makeState(agentId: string, nextRunAt: string): SchedulingState {
  return {
    agentId,
    lastRunAt: null,
    nextRunAt,
    active: true,
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
  };
}

/** Persist an agent so the scheduling FK constraint is satisfied. */
function persistAgent(agents: AgentRepository, id: string): void {
  const agent: Agent = {
    id,
    persona: { name: "Ada", domain: "AI Security" },
    status: "active",
    config: {},
    createdAt: "2026-08-08T00:00:00.000Z",
  };
  agents.create(agent);
}

describe("SchedulingRepository", () => {
  it("persists and retrieves scheduling state", () => {
    const db = openDatabase({ databasePath: ":memory:" });
    const agents = new AgentRepository(db);
    const repo = new SchedulingRepository(db);
    persistAgent(agents, "a1");
    repo.create(makeState("a1", "2026-08-08T01:00:00.000Z"));

    const state = repo.findById("a1");
    expect(state).toBeDefined();
    expect(state!.agentId).toBe("a1");
    expect(state!.nextRunAt).toBe("2026-08-08T01:00:00.000Z");
    expect(state!.active).toBe(true);
  });

  it("updates run state (last run + next run)", () => {
    const db = openDatabase({ databasePath: ":memory:" });
    const agents = new AgentRepository(db);
    const repo = new SchedulingRepository(db);
    persistAgent(agents, "a1");
    repo.create(makeState("a1", "2026-08-08T01:00:00.000Z"));

    repo.updateRunState("a1", "2026-08-08T01:00:00.000Z", "2026-08-08T02:00:00.000Z", true, "2026-08-08T01:00:00.000Z");

    const state = repo.findById("a1");
    expect(state!.lastRunAt).toBe("2026-08-08T01:00:00.000Z");
    expect(state!.nextRunAt).toBe("2026-08-08T02:00:00.000Z");
  });

  it("deactivates an agent's scheduling", () => {
    const db = openDatabase({ databasePath: ":memory:" });
    const agents = new AgentRepository(db);
    const repo = new SchedulingRepository(db);
    persistAgent(agents, "a1");
    repo.create(makeState("a1", "2026-08-08T01:00:00.000Z"));

    repo.deactivate("a1", "2026-08-08T00:30:00.000Z");
    expect(repo.findById("a1")!.active).toBe(false);
  });

  it("state survives reopening the database (file-backed)", () => {
    const path = "data/scheduling-test.db";
    // Clean up any prior test file.
    rmSync(path, { force: true });

    // First connection: create state.
    const db1 = openDatabase({ databasePath: path });
    const agents1 = new AgentRepository(db1);
    const repo1 = new SchedulingRepository(db1);
    persistAgent(agents1, "a1");
    repo1.create(makeState("a1", "2026-08-08T01:00:00.000Z"));
    db1.close();

    // Reopen: state must survive.
    const db2 = openDatabase({ databasePath: path });
    const repo2 = new SchedulingRepository(db2);
    const state = repo2.findById("a1");
    expect(state).toBeDefined();
    expect(state!.nextRunAt).toBe("2026-08-08T01:00:00.000Z");
    db2.close();

    rmSync(path, { force: true });
  });
});