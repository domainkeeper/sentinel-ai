import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { AgentRepository, SchedulingRepository } from "../src/repositories/index.js";
import { AutonomousScheduler } from "../src/agent/index.js";
import type { AgentLifecycle, TickResult } from "../src/agent/index.js";
import type { Agent } from "../src/models/index.js";
import { FakeClock } from "./fakeClock.js";

const INTERVAL = 3600; // seconds

function makeAgent(id: string): Agent {
  return {
    id,
    persona: { name: "Ada", domain: "AI Security" },
    status: "active",
    config: {},
    createdAt: "2026-08-08T00:00:00.000Z",
  };
}

/** A mock lifecycle that records ticks and can be configured to throw. */
class MockLifecycle implements AgentLifecycle {
  ticks: string[] = [];
  fail = false;

  async tick(agent: Agent): Promise<TickResult> {
    if (this.fail) {
      throw new Error("boom");
    }
    this.ticks.push(agent.id);
    return { agentId: agent.id, tickedAt: new Date().toISOString(), considered: [] };
  }
}

function setup() {
  const db = openDatabase({ databasePath: ":memory:" });
  const agents = new AgentRepository(db);
  const scheduling = new SchedulingRepository(db);
  const lifecycle = new MockLifecycle();
  const clock = new FakeClock();
  const logs: string[] = [];
  const scheduler = new AutonomousScheduler(
    lifecycle,
    scheduling,
    clock,
    INTERVAL,
    (m) => logs.push(m),
  );
  return { db, agents, scheduling, lifecycle, clock, scheduler, logs };
}

/** Persist an agent so the scheduling FK constraint is satisfied. */
function persistAgent(ctx: ReturnType<typeof setup>, id: string): Agent {
  const agent = makeAgent(id);
  ctx.agents.create(agent);
  return agent;
}

describe("AutonomousScheduler", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it("registers an agent and schedules its first run one interval ahead", () => {
    const agent = persistAgent(ctx, "a1");
    ctx.scheduler.registerAgent(agent);

    const state = ctx.scheduling.findById("a1");
    expect(state).toBeDefined();
    expect(state!.active).toBe(true);
    expect(state!.lastRunAt).toBeNull();
    expect(state!.nextRunAt).toBe("2026-08-08T01:00:00.000Z"); // +3600s
    expect(ctx.scheduler.registeredCount()).toBe(1);
  });

  it("does not run a cycle before the next run is due", async () => {
    const agent = persistAgent(ctx, "a1");
    ctx.scheduler.registerAgent(agent);

    await ctx.scheduler.checkDue(); // clock still at 00:00, next run 01:00
    expect(ctx.lifecycle.ticks).toHaveLength(0);
  });

  it("runs a due cycle and schedules the next run", async () => {
    const agent = persistAgent(ctx, "a1");
    ctx.scheduler.registerAgent(agent);

    ctx.clock.advanceSeconds(INTERVAL); // now 01:00, due
    await ctx.scheduler.checkDue();

    expect(ctx.lifecycle.ticks).toEqual(["a1"]);
    const state = ctx.scheduling.findById("a1");
    expect(state!.lastRunAt).toBe("2026-08-08T01:00:00.000Z");
    expect(state!.nextRunAt).toBe("2026-08-08T02:00:00.000Z");
  });

  it("prevents duplicate registration of the same agent", () => {
    const agent = persistAgent(ctx, "a1");
    ctx.scheduler.registerAgent(agent);
    ctx.scheduler.registerAgent(agent);
    expect(ctx.scheduler.registeredCount()).toBe(1);
  });

  it("start() is idempotent and does not create duplicate loops", () => {
    ctx.scheduler.start();
    ctx.scheduler.start();
    expect(ctx.scheduler.isRunning()).toBe(true);
    // Only one timer is created; stop() clears it cleanly.
    void ctx.scheduler.stop();
    expect(ctx.scheduler.isRunning()).toBe(false);
  });

  it("stop() stops the scheduler", async () => {
    ctx.scheduler.start();
    expect(ctx.scheduler.isRunning()).toBe(true);
    await ctx.scheduler.stop();
    expect(ctx.scheduler.isRunning()).toBe(false);
  });

  it("survives a cycle failure and still schedules the next run", async () => {
    const agent = persistAgent(ctx, "a1");
    ctx.scheduler.registerAgent(agent);
    ctx.scheduler.start();
    ctx.lifecycle.fail = true;

    ctx.clock.advanceSeconds(INTERVAL);
    await ctx.scheduler.checkDue();

    // Failure was isolated: scheduler still alive, next run scheduled.
    expect(ctx.scheduler.isRunning()).toBe(true);
    const state = ctx.scheduling.findById("a1");
    expect(state!.lastRunAt).toBe("2026-08-08T01:00:00.000Z");
    expect(state!.nextRunAt).toBe("2026-08-08T02:00:00.000Z");
    expect(ctx.logs.some((l) => l.includes("cycle failed"))).toBe(true);

    await ctx.scheduler.stop();
  });

  it("recovers persisted state after a restart, preserving future next-run", async () => {
    // First "process": register + run a cycle.
    const agent = persistAgent(ctx, "a1");
    ctx.scheduler.registerAgent(agent);
    ctx.clock.advanceSeconds(INTERVAL);
    await ctx.scheduler.checkDue();
    // nextRunAt is now 02:00.

    // Simulate restart: new scheduler over the same DB, clock reset to 00:30.
    const clock2 = new FakeClock("2026-08-08T00:30:00.000Z");
    const scheduler2 = new AutonomousScheduler(
      ctx.lifecycle,
      ctx.scheduling,
      clock2,
      INTERVAL,
    );
    scheduler2.recover([agent]);

    const state = ctx.scheduling.findById("a1");
    // Persisted next-run (02:00) is preserved, not reset to 01:30.
    expect(state!.nextRunAt).toBe("2026-08-08T02:00:00.000Z");
    expect(scheduler2.registeredCount()).toBe(1);
  });

  it("runs a past-due next-run immediately after recovery", async () => {
    const agent = persistAgent(ctx, "a1");
    ctx.scheduler.registerAgent(agent);
    ctx.clock.advanceSeconds(INTERVAL);
    await ctx.scheduler.checkDue();
    // nextRunAt is 02:00.

    // Restart with clock already past 02:00.
    const clock2 = new FakeClock("2026-08-08T03:00:00.000Z");
    const scheduler2 = new AutonomousScheduler(
      ctx.lifecycle,
      ctx.scheduling,
      clock2,
      INTERVAL,
    );
    scheduler2.recover([agent]);

    await scheduler2.checkDue();
    expect(ctx.lifecycle.ticks).toEqual(["a1", "a1"]); // ran again
  });

  it("unregisters an agent and deactivates its scheduling", () => {
    const agent = persistAgent(ctx, "a1");
    ctx.scheduler.registerAgent(agent);
    ctx.scheduler.unregisterAgent("a1");
    expect(ctx.scheduler.registeredCount()).toBe(0);
    expect(ctx.scheduling.findById("a1")!.active).toBe(false);
  });
});