import type { Agent } from "../models/index.js";
import type { SchedulingState } from "../models/index.js";
import type { SchedulingRepository } from "../repositories/index.js";
import type { Clock } from "../util/clock.js";
import type { AgentLifecycle, Scheduler } from "./index.js";

/**
 * A simple, reliable per-agent scheduler backed by persisted SQLite state.
 *
 * Design:
 * - Each agent has a persisted `SchedulingState` (last run, next run, active).
 * - `registerAgent` is idempotent: it never creates a duplicate in-memory loop,
 *   and on recovery it preserves the persisted `nextRunAt` rather than resetting it.
 * - `start()` runs a single polling loop that calls `checkDue()` on a cadence.
 * - `checkDue()` is public so tests can drive it deterministically with a fake
 *   clock (no real-time delays).
 * - A failed cycle is caught and isolated: the scheduler stays alive and still
 *   schedules the next run.
 * - `stop()` clears the timer and marks the scheduler stopped.
 */
export class AutonomousScheduler implements Scheduler {
  private readonly agents = new Map<string, Agent>();
  private timer: NodeJS.Timeout | null = null;
  private stopped = true;
  private readonly pollIntervalMs: number;

  constructor(
    private readonly lifecycle: AgentLifecycle,
    private readonly scheduling: SchedulingRepository,
    private readonly clock: Clock,
    private readonly intervalSeconds: number,
    private readonly log: (message: string) => void = () => {},
    pollIntervalMs = 1000,
  ) {
    this.pollIntervalMs = pollIntervalMs;
  }

  /** Register an agent for scheduling. Idempotent; preserves persisted next-run on recovery. */
  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      return; // already registered — no duplicate loop
    }

    const existing = this.scheduling.findById(agent.id);
    const now = this.clock.now().toISOString();

    if (existing) {
      // Recovery path: keep the persisted next-run (do not reset it).
      this.scheduling.updateRunState(agent.id, existing.lastRunAt, existing.nextRunAt, true, now);
      this.log(`[scheduler] recovered scheduling state for agent ${agent.id}`);
    } else {
      // First registration: schedule the first run one interval from now.
      const nextRunAt = this.addSeconds(now, this.intervalSeconds);
      this.scheduling.create({
        agentId: agent.id,
        lastRunAt: null,
        nextRunAt,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      this.log(`[scheduler] registered agent ${agent.id}; next run ${nextRunAt}`);
    }

    this.agents.set(agent.id, agent);
  }

  /** Unregister an agent and mark its scheduling inactive. */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.scheduling.deactivate(agentId, this.clock.now().toISOString());
    this.log(`[scheduler] unregistered agent ${agentId}`);
  }

  /**
   * Recover persisted scheduling state after a restart.
   *
   * Re-registers all active agents from the scheduling table so their
   * autonomous cycles resume. Persisted `nextRunAt` is preserved (not reset),
   * so a future next-run stays in the future and a past next-run becomes due
   * immediately on the next `checkDue()`.
   */
  recover(agents: Agent[]): void {
    const states = this.scheduling.listAll();
    const byId = new Map(agents.map((a) => [a.id, a]));
    for (const state of states) {
      if (!state.active) {
        continue;
      }
      const agent = byId.get(state.agentId);
      if (!agent) {
        continue; // agent record missing — skip
      }
      this.registerAgent(agent); // preserves persisted next-run
    }
    this.log(`[scheduler] recovered ${this.agents.size} agent(s) after restart`);
  }

  /** Start the polling loop. Safe to call once; subsequent calls are no-ops. */
  start(): void {
    if (!this.stopped) {
      return; // prevent duplicate scheduler loops
    }
    this.stopped = false;
    this.log("[scheduler] started");
    this.timer = setInterval(() => {
      void this.checkDue();
    }, this.pollIntervalMs);
    // Do not keep the process alive solely for the scheduler timer.
    this.timer.unref?.();
  }

  /** Stop the scheduler cleanly. */
  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.log("[scheduler] stopped");
  }

  /** Whether the scheduler is currently running. */
  isRunning(): boolean {
    return !this.stopped;
  }

  /** Number of registered agents. */
  registeredCount(): number {
    return this.agents.size;
  }

  /**
   * Run any due cycles for registered agents.
   *
   * Public so tests can drive it deterministically. A cycle failure is caught
   * and isolated: the agent's next run is still scheduled and the scheduler
   * remains alive.
   */
  async checkDue(): Promise<void> {
    const now = this.clock.now();
    const nowIso = now.toISOString();

    for (const agent of this.agents.values()) {
      const state = this.scheduling.findById(agent.id);
      if (!state || !state.active) {
        continue;
      }
      if (nowIso < state.nextRunAt) {
        continue; // not due yet
      }

      await this.runCycle(agent, state, nowIso);
    }
  }

  /** Execute one cycle for an agent and persist the resulting run state. */
  private async runCycle(agent: Agent, state: SchedulingState, nowIso: string): Promise<void> {
    this.log(`[scheduler] cycle started for agent ${agent.id}`);
    try {
      await this.lifecycle.tick(agent);
      this.log(`[scheduler] cycle completed for agent ${agent.id}`);
    } catch (err) {
      // Failure isolation: log and continue scheduling. Do not kill the scheduler.
      this.log(`[scheduler] cycle failed for agent ${agent.id}: ${String(err)}`);
    }

    // Always schedule the next run, regardless of success or failure.
    const nextRunAt = this.addSeconds(nowIso, this.intervalSeconds);
    this.scheduling.updateRunState(agent.id, nowIso, nextRunAt, true, nowIso);
    this.log(`[scheduler] next run for agent ${agent.id} at ${nextRunAt}`);
  }

  private addSeconds(iso: string, seconds: number): string {
    return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
  }
}