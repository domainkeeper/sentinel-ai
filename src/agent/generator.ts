import type { Agent, TopicCandidate } from "../models/index.js";

/** Draft content produced by the generator for an approved topic. */
export interface DraftContent {
  /** The post body text in the persona's editorial voice. */
  text: string;
  /** Editorial rationale: why this topic, why now, and why over alternatives. */
  rationale: string;
  /** Source URLs backing the post. */
  sources: string[];
}

/**
 * Content generator.
 *
 * Turns an approved topic into on-brand post text and a specific, falsifiable
 * rationale. Generation happens only after the editorial engine has decided
 * to publish — the generator does not re-decide whether to publish.
 */
export interface ContentGenerator {
  /** Generate post text + rationale for an approved topic. */
  generate(agent: Agent, topic: TopicCandidate): Promise<DraftContent>;
}