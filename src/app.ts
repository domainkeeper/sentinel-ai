import express from "express";
import type { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "./config/env.js";
import { createApiRouter } from "./api/routes.js";
import { AgentRepository, PostRepository, TopicRepository } from "./repositories/index.js";
import { AgentService, FeedService } from "./services/index.js";

/**
 * Assemble the Sentinel AI application: repositories, services, and HTTP API.
 *
 * The autonomous lifecycle (scheduler + discovery + editorial + generation +
 * memory) attaches here in a later phase; the API layer is complete and
 * testable now against persistent storage.
 */
export function createApp(db: DatabaseSync, config: AppConfig) {
  const agents = new AgentRepository(db);
  const posts = new PostRepository(db);
  const topics = new TopicRepository(db);

  const agentService = new AgentService(agents);
  const feedService = new FeedService(posts);

  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter(agentService, feedService));

  // Health check for the 48-hour reliability story.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return { app, agentService, feedService, agents, posts, topics };
}

export type SentinelApp = ReturnType<typeof createApp>;