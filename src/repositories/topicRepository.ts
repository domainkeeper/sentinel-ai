import type { DatabaseSync } from "node:sqlite";
import type { TopicRecord } from "../models/index.js";

interface TopicRow {
  id: string;
  agent_id: string;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  discovered_at: string;
  decided_at: string;
  decision: TopicRecord["decision"];
  reasoning: string;
}

function rowToTopic(row: TopicRow): TopicRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    discoveredAt: row.discovered_at,
    decidedAt: row.decided_at,
    decision: row.decision,
    reasoning: JSON.parse(row.reasoning) as Record<string, unknown>,
  };
}

export class TopicRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** Insert a topic decision record. */
  create(record: TopicRecord): void {
    this.db
      .prepare(
        `INSERT INTO topics
           (id, agent_id, title, summary, source_url, source_name,
            discovered_at, decided_at, decision, reasoning)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.agentId,
        record.title,
        record.summary,
        record.sourceUrl,
        record.sourceName,
        record.discoveredAt,
        record.decidedAt,
        record.decision,
        JSON.stringify(record.reasoning),
      );
  }

  /** List topic decisions for an agent, most recent first. */
  listByAgent(agentId: string): TopicRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM topics WHERE agent_id = ? ORDER BY decided_at DESC, id DESC`,
      )
      .all(agentId) as unknown as TopicRow[];
    return rows.map(rowToTopic);
  }
}