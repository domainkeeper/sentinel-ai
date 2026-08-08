import express from "express";
import type { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "./config/env.js";
import { createApiRouter } from "./api/routes.js";
import {
  AgentRepository,
  PostRepository,
  SchedulingRepository,
  TopicRepository,
} from "./repositories/index.js";
import { AgentService, FeedService } from "./services/index.js";
import {
  AutonomousLifecycle,
  AutonomousScheduler,
  NoopAgentMemory,
  NoopContentGenerator,
  NoopEditorialEngine,
  NoopTopicDiscovery,
} from "./agent/index.js";
import { SystemClock } from "./util/clock.js";

/**
 * Assemble the Sentinel AI application: repositories, services, HTTP API,
 * and the autonomous lifecycle + scheduler.
 *
 * The scheduler is created but NOT started here — the entrypoint calls
 * `start()` after the server is listening, and `recover()` re-registers
 * persisted agents so scheduling resumes across restarts.
 */
export function createApp(db: DatabaseSync, config: AppConfig) {
  const agents = new AgentRepository(db);
  const posts = new PostRepository(db);
  const topics = new TopicRepository(db);
  const scheduling = new SchedulingRepository(db);

  // Phase 2A: downstream components are no-op stubs. Later phases replace them.
  const lifecycle = new AutonomousLifecycle(
    new NoopTopicDiscovery(),
    new NoopEditorialEngine(),
    new NoopContentGenerator(),
    new NoopAgentMemory(),
    new SystemClock(),
  );

  const scheduler = new AutonomousScheduler(
    lifecycle,
    scheduling,
    new SystemClock(),
    config.schedulerIntervalSeconds,
    (msg) => console.log(msg),
  );

  const agentService = new AgentService(agents, scheduler);
  const feedService = new FeedService(posts);

  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter(agentService, feedService));

  // Health check for the 48-hour reliability story.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return { app, agentService, feedService, agents, posts, topics, scheduling, scheduler };
}

export type SentinelApp = ReturnType<typeof createApp>;