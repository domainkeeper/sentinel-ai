import type { Agent, TopicCandidate, TopicDecision } from "../models/index.js";

/** The result of evaluating a single candidate topic. */
export interface EditorialVerdict {
  candidate: TopicCandidate;
  decision: TopicDecision;
  /** Structured scoring detail / reasons, e.g. per-axis scores and pass/fail reasons. */
  reasoning: Record<string, unknown>;
}

/**
 * The editorial decision engine.
 *
 * Scores and filters candidate topics against a publish threshold based on
 * axes such as novelty, relevance, importance, freshness, and persona fit.
 * Rejection must be real and explainable — a candidate that fails the bar
 * is rejected with structured reasoning, not silently dropped.
 */
export interface EditorialDecisionEngine {
  /** Evaluate a list of candidates and pick 0 or 1 to publish (rarely more). */
  evaluate(agent: Agent, candidates: TopicCandidate[]): Promise<EditorialVerdict[]>;
}