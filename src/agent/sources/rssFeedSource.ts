import Parser from "rss-parser";
import { fetchText } from "../../util/http.js";
import type { DiscoveredItem, TopicSource } from "./topicSource.js";

/** A raw, un-normalized RSS item as produced by the parser. */
export interface RawRssItem {
  title?: string;
  link?: string;
  summary?: string;
  content?: string;
  contentSnippet?: string;
  pubDate?: string;
  isoDate?: string;
}

/** The parsed shape of a feed that normalization consumes. */
export interface ParsedFeed {
  items: RawRssItem[];
  title?: string;
}

/**
 * External dependencies of an RSS source (fetch + parse), injected so tests
 * can substitute fakes and never touch a real website.
 */
export interface RssDeps {
  /** Fetch a URL and return the raw feed body. */
  fetchXml: (url: string) => Promise<string>;
  /** Parse a feed body into its items. */
  parseFeed: (xml: string) => Promise<ParsedFeed>;
  /** How many milliseconds a fetch may run before it is aborted. */
  timeoutMs: number;
  /** Logging hook. */
  log: (message: string) => void;
}

const BUILT_IN_PARSER = new Parser();

function defaultDeps(timeoutMs: number, log: (m: string) => void): RssDeps {
  return {
    fetchXml: (url) => fetchText(url, { timeoutMs }),
    parseFeed: (xml) => BUILT_IN_PARSER.parseString(xml) as Promise<ParsedFeed>,
    timeoutMs,
    log,
  };
}

/**
 * An RSS topic source.
 *
 * Fetches a feed over HTTP (finite timeout), parses it, and normalizes each
 * item into a `DiscoveredItem`. Guaranteed not to throw: any failure at the
 * network level, XML level, or item level is handled and logged, so a single
 * malformed feed/item degrades to "no items this tick" rather than crashing
 * the discovery cycle.
 */
export class RssFeedSource implements TopicSource {
  readonly name: string;
  private readonly deps: RssDeps;

  constructor(
    private readonly feedUrl: string,
    fallbackName: string,
    opts: Partial<RssDeps> = {},
  ) {
    const timeoutMs = opts.timeoutMs ?? 15000;
    const log = opts.log ?? (() => {});
    this.name = fallbackName;
    this.deps = {
      fetchXml: opts.fetchXml ?? ((url) => fetchText(url, { timeoutMs })),
      parseFeed: opts.parseFeed ?? ((xml) => BUILT_IN_PARSER.parseString(xml) as Promise<ParsedFeed>),
      timeoutMs,
      log,
    };
  }

  async fetch(): Promise<DiscoveredItem[]> {
    let xml: string;
    try {
      xml = await this.deps.fetchXml(this.feedUrl);
    } catch (err) {
      this.deps.log(`rss: fetch failed for ${this.name}: ${String(err)}`);
      return [];
    }

    let feed: ParsedFeed;
    try {
      feed = await this.deps.parseFeed(xml);
    } catch (err) {
      this.deps.log(`rss: parse failed for ${this.name}: ${String(err)}`);
      return [];
    }

    return normalizeRssItems(feed.items ?? [], {
      sourceName: (feed.title && feed.title.trim() ? feed.title.trim() : this.name),
      log: this.deps.log,
    });
  }
}

export interface ParseOptions {
  sourceName: string;
  log?: (message: string) => void;
}

/**
 * Normalize a list of raw RSS items into `DiscoveredItem`s.
 *
 * Item-level rules:
 * - Missing/empty title → skipped (invalid candidate).
 * - Missing/empty link   → skipped (no canonical URL).
 * - Missing summary      → allowed (empty summary retained).
 * - No parseable publication date → `publishedAt` undefined (never fabricated).
 * - Duplicate links within the feed → collapsed.
 *
 * A bad item is skipped and logged; it never aborts the rest.
 */
export function normalizeRssItems(
  items: RawRssItem[],
  options: ParseOptions,
): DiscoveredItem[] {
  const log = options.log ?? (() => {});
  const seen = new Set<string>();
  const result: DiscoveredItem[] = [];

  for (const item of items) {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const link = typeof item.link === "string" ? item.link.trim() : "";

    if (!title) {
      log(`rss: skipped item without a title in ${options.sourceName}`);
      continue;
    }
    if (!link) {
      log(`rss: skipped item without a link in ${options.sourceName}`);
      continue;
    }
    if (seen.has(link)) {
      log(`rss: skipped duplicate item (${link}) in ${options.sourceName}`);
      continue;
    }
    seen.add(link);

    const summary = firstNonEmpty(item.summary, item.contentSnippet, item.content);
    const publishedAt = toIsoUtc(item.isoDate ?? item.pubDate);

    result.push({
      title,
      summary,
      sourceUrl: link,
      sourceName: options.sourceName,
      publishedAt,
    });
  }

  return result;
}

/** Return the first non-empty string argument, else "". */
function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function toIsoUtc(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}