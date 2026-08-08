import type { DatabaseSync } from "node:sqlite";
import type { AgentMemory } from "./memory.js";
import type { Post, TopicCandidate } from "../models/index.js";
import type { PostRepository } from "../repositories/index.js";

/**
 * SQLite-backed AgentMemory implementation with exact and near-duplicate detection,
 * time-aware lookback, and strict agent isolation.
 */
export class SqliteAgentMemory implements AgentMemory {
  constructor(
    private readonly postRepo: PostRepository,
    private readonly similarityThreshold: number = 0.75, // Jaccard similarity threshold for near-duplicates
    private readonly lookbackDays: number = 7,
  ) {}

  async recentPosts(agentId: string, limit: number = 20): Promise<Post[]> {
    const posts = this.postRepo.listByAgent(agentId);
    return posts.slice(0, limit);
  }

  async isDuplicate(agentId: string, candidate: TopicCandidate): Promise<boolean> {
    const recent = this.postRepo.listByAgent(agentId);
    if (recent.length === 0) {
      return false;
    }

    const now = new Date().getTime();
    const lookbackMs = this.lookbackDays * 24 * 60 * 60 * 1000;

    const relevantPosts = recent.filter((p) => {
      const pTime = new Date(p.createdAt).getTime();
      return !isNaN(pTime) && now - pTime <= lookbackMs;
    });

    const candidateUrl = candidate.sourceUrl.trim().toLowerCase();
    const candidateTitleNormalized = normalizeText(candidate.title);
    const candidateSummaryNormalized = normalizeText(candidate.summary);
    const candidateTokens = tokenize(candidateTitleNormalized + " " + candidateSummaryNormalized);

    for (const post of relevantPosts) {
      // 1. Check exact source URL match in post sources
      if (post.sources.some((s) => s.trim().toLowerCase() === candidateUrl)) {
        return true;
      }

      // 2. Check title / text exact or high similarity
      // We check if any post text or rationale mentions the exact title normalized
      const postTextNormalized = normalizeText(post.text);
      if (postTextNormalized.includes(candidateTitleNormalized) && candidateTitleNormalized.length > 10) {
        return true;
      }

      // 3. Near-duplicate detection via Jaccard token overlap
      const postTokens = tokenize(postTextNormalized);
      const similarity = jaccardSimilarity(candidateTokens, postTokens);
      if (similarity >= this.similarityThreshold) {
        return true;
      }
    }

    return false;
  }
}

/** Normalize text for comparison: lowercase, trim, collapse whitespace, strip punctuation. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize text into a set of unique word tokens (ignoring very short stop words). */
export function tokenize(text: string): Set<string> {
  const normalized = normalizeText(text);
  const words = normalized.split(" ").filter((w) => w.length > 2);
  return new Set(words);
}

/** Compute Jaccard similarity coefficient between two token sets. */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
