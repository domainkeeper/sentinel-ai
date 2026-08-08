import type { DatabaseSync } from "node:sqlite";
import type { Post } from "../models/index.js";

interface PostRow {
  id: string;
  agent_id: string;
  created_at: string;
  text: string;
  rationale: string;
  sources: string;
}

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    agentId: row.agent_id,
    createdAt: row.created_at,
    text: row.text,
    rationale: row.rationale,
    sources: JSON.parse(row.sources) as string[],
  };
}

export class PostRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** Insert a new post. */
  create(post: Post): void {
    this.db
      .prepare(
        `INSERT INTO posts (id, agent_id, created_at, text, rationale, sources)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        post.id,
        post.agentId,
        post.createdAt,
        post.text,
        post.rationale,
        JSON.stringify(post.sources),
      );
  }

  /** Fetch all posts for an agent, newest first. */
  listByAgent(agentId: string): Post[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM posts WHERE agent_id = ? ORDER BY created_at DESC, id DESC`,
      )
      .all(agentId) as unknown as PostRow[];
    return rows.map(rowToPost);
  }

  /** Count posts for an agent. */
  countByAgent(agentId: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS count FROM posts WHERE agent_id = ?`)
      .get(agentId) as { count: number };
    return Number(row.count);
  }
}