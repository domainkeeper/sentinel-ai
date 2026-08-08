import type { FeedPost, FeedResponse, Post } from "../models/index.js";
import type { PostRepository } from "../repositories/index.js";

/**
 * Serves the feed for a given agent.
 *
 * This is a pure read path: it never triggers generation. Generation is
 * strictly the domain of the autonomous loop (scheduler), per the blueprint's
 * critical constraint that the feed endpoint must be a pure reader.
 */
export class FeedService {
  constructor(private readonly posts: PostRepository) {}

  /** Return all posts for an agent, newest first, matching the exact API contract. */
  getFeed(agentId: string): FeedResponse {
    const posts: Post[] = this.posts.listByAgent(agentId);
    const feedPosts: FeedPost[] = posts.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      text: p.text,
      rationale: p.rationale,
      sources: p.sources,
    }));
    return { posts: feedPosts };
  }
}
