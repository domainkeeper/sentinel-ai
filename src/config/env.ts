/**
 * Environment configuration for Sentinel AI.
 *
 * Secrets are read from the environment (loaded from `.env` by the entrypoint).
 * No secret is ever hardcoded here.
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface AppConfig {
  env: "development" | "test" | "production";
  port: number;
  databasePath: string;
  logLevel: LogLevel;
  schedulerIntervalSeconds: number;
  /** LLM provider API key. Empty in the foundation phase. */
  openAiApiKey: string;
  /** Comma-separated RSS feed URLs for topic discovery. Empty in the foundation phase. */
  discoveryRssFeeds: string[];
}

function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: '${value}' (expected a positive integer)`);
  }
  return parsed;
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (value === undefined || value === "") {
    return "info";
  }
  const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error"];
  if ((levels as string[]).includes(value)) {
    return value as LogLevel;
  }
  throw new Error(`Invalid LOG_LEVEL: '${value}' (expected one of ${levels.join(", ")})`);
}

function parseEnv(value: string | undefined): AppConfig["env"] {
  if (value === "test" || value === "production") {
    return value;
  }
  return "development";
}

/**
 * Build the application configuration from environment variables.
 * Throws on invalid values so misconfiguration fails fast at startup.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    env: parseEnv(env.NODE_ENV),
    port: parsePositiveInt(env.PORT, 3000, "PORT"),
    databasePath: env.DATABASE_PATH || "data/sentinel.db",
    logLevel: parseLogLevel(env.LOG_LEVEL),
    schedulerIntervalSeconds: parsePositiveInt(
      env.SCHEDULER_INTERVAL_SECONDS,
      3600,
      "SCHEDULER_INTERVAL_SECONDS",
    ),
    openAiApiKey: env.OPENAI_API_KEY || "",
    discoveryRssFeeds: (env.DISCOVERY_RSS_FEEDS || "")
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0),
  };
}