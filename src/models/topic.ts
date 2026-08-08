/**
 * A candidate topic discovered from a live source, plus the editorial
 * decision that was made about it. This provides the "considered and
 * rejected" trail that demonstrates real editorial judgment.
 */
export interface TopicCandidate {
  /** Stable identity for the topic (e.g. a headline or canonical title). */
  title: string;
  /** A short summary / description of the topic. */
  summary: string;
  /** Source URL where the topic was found. */
  sourceUrl: string;
  /** Source name / publisher. */
  sourceName: string;
  /** ISO 8601 UTC timestamp of discovery. */
  discoveredAt: string;
}

export type TopicDecision = "publish" | "reject";

/** A persisted record of a topic that was considered by the editorial engine. */
export interface TopicRecord {
  /** Unique record identifier. */
  id: string;
  /** ID of the owning agent. */
  agentId: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  /** ISO 8601 UTC timestamp of discovery. */
  discoveredAt: string;
  /** ISO 8601 UTC timestamp when the decision was recorded. */
  decidedAt: string;
  decision: TopicDecision;
  /** Structured rejection reasons / scoring detail (free-form JSON). */
  reasoning: Record<string, unknown>;
}