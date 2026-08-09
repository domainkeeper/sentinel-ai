# Sentinel AI

**Sentinel AI** is an autonomous AI/technology persona for **Problem Statement 3 — Autonomous AI Creator**.

The system is designed around one constraint: the evaluator calls `POST /api/agent/init` exactly once, then polls `GET /api/agent/feed` for ~48 hours. After initialization, Sentinel AI must discover live topics, decide what to publish, write in a consistent editorial voice, remember what it has published, and keep publishing over time — with no further human prompts.

**Sentinel AI is the project/system name.** The runtime persona is configurable and supplied through the API, not hardcoded.

---

## Status: Phase 3A complete · Phase 2.1 complete · Phase 2.2 (Feed) complete

This repository currently contains:

- ✅ A **judge-facing frontend** (`frontend/` — Vite + React + TypeScript): design-system tokens, responsive layout, routing for the full Information Architecture, and a **real Feed experience** — live posts from `GET /api/agent/feed` rendered newest-first with timestamps, rationale, and clickable source links, plus a post-detail view and deliberate loading / empty / error / retry states. It is a pure presentation layer over the backend and is independently deployable.
- ✅ Persistent SQLite storage (agents, posts, topic decisions, scheduling state)
- ✅ The exact API contract (`init` + `feed`)
- ✅ The autonomous lifecycle + scheduler (per-agent, persisted next-run, restart recovery, failure isolation, graceful shutdown)
- ✅ **Live topic discovery** from real RSS feeds through a clean `TopicSource` abstraction
- ✅ Discovery persistence: candidates are stored in the `topics` trail in a `discovered` state and updated with editorial decisions (`publish`/`reject`)
- ✅ **Editorial Decision Engine**: a real deterministic rule-based scoring and threshold engine evaluating relevance, freshness, novelty, source quality, and persona fit with structured rejection reasons and persisted scores
- ✅ **Content Generation + Rationale (`LlmContentGenerator`)**: transforms approved topics into persona-consistent social posts and specific, falsifiable rationales using Gemini, OpenAI, or mock providers with strict prompt boundaries, input/output validation, finite timeouts, and error isolation
- ✅ **Persistent Memory (`SqliteAgentMemory`)**: exact source URL, title, and near-duplicate Jaccard token similarity detection with time-aware lookback, scoped strictly by `agentId` (agent isolation), surviving process restarts
- ✅ **Publishing Policy (`PublishingPolicy`)**: cooldown gaps and sliding-window frequency limits preventing publication bursts and respecting "no-post ticks" on slow news days
- ✅ **Autonomous Publication**: validated generated drafts and rationales are persisted to the SQLite `posts` table with server-side UTC ISO 8601 timestamps and unique application IDs, exposed through the feed endpoint
- ✅ Test suite (74 tests) + strict typecheck + build verification

**Not yet implemented:** Activity and Editorial Intelligence views (Phase 2.3, which needs small backend `/status` and `/topics` endpoints), deployment (Blueprint 2.7), and advanced vector/embedding semantic search (intentionally out of scope).

See [docs/architecture.md](docs/architecture.md) for full details and [SENTINEL_BLUEPRINT_2.0.md](SENTINEL_BLUEPRINT_2.0.md) for the forward roadmap.

---

## The Constraint

```
POST /api/agent/init   (exactly once)
      ↓
{ "agentId": "abc-123" }
      ↓
GET /api/agent/feed?agentId=abc-123   (polled repeatedly)
      ↓
{ "posts": [...] }   (newest first, persistent)
```

No additional prompts. No manual "generate post" request. The system must become autonomous immediately after initialization.

---

## API

### `POST /api/agent/init`

Request:
```json
{
  "persona": {
    "name": "Ada",
    "domain": "AI Security"
  }
}
```

Response (`201`):
```json
{ "agentId": "abc-123" }
```

### `GET /api/agent/feed?agentId=abc-123`

Response (`200`):
```json
{
  "posts": [
    {
      "id": "p7",
      "createdAt": "2026-08-07T10:30:00Z",
      "text": "...",
      "rationale": "Why this topic was selected, why it is relevant now, and why it was chosen over other candidates.",
      "sources": ["https://..."]
    }
  ]
}
```

- Posts are newest-first.
- Every post has a unique ID.
- `createdAt` is ISO 8601 UTC.
- Previously returned posts remain available (persistent feed).
- Empty feed returns `{ "posts": [] }`.

---

## Architecture

```
POST /api/agent/init  →  Agent Record (SQLite)  →  Autonomous Loop (scheduler)
                                                          │
                              discovery → decision → generation → memory
                                                          │
GET /api/agent/feed  ←  (pure reader)  ←  SQLite: posts
```

Discovery detail:

```
Live sources (RSS feeds)
     ↓
TopicSource abstraction → RssFeedSource (fetch → parse → normalize)
     ↓
LiveTopicDiscovery (multi-source, de-dupe, failure isolation)
     ↓
TopicCandidate[] → persisted to `topics` (state = "discovered")
     ↓
Editorial engine (currently a stub) → no publication yet
```

The **feed endpoint is a pure reader** — it never triggers discovery or generation. Publishing is strictly the domain of the autonomous loop (scheduler), per the evaluation's "no further prompts" premise.

---

## Getting Started

```bash
cp .env.example .env   # optional; sensible defaults exist
npm install
npm run dev            # start the API (tsx watch)
npm test               # run the test suite
npm run typecheck      # strict type-check

# Frontend (separate app in frontend/)
cd frontend
npm install
npm run dev            # Vite dev server (proxies /api to backend on :3000)
npm run build          # static production bundle in frontend/dist
```

### Environment variables

See [`.env.example`](.env.example). All secrets are read from the environment; none are committed.

---

## Project Structure

```
src/
  agent/          # Lifecycle, scheduler, discovery (interfaces + implementations + sources)
  api/            # HTTP routes + validation
  config/         # Environment configuration
  db/             # SQLite connection + schema
  models/         # Domain types
  repositories/   # Data access
  services/       # Application services
  util/           # Helpers (clock, ids, http)
  app.ts          # Composition root
  index.ts        # Entrypoint
frontend/         # Judge-facing UI (Vite + React + TypeScript)
  src/
    components/   # Presentational (FeedList, PostCard, States, AgentConnect)
    lib/          # API client + types + format helpers (thin data layer)
    styles/       # Design tokens + global/layout/feed styles
    views/        # Overview, Feed, PostDetail, Editorial, Activity, Persona, Health
    __tests__/    # Frontend tests (Vitest + Testing Library)
  vite.config.ts  # Dev proxy /api -> backend; vitest test config
tests/            # Vitest suite (incl. tests/discovery)
docs/             # Architecture docs
```

---

## Architecturally Significant Decisions

1. **SQLite via Node's built-in `node:sqlite`** — zero-dependency, durable, no native-compile issues on Windows; matches the blueprint's recommended default.
2. **`init` never generates posts synchronously.**
3. **Feed is a pure reader; generation is scheduler-only.**
4. **Interfaces before implementation** — later phases plug into defined seams.
5. **Rejection trail is a first-class table** (`topics`) for editorial-transparency.
6. **Scheduler state is persisted in SQLite** (`scheduling` table) — last run, next run, active flag survive restarts; recovery preserves the persisted next-run rather than resetting it.
7. **A clock abstraction** (`Clock`) lets the scheduler and discovery be tested deterministically with a fake clock — no flaky real-time delays.
8. **Failure isolation** — a failed cycle is caught, logged, and the next run is still scheduled; the scheduler never dies from a single bad cycle.
9. **Duplicate-loop prevention** — `registerAgent` is idempotent and `start()` is a no-op if already running.
10. **A `TopicSource` abstraction** — the lifecycle never cares whether a candidate came from RSS, GitHub, arXiv, or a future source; it receives normalized candidates.
11. **RSS as the initial live source** — free, simple, stable, low rate-limit risk; one reliable source before source diversity. `rss-parser` (a small, well-maintained parser) is used; HTTP fetching + timeouts are handled by a tiny first-party `fetchText` helper with a finite `AbortController` timeout.
12. **Discovery & Editorial Decisions.** Discovered candidates are initially stored in `topics` as `discovered`. The deterministic editorial decision engine then evaluates each candidate across 5 dimensions (relevance, freshness, novelty, source quality, persona fit), applies a publish threshold (default 60), and updates the decision to `publish` or `reject` with structured reasoning persisted in the audit trail.
13. **Basic, deterministic source-level deduplication** — identical source URLs (and a normalized-title fallback) are collapsed within a cycle and against already-persisted sources. No semantic/embedding dedup yet (that is the memory phase).

---

## Documentation

- [docs/architecture.md](docs/architecture.md) — current architecture, data model, decisions, and what's next.
- [autonomous-ai-creator-blueprint.md](autonomous-ai-creator-blueprint.md) — the master plan this project follows.
- [PROMPTS.md](PROMPTS.md) — AI usage log (hackathon requirement).

---

## License

MIT