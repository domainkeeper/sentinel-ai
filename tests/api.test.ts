import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";
import type { FeedResponse, Post } from "../src/models/index.js";

describe("POST /api/agent/init", () => {
  it("returns an agentId for a valid persona payload", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/api/agent/init").send({
      persona: { name: "Ada", domain: "AI Security" },
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.agentId).toBe("string");
    expect(res.body.agentId.length).toBeGreaterThan(0);
  });

  it("rejects a missing persona", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/api/agent/init").send({});
    expect(res.status).toBe(400);
  });

  it("rejects an empty persona name", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/api/agent/init").send({
      persona: { name: "", domain: "AI Security" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects an empty persona domain", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/api/agent/init").send({
      persona: { name: "Ada", domain: "" },
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/agent/feed", () => {
  let ctx: ReturnType<typeof buildTestApp>;
  let agentId: string;

  beforeEach(async () => {
    ctx = buildTestApp();
    const res = await request(ctx.app).post("/api/agent/init").send({
      persona: { name: "Ada", domain: "AI Security" },
    });
    agentId = res.body.agentId as string;
  });

  it("returns an empty posts array for a new agent", async () => {
    const res = await request(ctx.app).get(`/api/agent/feed?agentId=${agentId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ posts: [] });
  });

  it("returns 400 when agentId is missing", async () => {
    const res = await request(ctx.app).get("/api/agent/feed");
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown agentId", async () => {
    const res = await request(ctx.app).get("/api/agent/feed?agentId=does-not-exist");
    expect(res.status).toBe(404);
  });

  it("returns stored posts newest first with correct shape", async () => {
    // Insert two posts directly via the repository to simulate published content.
    const older: Post = {
      id: "p-old",
      agentId,
      createdAt: "2026-08-07T10:00:00.000Z",
      text: "Older post",
      rationale: "Older rationale",
      sources: ["https://example.com/older"],
    };
    const newer: Post = {
      id: "p-new",
      agentId,
      createdAt: "2026-08-07T11:00:00.000Z",
      text: "Newer post",
      rationale: "Newer rationale",
      sources: ["https://example.com/newer"],
    };
    ctx.posts.create(older);
    ctx.posts.create(newer);

    const res = await request(ctx.app).get(`/api/agent/feed?agentId=${agentId}`);
    expect(res.status).toBe(200);
    const body = res.body as FeedResponse;
    expect(body.posts).toHaveLength(2);
    expect(body.posts[0]!.id).toBe("p-new");
    expect(body.posts[1]!.id).toBe("p-old");
    expect(body.posts[0]!.createdAt).toBe("2026-08-07T11:00:00.000Z");
    expect(body.posts[0]!.sources).toEqual(["https://example.com/newer"]);
    // Contract exactness: served posts must not leak the internal agentId.
    expect(body.posts[0]).not.toHaveProperty("agentId");
    expect(Object.keys(body.posts[0]!).sort()).toEqual([
      "createdAt",
      "id",
      "rationale",
      "sources",
      "text",
    ]);
  });
});

describe("/health", () => {
  it("reports ok", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});