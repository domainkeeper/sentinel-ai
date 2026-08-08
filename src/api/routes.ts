import { Router } from "express";
import type { AgentService, FeedService } from "../services/index.js";
import { initAgentSchema } from "./validation.js";

/**
 * Builds the Sentinel AI HTTP API.
 *
 * Contract (exact):
 *   POST /api/agent/init        -> { "agentId": "..." }
 *   GET  /api/agent/feed?agentId=... -> { "posts": [...] }
 */
export function createApiRouter(agentService: AgentService, feedService: FeedService): Router {
  const router = Router();

  router.post("/agent/init", async (req, res) => {
    const parsed = initAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { agentId } = agentService.initAgent({ persona: parsed.data.persona });
    res.status(201).json({ agentId });
  });

  router.get("/agent/feed", (req, res) => {
    const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";

    if (!agentId) {
      res.status(400).json({ error: "Missing required query parameter: agentId" });
      return;
    }

    const agent = agentService.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    res.json(feedService.getFeed(agentId));
  });

  return router;
}