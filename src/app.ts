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
  DeterministicEditorialEngine,
  LiveTopicDiscovery,
  LlmContentGenerator,
  SqliteAgentMemory,
  PublishingPolicy,
} from "./agent/index.js";
import { buildSources } from "./agent/sources/index.js";
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

  const log = (msg: string) => console.log(msg);
  const clock = new SystemClock();

  // Phase 2B: real live-source discovery wired into the lifecycle. Discovery
  // discovers ("what is happening"); editorial/generation/memory remain stubs.
  const discovery = new LiveTopicDiscovery(
    buildSources(config.discoveryRssFeeds, { timeoutMs: config.discoveryHttpTimeoutMs }),
    clock,
    log,
  );

  const editorial = new DeterministicEditorialEngine(clock);
  const generator = new LlmContentGenerator(config);
  const memory = new SqliteAgentMemory(posts);
  const publishingPolicy = new PublishingPolicy(posts, clock);

  const lifecycle = new AutonomousLifecycle(
    discovery,
    editorial,
    generator,
    memory,
    publishingPolicy,
    clock,
    topics,
    posts,
    log,
  );

  const scheduler = new AutonomousScheduler(
    lifecycle,
    scheduling,
    clock,
    config.schedulerIntervalSeconds,
    log,
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