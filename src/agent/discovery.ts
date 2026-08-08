import type { TopicCandidate } from "../models/index.js";

/**
 * Topic discovery source.
 *
 * Implementations pull candidate topics from live information sources
 * (RSS feeds, news APIs, etc.). Discovery always produces a candidate list,
 * never a single forced pick — the editorial engine filters that list.
 */
export interface TopicDiscovery {
  /**
   * Discover candidate topics for an agent.
   * Must never throw for a single failing source; treat failures as "no candidates."
   */
  discover(agentId: string): Promise<TopicCandidate[]>;
}