import type { DatabaseSync } from "node:sqlite";

/**
 * Defines the Sentinel AI SQLite schema.
 *
 * Storage is structured but intentionally minimal: agents, posts, and topics.
 * Posts and topics are indexed by agent for fast feed reads.
 */
export function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id            TEXT PRIMARY KEY,
      persona_name  TEXT NOT NULL,
      persona_domain TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active',
      config        TEXT NOT NULL DEFAULT '{}',
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id         TEXT PRIMARY KEY,
      agent_id   TEXT NOT NULL,
      created_at TEXT NOT NULL,
      text       TEXT NOT NULL,
      rationale  TEXT NOT NULL,
      sources    TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_posts_agent_created
      ON posts (agent_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS topics (
      id           TEXT PRIMARY KEY,
      agent_id     TEXT NOT NULL,
      title        TEXT NOT NULL,
      summary      TEXT NOT NULL,
      source_url   TEXT NOT NULL,
      source_name  TEXT NOT NULL,
      discovered_at TEXT NOT NULL,
      decided_at   TEXT NOT NULL,
      decision     TEXT NOT NULL,
      reasoning    TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_topics_agent_created
      ON topics (agent_id, discovered_at DESC);

    CREATE TABLE IF NOT EXISTS scheduling (
      agent_id    TEXT PRIMARY KEY,
      last_run_at TEXT,
      next_run_at TEXT NOT NULL,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );
  `);
}
