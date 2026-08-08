/**
 * A normalized item discovered from a live information source.
 *
 * This is the source-level normalized representation. The discovery layer
 * converts it into a `TopicCandidate` (the model-level representation) before
 * handing it to the editorial engine.
 */
export interface DiscoveredItem {
  /** Headline / title of the item. */
  title: string;
  /** Short summary or description of the item. */
  summary: string;
  /** Canonical URL of the item (the article/page, not the feed URL). */
  sourceUrl: string;
  /** Name of the source / publisher. */
  sourceName: string;
  /**
   * ISO 8601 UTC publication timestamp from the source, when available.
   * Undefined when the source does not provide one.
   */
  publishedAt?: string;
}

/**
 * A live information source.
 *
 * Implementations fetch candidate topics from a specific source type
 * (RSS, GitHub, arXiv, etc.). The lifecycle does not care which source
 * produced a candidate — it receives normalized `DiscoveredItem`s.
 *
 * `fetch()` must never throw for a single failing source; treat failures
 * as "no items this tick" and return an empty array.
 */
export interface TopicSource {
  /** Human-readable name of this source (e.g. "Ars Technica RSS"). */
  readonly name: string;
  /** Fetch and return normalized candidate items from this source. */
  fetch(): Promise<DiscoveredItem[]>;
}