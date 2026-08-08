import type { Post, TopicCandidate } from "../models/index.js";

/**
 * Agent memory.
 *
 * Provides the context needed for editorial judgment and content generation:
 * published posts, recent themes, and duplicate detection. The foundation
 * defines the interface; a concrete SQLite-backed implementation with
 * both exact and semantic duplicate detection is built in a later phase.
 */
export interface AgentMemory {
  /** Recent published posts for an agent, newest first. */
  recentPosts(agentId: string, limit?: number): Promise<Post[]>;

  /** Detect whether a candidate topic is a duplicate/near-duplicate of prior coverage. */
  isDuplicate(agentId: string, candidate: TopicCandidate): Promise<boolean>;
}