/**
 * A candidate topic discovered from a live source, plus the editorial
 * decision that was made about it. This provides the "considered and
 * rejected" trail that demonstrates real editorial judgment.
 *
 * Phase 2B: a `TopicCandidate` is a *discovered* candidate (pre-editorial).
 * It carries the source metadata (URL, name, source publication timestamp)
 * the editorial engine needs, but discovery never decides to publish/reject.
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
  /** ISO 8601 UTC timestamp of discovery (when Sentinel AI found it). */
  discoveredAt: string;
  /**
   * ISO 8601 UTC publication timestamp reported by the source, when available.
   * Undefined when the source did not provide one. Never fabricated.
   */
  publishedAt?: string;
}

/**
 * The persisted state of a topic record.
 *
 * - `discovered`: a candidate that has been found but **not** yet editorially
 *   decided. This is the Phase 2B default — discovery ≠ rejection ≠ publish.
 * - `publish`: the editorial engine approved it for publication.
 * - `reject`: the editorial engine explicitly rejected it.
 */
export type TopicDecision = "discovered" | "publish" | "reject";

/** A persisted record of a topic in the `topics` rejection/decision trail. */
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
  /** ISO 8601 UTC publication timestamp from the source, when available. */
  publishedAt?: string;
  /** ISO 8601 UTC timestamp when the editorial decision was recorded. */
  decidedAt?: string;
  decision: TopicDecision;
  /** Structured rejection reasons / scoring detail (free-form JSON). */
  reasoning: Record<string, unknown>;
}