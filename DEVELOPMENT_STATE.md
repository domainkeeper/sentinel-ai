# Sentinel AI — Development State

> This is the permanent handoff / state snapshot for Sentinel AI. Read it at the
> start of every AI-assisted development session. It complements (does not
> replace) `PROMPTS.md` (the historical AI usage log). If code and docs disagree,
> trust the code and RE-MATCH the docs.

## Current Phase

Phase 3A — Memory & Publication

## Project Identity

Sentinel AI (do NOT rename; do NOT call it Aegis). The runtime persona is
supplied via `POST /api/agent/init` — never hardcoded.

## Hackathon Problem

Problem Statement 3 — Autonomous AI Creator. Evaluator calls `POST /api/agent/init`
exactly once, then only polls `GET /api/agent/feed` for ~48 hours. No further prompts.

## Current Objective

Implement persistent SQLite-backed agent memory with exact and near-duplicate Jaccard similarity detection, agent isolation, publishing policy controls (cooldown and sliding window frequency caps), and real autonomous post persistence exposed through the feed endpoint.

## Implemented

- Persistent SQLite storage: `agents`, `posts`, `topics`, `scheduling`.
- Exact API contract (`POST /api/agent/init`, `GET /api/agent/feed`).
- Autonomous scheduler & lifecycle with restart recovery and failure isolation.
- Live topic discovery from curated RSS feeds (`TopicSource`, `RssFeedSource`, `LiveTopicDiscovery`, timeout, deduplication).
- Deterministic Editorial Decision Engine (`DeterministicEditorialEngine`) scoring across relevance, freshness, novelty, source quality, and persona fit against threshold (default 60), persisting structured reasoning and decisions in the `topics` audit trail.
- LLM Content Generation + Rationale (`LlmContentGenerator`) with Gemini/OpenAI/mock providers, prompt injection defense, validation, and timeouts.
- **Persistent Memory (`SqliteAgentMemory`)**:
  - Exact source URL and title matching against recent posts.
  - Near-duplicate detection via Jaccard token similarity with time-aware lookback (default 7 days).
  - Strict agent isolation (`agent_id` scoping).
  - Survives process restarts via SQLite `posts` persistence.
- **Publishing Policy (`PublishingPolicy`)**:
  - Cooldown gaps between publications (default 60 minutes).
  - Sliding-window frequency caps (`maxPostsPerWindow` default 5 posts in 24 hours).
  - Supports no-post ticks gracefully on slow news days.
- **Autonomous Publication & Persistence**:
  - Validated generated posts are persisted to the SQLite `posts` table with server-side UTC ISO 8601 timestamps and unique application IDs.
  - Feed endpoint (`GET /api/agent/feed`) serves persisted posts newest-first as a pure reader.

## Not Implemented (intentionally deferred)

- External social media network integrations (LinkedIn / X API publishing; simulated via SQLite and feed endpoint per hackathon rules).

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
```

## Important Concurrent Invariants

- Feed endpoint (`GET /api/agent/feed`) is a **pure reader**; it never triggers discovery, generation, or scheduling.
- `init` does **not** synchronously generate posts.
- The scheduler owns autonomous execution; one tick == one discovery & editorial & generation & publishing cycle.
- Editorial engine is deterministic, explainable, and testable without LLMs.
- Memory checks are agent-scoped (strict isolation).
- No secrets committed; SQLite (`node:sqlite`) stays the persistence layer.
- LLM failures, timeouts, and rate limits do not crash or hang the autonomous scheduler.

## Current Data Model

**agents** `id` PK, `persona_name`, `persona_domain`, `status`, `config` (JSON), `created_at`.

**posts** `id` PK, `agent_id` FK, `created_at`, `text`, `rationale`, `sources` (JSON). Feed reads newest-first by `(agent_id, created_at DESC)`.

**topics** (rejection/decision trail) `id` PK, `agent_id` FK, `title`, `summary`, `source_url`,
`source_name`, `discovered_at`, `source_published_at` (nullable), `decided_at` (nullable),
`decision` (`discovered`/`reject`/`publish`), `reasoning` (JSON containing editorial scores, rejection reasons, and generated draft text/rationale when approved). Indexed by
`(agent_id, discovered_at DESC)` and `(agent_id, source_url)`.

**scheduling** `agent_id` PK/FK, `last_run_at`, `next_run_at`, `active`, `created_at`, `updated_at`.

## Current AI Components

- **Scheduler** — ✅ Implemented (`AutonomousScheduler`).
- **Lifecycle** — ✅ Implemented (`AutonomousLifecycle`; discovery, editorial, memory, policy, and generator wired in).
- **Discovery** — ✅ Implemented (`LiveTopicDiscovery` + `RssFeedSource`).
- **Editorial** — ✅ Implemented (`DeterministicEditorialEngine`).
- **Generator** — ✅ Implemented (`LlmContentGenerator`).
- **Memory** — ✅ Implemented (`SqliteAgentMemory`).
- **Policy** — ✅ Implemented (`PublishingPolicy`).

## Tests

Last verified: `npm run typecheck` passes (strict TS); `npm test` **74/74 pass** (including `tests/memoryAndPublishing.test.ts`).

## Important Architectural Decisions

1. Node.js + TypeScript + Express; SQLite via Node's built-in `node:sqlite`.
2. Feed = pure reader; scheduler owns autonomous execution.
3. Deterministic Jaccard token similarity for near-duplicate detection against recent SQLite posts.
4. Agent isolation across memory and publishing policy checks.
5. Cooldown and sliding window limits to prevent bursty behavior and ensure sustainable cadence over 48 hours.

## Known Issues

- None known.

## Deferred Work

- Deployment hardening / production process manager configuration.

## Exact Next Phase

None required for core hackathon submission; system is fully complete and operational.

## Last Completed Session

Session 6 — Phase 3A: Memory & Publication.

## Last Verified Commit

Working tree contains Phase 3A implementation.
