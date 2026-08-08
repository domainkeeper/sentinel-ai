import type { Post } from "../models/index.js";
import type { PostRepository } from "../repositories/index.js";
import type { Clock } from "../util/clock.js";

export interface PublishingPolicyConfig {
  /** Minimum minutes required between successive publications. Default: 60 minutes. */
  cooldownMinutes?: number;
  /** Maximum publications allowed within a sliding time window. Default: 5 posts. */
  maxPostsPerWindow?: number;
  /** Window size in hours for max posts limit. Default: 24 hours. */
  postWindowHours?: number;
}

export interface PublishingDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Publishing Policy Engine (Phase 3A).
 * Enforces cooldown gaps between posts and sliding window frequency caps,
 * ensuring agent-scoped restraint and preventing publication bursts.
 */
export class PublishingPolicy {
  private readonly cooldownMinutes: number;
  private readonly maxPostsPerWindow: number;
  private readonly postWindowHours: number;

  constructor(
    private readonly postRepo: PostRepository,
    private readonly clock: Clock,
    config?: PublishingPolicyConfig,
  ) {
    this.cooldownMinutes = config?.cooldownMinutes ?? 60;
    this.maxPostsPerWindow = config?.maxPostsPerWindow ?? 5;
    this.postWindowHours = config?.postWindowHours ?? 24;
  }

  evaluate(agentId: string): PublishingDecision {
    const posts = this.postRepo.listByAgent(agentId);
    const now = this.clock.now();

    if (posts.length === 0) {
      return { allowed: true, reason: "No previous publications; publishing allowed." };
    }

    // 1. Check Cooldown
    const mostRecent = posts[0];
    if (mostRecent) {
      const lastPubTime = new Date(mostRecent.createdAt);
      if (!isNaN(lastPubTime.getTime())) {
        const elapsedMinutes = (now.getTime() - lastPubTime.getTime()) / (1000 * 60);
        if (elapsedMinutes < this.cooldownMinutes) {
          return {
            allowed: false,
            reason: `Cooldown active: ${Math.round(this.cooldownMinutes - elapsedMinutes)} minutes remaining before next allowed publication.`,
          };
        }
      }
    }

    // 2. Check Sliding Window Post Limit
    const windowMs = this.postWindowHours * 60 * 60 * 1000;
    const recentPostsInWindow = posts.filter((p) => {
      const pTime = new Date(p.createdAt).getTime();
      return !isNaN(pTime) && now.getTime() - pTime <= windowMs;
    });

    if (recentPostsInWindow.length >= this.maxPostsPerWindow) {
      return {
        allowed: false,
        reason: `Publication window limit reached: ${recentPostsInWindow.length} posts published within the last ${this.postWindowHours} hours (limit: ${this.maxPostsPerWindow}).`,
      };
    }

    return { allowed: true, reason: "Publishing policy checks passed." };
  }
}
