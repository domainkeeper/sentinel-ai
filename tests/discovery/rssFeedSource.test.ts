import { describe, it, expect } from "vitest";
import { RssFeedSource, normalizeRssItems } from "../../src/agent/sources/rssFeedSource.js";
import type { RawRssItem } from "../../src/agent/sources/rssFeedSource.js";

describe("normalizeRssItems", () => {
  const base: RawRssItem = {
    title: "New model released",
    link: "https://example.com/post",
    summary: "A summary.",
    isoDate: "2026-08-07T10:00:00.000Z",
  };

  it("normalizes a valid item with all fields", () => {
    const out = normalizeRssItems([base], { sourceName: "Example" });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      title: "New model released",
      summary: "A summary.",
      sourceUrl: "https://example.com/post",
      sourceName: "Example",
      publishedAt: "2026-08-07T10:00:00.000Z",
    });
  });

  it("skips items without a title", () => {
    const out = normalizeRssItems([{ link: "https://x" }], { sourceName: "Example" });
    expect(out).toHaveLength(0);
  });

  it("skips items without a link", () => {
    const out = normalizeRssItems([{ title: "No link" }], { sourceName: "Example" });
    expect(out).toHaveLength(0);
  });

  it("keeps an item with a missing summary (empty string, not fabricated)", () => {
    const out = normalizeRssItems([{ title: "T", link: "https://x" }], {
      sourceName: "Example",
    });
    expect(out[0]!.summary).toBe("");
  });

  it("leaves publishedAt undefined when the source provides no date", () => {
    const out = normalizeRssItems([{ title: "T", link: "https://x" }], {
      sourceName: "Example",
    });
    expect(out[0]!.publishedAt).toBeUndefined();
  });

  it("leaves publishedAt undefined when the date is unparseable", () => {
    const out = normalizeRssItems([
      { title: "T", link: "https://x", pubDate: "not-a-date" },
    ], { sourceName: "Example" });
    expect(out[0]!.publishedAt).toBeUndefined();
  });

  it("falls back from summary to contentSnippet to content", () => {
    const fromSnippet = normalizeRssItems(
      [{ title: "T", link: "https://x", summary: "", contentSnippet: "snippet" }],
      { sourceName: "Example" },
    )[0]!.summary;
    expect(fromSnippet).toBe("snippet");

    const fromContent = normalizeRssItems(
      [{ title: "T", link: "https://x", summary: "", content: "<p>body</p>" }],
      { sourceName: "Example" },
    )[0]!.summary;
    expect(fromContent).toBe("<p>body</p>");
  });

  it("collapses duplicate links in a single feed", () => {
    const out = normalizeRssItems(
      [base, { ...base }, { ...base, title: "Different title same link" }],
      { sourceName: "Example" },
    );
    expect(out).toHaveLength(1);
  });

  it("does not let one bad item destroy the others", () => {
    const out = normalizeRssItems(
      [base, { title: "", link: "https://bad" }, { title: "Second", link: "https://two" }],
      { sourceName: "Example" },
    );
    expect(out).toHaveLength(2);
  });
});

describe("RssFeedSource.fetch", () => {
  it("fetches, parses, and normalizes items end-to-end", async () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <title>Example Blog</title>
        <item><title>First</title><link>https://example.com/1</link>
          <summary>One</summary><pubDate>Sat, 08 Aug 2026 10:00:00 GMT</pubDate></item>
        <item><title>Second</title><link>https://example.com/2</link>
          <summary>Two</summary></item>
      </channel></rss>`;
    const source = new RssFeedSource("https://feeds/example", "fallback", {
      fetchXml: async () => xml,
      timeoutMs: 1000,
    });
    const items = await source.fetch();
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe("First");
    expect(items[0]?.sourceName).toBe("Example Blog");
    expect(items[0]?.publishedAt).toBeDefined();
  });

  it("returns [] and does not throw when the fetch fails", async () => {
    const source = new RssFeedSource("https://feeds/example", "fallback", {
      fetchXml: async () => {
        throw new Error("network down");
      },
    });
    const items = await source.fetch();
    expect(items).toEqual([]);
  });

  it("returns [] on malformed XML", async () => {
    const source = new RssFeedSource("https://feeds/example", "fallback", {
      fetchXml: async () => "<rss><channel>", // unclosed — malformed
    });
    const items = await source.fetch();
    expect(items).toEqual([]);
  });

  it("returns [] on an empty feed", async () => {
    const source = new RssFeedSource("https://feeds/empty", "fallback", {
      fetchXml: async () => `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`,
    });
    const items = await source.fetch();
    expect(items).toEqual([]);
  });
});