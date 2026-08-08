/** A published post returned via GET /api/agent/feed. */
export interface Post {
  /** Unique post identifier. */
  id: string;
  /** ID of the owning agent. */
  agentId: string;
  /** ISO 8601 UTC timestamp of creation. */
  createdAt: string;
  /** The post body text. */
  text: string;
  /** Editorial rationale: why this topic was selected, why it is relevant now, and why over alternatives. */
  rationale: string;
  /** Source URLs backing the post. */
  sources: string[];
}

/**
 * The exact shape of a post served by GET /api/agent/feed.
 *
 * Matches the hackathon contract precisely: `agentId` is an internal detail
 * and is intentionally excluded from the served payload.
 */
export interface FeedPost {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
}

/** The exact shape served by GET /api/agent/feed. */
export interface FeedResponse {
  posts: FeedPost[];
}