import type { DatabaseSync } from "node:sqlite";
import type { Agent } from "../models/index.js";

interface AgentRow {
  id: string;
  persona_name: string;
  persona_domain: string;
  status: Agent["status"];
  config: string;
  created_at: string;
}

function rowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    persona: { name: row.persona_name, domain: row.persona_domain },
    status: row.status,
    config: JSON.parse(row.config) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export class AgentRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** Insert a new agent record. */
  create(agent: Agent): void {
    this.db
      .prepare(
        `INSERT INTO agents (id, persona_name, persona_domain, status, config, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        agent.id,
        agent.persona.name,
        agent.persona.domain,
        agent.status,
        JSON.stringify(agent.config),
        agent.createdAt,
      );
  }

  /** Fetch an agent by ID, or undefined if not found. */
  findById(id: string): Agent | undefined {
    const row = this.db
      .prepare(`SELECT * FROM agents WHERE id = ?`)
      .get(id) as AgentRow | undefined;
    return row ? rowToAgent(row) : undefined;
  }

  /** Update the lifecycle status of an agent. */
  updateStatus(id: string, status: Agent["status"]): void {
    this.db.prepare(`UPDATE agents SET status = ? WHERE id = ?`).run(status, id);
  }
}