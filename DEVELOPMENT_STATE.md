# Sentinel AI — Development State

> This is the permanent handoff / state snapshot for Sentinel AI. Read it at the
> start of every AI-assisted development session. It complements (does not
> replace) `PROMPTS.md` (the historical AI usage log). If code and docs disagree,
> trust the code and RE-MATCH the docs.

## Current Phase

Phase 2C — Editorial Decision Engine

## Project Identity

Sentinel AI (do NOT rename; do NOT call it Aegis). The runtime persona is
configurable and supplied via `POST /api/agent/init` — never hardcoded.

## Hackathon Problem

Problem Statement 3 — Autonomous AI Creator. Evaluator calls `POST /api/agent/init`
exactly once, then only polls `GET /api/agent/feed` for ~48 hours. No further prompts.

## Current Objective

Implement a real deterministic editorial decision engine that scores and filters discovered candidate topics against a publish threshold based on dimensions such as relevance, freshness, novelty, source quality, and persona fit, persisting structured reasoning and decisions in the SQLite `topics` audit trail — while keeping the content generator and memory as stubs (no posts published yet).

## Implemented

- Persistent SQLite storage: `agents`, `posts`, `topics`, `scheduling`.
- Exact API contract (`POST /api/agent/init`, `GET /api/agent/feed`).
- Autonomous scheduler & lifecycle with restart recovery and failure isolation.
- Live topic discovery from curated RSS feeds (`TopicSource`, `RssFeedSource`, `LiveTopicDiscovery`, timeout, deduplication).
- **Deterministic Editorial Decision Engine (`DeterministicEditorialEngine`)**:
  - Scores candidates across 5 dimensions: relevance, freshness, novelty, source quality, and persona fit (0–100).
  - Threshold-based decision (`publish` if score >= threshold, default 60; otherwise `reject`).
  - Structured reasons and per-axis breakdown persisted in the `topics` audit trail.
- Dependency: `rss-parser`.

## Not Implemented (intentionally deferred)

- Content / LLM generation (Phase 2D).
- Rationale generation via LLM.
- Memory (recent posts, near-duplicate detection, semantic similarity / embeddings).
- Publishing (posts table stays empty).

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
Approved candidate reaches generator stub (NoopContentGenerator) → No publication
    ↓
GET /api/agent/feed = pure reader of SQLite `posts` (never triggers work)
```

## Important Concurrent Invariants

- Feed endpoint (`GET /api/agent/feed`) is a **pure reader**; it never triggers discovery, generation, or scheduling.
- `init` does **not** synchronously generate posts.
- The scheduler owns autonomous execution; one tick == one discovery & editorial cycle.
- Editorial engine is deterministic, explainable, and testable without LLMs.
- Discovered candidates are initially stored as `discovered` and updated to `publish` or `reject` upon editorial evaluation.
- No secrets committed; SQLite (`node:sqlite`) stays the persistence layer.

## Current Data Model

**agents** `id` PK, `persona_name`, `persona_domain`, `status`, `config` (JSON), `created_at`.

**posts** `id` PK, `agent_id` FK, `created_at`, `text`, `rationale`, `sources` (JSON). Feed reads newest-first by `(agent_id, created_at DESC)`.

**topics** (rejection/decision trail) `id` PK, `agent_id` FK, `title`, `summary`, `source_url`,
`source_name`, `discovered_at`, `source_published_at` (nullable), `decided_at` (nullable),
`decision` (`discovered`/`reject`/`publish`), `reasoning` (JSON). Indexed by
`(agent_id, discovered_at DESC)` and `(agent_id, source_url)`.

**scheduling** `agent_id` PK/FK, `last_run_at`, `next_run_at`, `active`, `created_at`, `updated_at`.

## Current AI Components

- **Scheduler** — ✅ Implemented (`AutonomousScheduler`).
- **Lifecycle** — ✅ Implemented (`AutonomousLifecycle`; discovery & editorial wired in).
- **Discovery** — ✅ Implemented (`LiveTopicDiscovery` + `RssFeedSource`).
- **Editorial** — ✅ Implemented (`DeterministicEditorialEngine`).
- **Generator** — 🔲 Stub (`NoopContentGenerator`).
- **Memory** — 🔲 Stub (`NoopAgentMemory`).

## Tests

Last verified: `npm run typecheck` passes (strict TS); `npm test` **67/67 pass** (including `tests/editorial.test.ts`).

## Important Architectural Decisions

1. Node.js + TypeScript + Express; SQLite via Node's built-in `node:sqlite`.
2. Feed = pure reader; scheduler owns autonomous execution.
3. Deterministic, rule-based scoring across 5 axes (relevance, freshness, novelty, source quality, persona fit) against a threshold (default 60).
4. Structured JSON reasoning and per-axis breakdown persisted in SQLite `topics` table.
5. Separation of concerns: discovery finds, editorial decides, generator (future) writes.

## Known Issues

- None known.

## Deferred Work

- Phase 2D — Content Generation + Rationale.
- Memory with semantic dedup.
- Publishing cadence / cooldown.

## Exact Next Phase

Phase 2D — Content Generation.

## Last Completed Session

Session 4 — Editorial Decision Engine.

## Last Verified Commit

Working tree contains Phase 2C implementation.
