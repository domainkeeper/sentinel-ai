import { describe, it, expect } from "vitest";
import {
  LiveTopicDiscovery,
  normalizeToCandidates,
  deduplicateCandidates,
} from "../../src/agent/liveTopicDiscovery.js";
import type { TopicSource } from "../../src/agent/sources/index.js";
import type { DiscoveredItem } from "../../src/agent/sources/index.js";
import type { TopicCandidate } from "../../src/models/index.js";
import { FakeClock } from "../fakeClock.js";

function stubSource(
  name: string,
  items: DiscoveredItem[],
  opts: { shouldThrow?: boolean } = {},
): TopicSource {
  return {
    name,
    async fetch() {
      if (opts.shouldThrow) {
        throw new Error(`boom from ${name}`);
      }
      return items;
    },
  };
}

const item = (over: Partial<DiscoveredItem> = {}): DiscoveredItem => ({
  title: "A topic",
  summary: "summary",
  sourceUrl: "https://example.com/a",
  sourceName: "Source",
  ...over,
});

describe("LiveTopicDiscovery", () => {
  it("returns normalized candidates from multiple sources", async () => {
    const clock = new FakeClock("2026-08-08T05:00:00.000Z");
    const discovery = new LiveTopicDiscovery(
      [
        stubSource("s1", [item({ sourceUrl: "https://1" })]),
        stubSource("s2", [item({ sourceUrl: "https://2" })]),
      ],
      clock,
    );
    const candidates = await discovery.discover("a1");
    expect(candidates).toHaveLength(2);
    for (const c of candidates) {
      expect(c.discoveredAt).toBe("2026-08-08T05:00:00.000Z");
    }
  });

  it("continues with other sources when one source fails", async () => {
    const discovery = new LiveTopicDiscovery(
      [
        stubSource("bad", [], { shouldThrow: true }),
        stubSource("good", [item({ sourceUrl: "https://ok" })]),
      ],
      new FakeClock(),
    );
    const candidates = await discovery.discover("a1");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.sourceUrl).toBe("https://ok");
  });

  it("returns an empty list when all sources fail (does not throw)", async () => {
    const discovery = new LiveTopicDiscovery(
      [
        stubSource("bad1", [], { shouldThrow: true }),
        stubSource("bad2", [], { shouldThrow: true }),
      ],
      new FakeClock(),
    );
    const candidates = await discovery.discover("a1");
    expect(candidates).toEqual([]);
  });

  it("returns an empty list when there are no sources", async () => {
    const discovery = new LiveTopicDiscovery([], new FakeClock());
    const candidates = await discovery.discover("a1");
    expect(candidates).toEqual([]);
  });

  it("skips malformed candidates (missing title/url)", async () => {
    const discovery = new LiveTopicDiscovery(
      [
        stubSource("s", [
          item({ sourceUrl: "" }),
          { title: "", summary: "", sourceUrl: "https://notitle", sourceName: "S" },
          item({ sourceUrl: "https://valid" }),
        ]),
      ],
      new FakeClock(),
    );
    const candidates = await discovery.discover("a1");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.sourceUrl).toBe("https://valid");
  });

  it("de-duplicates identical source URLs within a cycle", async () => {
    const discovery = new LiveTopicDiscovery(
      [
        stubSource("s1", [item({ title: "Dupe", sourceUrl: "https://x" })]),
        stubSource("s2", [item({ title: "Dupe 2", sourceUrl: "https://x" })]),
      ],
      new FakeClock(),
    );
    const candidates = await discovery.discover("a1");
    expect(candidates).toHaveLength(1);
  });

  it("preserves source publication timestamps into candidates", async () => {
    const discovery = new LiveTopicDiscovery(
      [stubSource("s", [item({ publishedAt: "2026-08-07T09:00:00.000Z" })])],
      new FakeClock(),
    );
    const candidates = await discovery.discover("a1");
    expect(candidates[0]!.publishedAt).toBe("2026-08-07T09:00:00.000Z");
  });
});

describe("normalizeToCandidates", () => {
  it("maps a DiscoveredItem to a TopicCandidate with discovery-time", () => {
    const out = normalizeToCandidates(
      [item({ publishedAt: "2026-08-07T09:00:00.000Z" })],
      "a1",
      "2026-08-08T05:00:00.000Z",
    );
    expect(out[0]).toMatchObject<TopicCandidate>({
      title: "A topic",
      sourceUrl: "https://example.com/a",
      sourceName: "Source",
      discoveredAt: "2026-08-08T05:00:00.000Z",
      publishedAt: "2026-08-07T09:00:00.000Z",
    });
  });
});

describe("deduplicateCandidates", () => {
  const cand = (url: string, title = "Title"): TopicCandidate => ({
    title,
    summary: "",
    sourceUrl: url,
    sourceName: "S",
    discoveredAt: "2026-08-08T05:00:00.000Z",
  });

  it("collapses duplicate URLs (case-insensitive)", () => {
    const out = deduplicateCandidates([cand("https://A.com/x"), cand("https://a.com/x")]);
    expect(out).toHaveLength(1);
  });

  it("falls back to normalized title when URL is missing", () => {
    const out = deduplicateCandidates([
      cand("", "Two  Words"),
      cand("", "two words"),
    ]);
    expect(out).toHaveLength(1);
  });
});