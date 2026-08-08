import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config/env.js";

describe("loadConfig", () => {
  it("applies defaults when no env vars are set", () => {
    const config = loadConfig({});
    expect(config.env).toBe("development");
    expect(config.port).toBe(3000);
    expect(config.databasePath).toBe("data/sentinel.db");
    expect(config.logLevel).toBe("info");
    expect(config.schedulerIntervalSeconds).toBe(3600);
    expect(config.discoveryRssFeeds).toEqual([]);
  });

  it("reads values from the environment", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      PORT: "8080",
      DATABASE_PATH: "/tmp/test.db",
      LOG_LEVEL: "debug",
      SCHEDULER_INTERVAL_SECONDS: "1800",
      DISCOVERY_RSS_FEEDS: "https://a.com/rss, https://b.com/rss",
    });
    expect(config.env).toBe("production");
    expect(config.port).toBe(8080);
    expect(config.databasePath).toBe("/tmp/test.db");
    expect(config.logLevel).toBe("debug");
    expect(config.schedulerIntervalSeconds).toBe(1800);
    expect(config.discoveryRssFeeds).toEqual(["https://a.com/rss", "https://b.com/rss"]);
  });

  it("throws on an invalid PORT", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/PORT/);
  });

  it("throws on an invalid LOG_LEVEL", () => {
    expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow(/LOG_LEVEL/);
  });
});