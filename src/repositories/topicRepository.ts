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
  source_published_at: string | null;
  decided_at: string | null;
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
    publishedAt: row.source_published_at ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decision: row.decision,
    reasoning: JSON.parse(row.reasoning) as Record<string, unknown>,
  };
}

export class TopicRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** Insert a topic record (typically a `discovered` candidate in Phase 2B). */
  create(record: TopicRecord): void {
    this.db
      .prepare(
        `INSERT INTO topics
           (id, agent_id, title, summary, source_url, source_name,
            discovered_at, source_published_at, decided_at, decision, reasoning)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.agentId,
        record.title,
        record.summary,
        record.sourceUrl,
        record.sourceName,
        record.discoveredAt,
        record.publishedAt ?? null,
        record.decidedAt ?? null,
        record.decision,
        JSON.stringify(record.reasoning),
      );
  }

  /** Whether an agent already has a topic with the given canonical source URL. */
  existsBySourceUrl(agentId: string, sourceUrl: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 AS found FROM topics
         WHERE agent_id = ? AND source_url = ?
         LIMIT 1`,
      )
      .get(agentId, sourceUrl) as { found: number } | undefined;
    return row !== undefined;
  }

  /** Update the decision, decided_at, and reasoning of an existing topic record by source URL. */
  updateDecision(agentId: string, sourceUrl: string, decision: TopicRecord["decision"], decidedAt: string, reasoning: Record<string, unknown>): void {
    this.db
      .prepare(
        `UPDATE topics
         SET decision = ?, decided_at = ?, reasoning = ?
         WHERE agent_id = ? AND source_url = ?`,
      )
      .run(decision, decidedAt, JSON.stringify(reasoning), agentId, sourceUrl);
  }

  /** List topic decisions for an agent, most recent first. */
  listByAgent(agentId: string): TopicRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM topics WHERE agent_id = ? ORDER BY discovered_at DESC, id DESC`,
      )
      .all(agentId) as unknown as TopicRow[];
    return rows.map(rowToTopic);
  }
}