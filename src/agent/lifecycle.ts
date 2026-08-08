import type { Agent, TopicCandidate, TopicDecision, TopicRecord } from "../models/index.js";

/**
 * Result of a single scheduler tick. Captures what was considered and what
 * was decided, forming the "considered and rejected" trail.
 */
export interface TickResult {
  agentId: string;
  /** ISO 8601 UTC timestamp the tick ran. */
  tickedAt: string;
  /** Candidate topics considered this tick. */
  considered: TopicCandidate[];
  /** The decision made (if any candidate qualified). */
  decision?: TopicDecision;
  /** The selected topic record, if published or explicitly rejected. */
  topic?: TopicRecord;
}

/**
 * The autonomous loop driver.
 *
 * Implementations run `tick` on a schedule for a given agent. The foundation
 * defines the interface; a real scheduler backed by persisted next-run state
 * is implemented in a later phase.
 */
export interface AgentLifecycle {
  /** Run one discovery → decision → generation → store cycle for an agent. */
  tick(agent: Agent): Promise<TickResult>;
}

/**
 * Scheduler interface. A concrete implementation registers an agent's
 * lifecycle and triggers ticks on a cadence, surviving restarts.
 */
export interface Scheduler {
  /** Register an agent to be ticked on a cadence. */
  registerAgent(agent: Agent): void;
  /** Unregister an agent. */
  unregisterAgent(agentId: string): void;
  /** Stop the scheduler cleanly. */
  stop(): Promise<void>;
}