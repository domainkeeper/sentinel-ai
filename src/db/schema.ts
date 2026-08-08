import type { DatabaseSync } from "node:sqlite";

/**
 * Defines the Sentinel AI SQLite schema.
 *
 * Storage is structured but intentionally minimal: agents, posts, topics,
 * and scheduling. Posts and topics are indexed by agent for fast feed reads.
 *
 * The `topics` table is the rejection/decision trail. Since Phase 2B, a row
 * starts in the `discovered` state (a candidate found but not yet decided)
 * and is only later flipped to `publish` / `reject` by the editorial engine.
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
      source_published_at TEXT,
      decided_at   TEXT,
      decision     TEXT NOT NULL DEFAULT 'discovered',
      reasoning    TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_topics_agent_created
      ON topics (agent_id, discovered_at DESC);

    CREATE INDEX IF NOT EXISTS idx_topics_agent_source_url
      ON topics (agent_id, source_url);

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

  migrateTopicsColumns(db);
}

/**
 * Idempotently bring a *pre-existing* `topics` table up to the Phase 2B
 * shape by adding the `source_published_at` column if it is missing.
 *
 * Newer tables created by the DDL above already include the column, so this
 * is a safe no-op in that case. Missing-primary-column rebuilds (e.g. making
 * `decided_at` nullable) are not performed because Phase 2B introduces no
 * legacy rows that would be affected; the DDL is always applied on fresh DBs.
 */
function migrateTopicsColumns(db: DatabaseSync): void {
  const columns = db.prepare(`PRAGMA table_info(topics)`).all() as unknown as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === "source_published_at")) {
    db.exec(`ALTER TABLE topics ADD COLUMN source_published_at TEXT;`);
  }
}