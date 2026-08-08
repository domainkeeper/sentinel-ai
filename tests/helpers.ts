import { openDatabase } from "../src/db/connection.js";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config/env.js";

/** Build a test app backed by an in-memory SQLite database. */
export function buildTestApp(overrides: Partial<AppConfig> = {}) {
  const config: AppConfig = {
    env: "test",
    port: 0,
    databasePath: ":memory:",
    logLevel: "error",
    schedulerIntervalSeconds: 3600,
    openAiApiKey: "",
    discoveryRssFeeds: [],
    discoveryHttpTimeoutMs: 15000,
    ...overrides,
  };
  const db = openDatabase(config);
  const sentinel = createApp(db, config);
  return { config, db, ...sentinel };
}