/**
 * Persisted scheduling state for an agent.
 *
 * This is the durable record the scheduler uses to recover after a restart:
 * when the agent last ran, when it should run next, and its lifecycle status.
 */
export interface SchedulingState {
  /** Agent this scheduling state belongs to. */
  agentId: string;
  /** ISO 8601 UTC timestamp of the last completed cycle (or null if never ran). */
  lastRunAt: string | null;
  /** ISO 8601 UTC timestamp of the next scheduled run. */
  nextRunAt: string;
  /** Whether the agent is currently scheduled/active. */
  active: boolean;
  /** ISO 8601 UTC timestamp when this record was created. */
  createdAt: string;
  /** ISO 8601 UTC timestamp of the last update. */
  updatedAt: string;
}