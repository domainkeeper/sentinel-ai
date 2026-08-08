import type { DatabaseSync } from "node:sqlite";
import type { SchedulingState } from "../models/index.js";

interface SchedulingRow {
  agent_id: string;
  last_run_at: string | null;
  next_run_at: string;
  active: number;
  created_at: string;
  updated_at: string;
}

function rowToScheduling(row: SchedulingRow): SchedulingState {
  return {
    agentId: row.agent_id,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SchedulingRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** Insert a new scheduling record for an agent. */
  create(state: SchedulingState): void {
    this.db
      .prepare(
        `INSERT INTO scheduling (agent_id, last_run_at, next_run_at, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        state.agentId,
        state.lastRunAt,
        state.nextRunAt,
        state.active ? 1 : 0,
        state.createdAt,
        state.updatedAt,
      );
  }

  /** Fetch scheduling state for an agent, or undefined if none exists. */
  findById(agentId: string): SchedulingState | undefined {
    const row = this.db
      .prepare(`SELECT * FROM scheduling WHERE agent_id = ?`)
      .get(agentId) as SchedulingRow | undefined;
    return row ? rowToScheduling(row) : undefined;
  }

  /** List all scheduling records. */
  listAll(): SchedulingState[] {
    const rows = this.db
      .prepare(`SELECT * FROM scheduling`)
      .all() as unknown as SchedulingRow[];
    return rows.map(rowToScheduling);
  }

  /** Update the run timestamps and active flag for an agent. */
  updateRunState(
    agentId: string,
    lastRunAt: string | null,
    nextRunAt: string,
    active: boolean,
    updatedAt: string,
  ): void {
    this.db
      .prepare(
        `UPDATE scheduling
         SET last_run_at = ?, next_run_at = ?, active = ?, updated_at = ?
         WHERE agent_id = ?`,
      )
      .run(lastRunAt, nextRunAt, active ? 1 : 0, updatedAt, agentId);
  }

  /** Mark an agent's scheduling as inactive (e.g. on unregister). */
  deactivate(agentId: string, updatedAt: string): void {
    this.db
      .prepare(`UPDATE scheduling SET active = 0, updated_at = ? WHERE agent_id = ?`)
      .run(updatedAt, agentId);
  }
}