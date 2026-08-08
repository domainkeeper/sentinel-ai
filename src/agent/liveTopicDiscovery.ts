import type { TopicCandidate } from "../models/index.js";
import type { Clock } from "../util/clock.js";
import type { TopicDiscovery } from "./discovery.js";
import type { TopicSource } from "./sources/index.js";
import type { DiscoveredItem } from "./sources/index.js";

/**
 * Live topic discovery.
 *
 * Pulls normalized items from every configured source, converts them to
 * `TopicCandidate`s, and de-duplicates within the cycle. It performs NO
 * editorial judgment — it only reports "what is happening."
 *
 * Failure isolation: a single failing source is logged and skipped; the other
 * sources still contribute. If all sources fail, an empty candidate list is
 * returned and the scheduler simply continues. `discover` never throws.
 */
export class LiveTopicDiscovery implements TopicDiscovery {
  constructor(
    private readonly sources: TopicSource[],
    private readonly clock: Clock,
    private readonly log: (message: string) => void = () => {},
  ) {}

  async discover(agentId: string): Promise<TopicCandidate[]> {
    this.log(`discovery: cycle started for agent ${agentId}`);
    const items: DiscoveredItem[] = [];

    for (const source of this.sources) {
      this.log(`discovery: fetching source "${source.name}"`);
      try {
        const got = await source.fetch();
        this.log(`discovery: source "${source.name}" returned ${got.length} item(s)`);
        items.push(...got);
      } catch (err) {
        // Isolation: a source failure is "this source failed this tick", not
        // a fatal error. Continue with the remaining sources.
        this.log(`discovery: source "${source.name}" failed: ${String(err)}`);
        continue;
      }
    }

    const discoveredAt = this.clock.now().toISOString();
    const candidates = normalizeToCandidates(items, agentId, discoveredAt, this.log);
    const deduped = deduplicateCandidates(candidates);

    this.log(
      `discovery: cycle complete for agent ${agentId}: ` +
        `${deduped.length} candidate(s) from ${items.length} item(s)`,
    );
    return deduped;
  }
}

/** Convert normalized source items into discovery `TopicCandidate`s. */
export function normalizeToCandidates(
  items: DiscoveredItem[],
  agentId: string,
  discoveredAt: string,
  log: (message: string) => void = () => {},
): TopicCandidate[] {
  const candidates: TopicCandidate[] = [];
  for (const item of items) {
    const title = item.title?.trim() ?? "";
    const sourceUrl = item.sourceUrl?.trim() ?? "";
    if (!title || !sourceUrl) {
      log(`discovery: skipped malformed candidate (${agentId})`);
      continue;
    }
    candidates.push({
      title,
      summary: item.summary ?? "",
      sourceUrl,
      sourceName: item.sourceName ?? "unknown",
      discoveredAt,
      publishedAt: item.publishedAt,
    });
  }
  return candidates;
}

/**
 * Remove duplicate candidates within a discovery cycle.
 *
 * Phase 2B deduplication is deliberately basic and deterministic: identical
 * canonical source URLs (and a normalized-title fallback) are collapsed.
 * Semantic/near-duplicate detection belongs to the memory phase, not here.
 */
export function deduplicateCandidates(candidates: TopicCandidate[]): TopicCandidate[] {
  const seen = new Set<string>();
  const result: TopicCandidate[] = [];
  for (const candidate of candidates) {
    const key =
      candidate.sourceUrl.trim().toLowerCase() ||
      normalizeTitle(candidate.title);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}