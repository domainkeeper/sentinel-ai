import type { RssDeps } from "./rssFeedSource.js";
import { RssFeedSource } from "./rssFeedSource.js";
import type { TopicSource } from "./topicSource.js";

export * from "./rssFeedSource.js";
export * from "./topicSource.js";

/**
 * Build the configured live topic sources.
 *
 * Phase 2B uses a single source type — RSS — wired to its own `RssFeedSource`
 * dep override. Future sources (GitHub, arXiv, news APIs) implement the same
 * `TopicSource` interface and are added here, keeping the lifecycle agnostic
 * to source type.
 *
 * @returns an empty list when no feeds are configured (e.g. tests).
 */
export function buildSources(
  rssFeedUrls: string[],
  opts: Partial<RssDeps> = {},
): TopicSource[] {
  return rssFeedUrls.map((url) => {
    let label = url;
    try {
      label = new URL(url).hostname || url;
    } catch {
      // fall back to the raw URL when it is not parseable
    }
    return new RssFeedSource(url, label, opts);
  });
}