# Sentinel AI — Development State

> This is the permanent handoff / state snapshot for Sentinel AI. Read it at the
> start of every AI-assisted development session. It complements (does not
> replace) `PROMPTS.md` (the historical AI usage log). If code and docs disagree,
> trust the code and RE-MATCH the docs.

## Current Phase

Phase 2.2 — Feed Experience (COMPLETE). Backend Phase 3A complete; Phase 2.1 frontend foundation complete.

## Project Identity

Sentinel AI (do NOT rename; do NOT call it Aegis). The runtime persona is
supplied via `POST /api/agent/init` — never hardcoded.

## Hackathon Problem

Problem Statement 3 — Autonomous AI Creator. Evaluator calls `POST /api/agent/init`
exactly once, then only polls `GET /api/agent/feed` for ~48 hours. No further prompts.

## Current Objective

Phase 2.2 (complete): replace the placeholder Feed and Post-detail views with a REAL feed experience wired to `GET /api/agent/feed?agentId=...` — rendering live posts newest-first with timestamps, text, rationale, and source links, plus deliberate loading / empty / error / retry states. Post-detail reuses the existing feed response (no new backend endpoint). The frontend remains presentation-only; it never triggers generation, discovery, or publishing.

Phase 3A (backend memory & publication) and Phase 2.1 (frontend foundation) are COMPLETE and are not being redone.

## Implemented

### Backend (Phase 3A complete — unchanged in Phase 2.2)
- Persistent SQLite storage: `agents`, `posts`, `topics`, `scheduling`.
- Exact API contract (`POST /api/agent/init`, `GET /api/agent/feed`).
- Autonomous scheduler & lifecycle with restart recovery and failure isolation.
- Live topic discovery from curated RSS feeds (`TopicSource`, `RssFeedSource`, `LiveTopicDiscovery`, timeout, deduplication).
- Deterministic Editorial Decision Engine (`DeterministicEditorialEngine`) scoring across relevance, freshness, novelty, source quality, and persona fit against threshold (default 60), persisting structured reasoning and decisions in the `topics` audit trail.
- LLM Content Generation + Rationale (`LlmContentGenerator`) with Gemini/OpenAI/mock providers, prompt injection defense, validation, and timeouts.
- Persistent Memory (`SqliteAgentMemory`): exact + near-duplicate Jaccard detection, agent isolation, survives restarts.
- Publishing Policy (`PublishingPolicy`): cooldown and sliding-window frequency caps.
- Autonomous Publication & Persistence: validated posts persisted to SQLite, served newest-first by the feed (pure reader).

### Frontend (`frontend/`)
- **Phase 2.1 — Foundation:** design-system tokens, responsive layout, routing, thin API/data layer, placeholder views.
- **Phase 2.2 — Feed experience (complete):**
  - `FeedList` + `PostCard`: fetch real feed, render newest-first, timestamp, text, rationale (`<details>`), source links (safe, `noopener noreferrer`, never raw HTML), and a "Read post" link.
  - `PostDetailPage` + `PostDetailView`: full text, timestamp, rationale, stacked sources; route `/feed/:postId?agentId=...`; reuses the feed response (no new endpoint).
  - Data layer hardened (`src/lib/api.ts`): typed `ApiError` (timeout/network/http/invalid), fetch timeouts, non-2xx handling, malformed-response guard.
  - `useAgentId` reads `?agentId=` from the URL (read-only). `AgentConnect` is a minimal read-only ID entry — never calls init/generate.
  - States (`States.tsx` + `feed.css`): live "pulse" loading, graceful empty ("no posts yet" — not an error), friendly error with Retry.
  - Live polling (`refreshIntervalMs`, default 60s) silently refreshes without blanking existing posts.
  - Automated tests (`src/__tests__/feed.test.tsx`, 9 tests).

## Not Implemented (intentionally deferred)

- External social media network integrations (LinkedIn / X API publishing; simulated via SQLite + feed per hackathon rules).
- Phase 2.3+ frontend views: Autonomous Activity, Editorial Intelligence, Persona updates, System Health (depends on backend `/status` and `/topics` endpoints — not yet added).

## Architecture

```
Portal → Agent → Scheduler loop → AutonomousLifecycle
    ↓
LiveTopicDiscovery → TopicCandidate[]
    ↓
AutonomousLifecycle.persistDiscovered → topics (decision = "discovered")
    ↓
DeterministicEditorialEngine.evaluate → verdicts → topics.updateDecision (publish / reject)
    ↓
IF reject: stop
IF approve: Memory Pre-Check (SqliteAgentMemory) → Publishing Policy Check (PublishingPolicy)
    ↓
LlmContentGenerator.generate → Final Memory Check → Persist Post (posts table) → Remember
↓
GET /api/agent/feed = pure reader of SQLite `posts` (never triggers work)
    ↓
Frontend (Vite + React + TS) : FeedList → PostCard → PostDetailView (reuses feed by id)
```

## Important Concurrent Invariants

- Feed endpoint (`GET /api/agent/feed`) is a **pure reader**; it never triggers discovery, generation, or scheduling.
- `init` does **not** synchronously generate posts.
- The scheduler owns autonomous execution; one tick == one discovery & editorial & generation & publishing cycle.
- Editorial engine is deterministic, explainable, and testable without LLMs.
- Memory checks are agent-scoped (strict isolation).
- No secrets committed; SQLite (`node:sqlite`) stays the persistence layer.
- LLM failures/timeouts/rate limits do not crash the autonomous scheduler.
- The frontend is presentation-only: it never triggers generation, discovery, or publishing.

## Current Data Model

**agents** `id` PK, `persona_name`, `persona_domain`, `status`, `config` (JSON), `created_at`.
**posts** `id` PK, `agent_id` FK, `created_at`, `text`, `rationale`, `sources` (JSON). Feed reads newest-first by `(agent_id, created_at DESC)`.
**topics** (rejection/decision trail). **scheduling**.

## Current AI Components

- **Scheduler** — ✅ (`AutonomousScheduler`). **Lifecycle** — ✅. **Discovery** — ✅. **Editorial** — ✅. **Generator** — ✅. **Memory** — ✅ (`SqliteAgentMemory`). **Policy** — ✅ (`PublishingPolicy`).

## Tests

- Backend: `npm test` **74/74 pass** (11 files); `npm run typecheck`; `npm run build` all pass.
- Frontend: `npm test` **9/9 pass** (feed experience suite); `npm run typecheck` (`tsc -b`); `npm run build` (`tsc -b` + `vite build`) all pass.

## Important Architectural Decisions

1. Node.js + TypeScript + Express; SQLite via Node's built-in `node:sqlite`.
2. Feed = pure reader; scheduler owns autonomous execution.
3. Deterministic Jaccard token similarity for near-duplicate detection against recent SQLite posts.
4. Agent isolation across memory and publishing policy checks.
5. Cooldown and sliding window limits to prevent bursty publications.
6. Frontend is a separate Vite + React + TypeScript app in `frontend/`, independently deployable, presentation-only.
7. Phase 2.2: feed wired to the existing `GET /api/agent/feed` contract; post detail reuses it by id — no new backend endpoints in this phase.

## Known Issues

- Frontend `api.ts` still exports `getStatus`/`getEditorialTrail` types that the backend does not yet serve (Phase 2.3 will add the endpoints).
- Frontend tests currently rely on `globals: true` in the vitest config (for Testing Library auto-cleanup).
- Nothing WIP; all verified passing.

## Deferred Work

- Deployment hardening / production process-manager configuration for the backend.
- Frontend deployment (static host) and backend deployment (always-on host). See SENTINEL_BLUEPRINT_2.0 B25 phases 2.6–2.9.

## Exact Next Phase

Phase 2.3 — Autonomous Intelligence Visualization: Activity + Editorial Intelligence views, which depend on adding small backend `GET /api/agent/status` and `GET /api/agent/topics` endpoints (Blueprint A6). Do NOT implement until Phase 2.2 is done (it is).

## Last Completed Session

Session 8 — Phase 2.2: Feed Experience (plus Session 7 Phase 2.1 and Session 6 Phase 3A).

## Last Verified Commit

Working tree contains Phase 3A (backend), Phase 2.1 (frontend foundation), and Phase 2.2 (feed). All verified: backend 74/74 tests + typecheck + build; frontend 9/9 tests + typecheck + build.