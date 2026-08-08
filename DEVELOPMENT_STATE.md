# Sentinel AI — Development State

> This is the permanent handoff / state snapshot for Sentinel AI. Read it at the
> start of every AI-assisted development session. It complements (does not
> replace) `PROMPTS.md` (the historical AI usage log). If code and docs disagree,
> trust the code and RE-MATCH the docs.

## Current Phase

Phase 2B — Live Topic Discovery

## Project Identity

Sentinel AI (do NOT rename; do NOT call it Aegis). The runtime persona is
configurable and supplied via `POST /api/agent/init` — never hardcoded (e.g. Ada is an example, not a fixed name).

## Hackathon Problem

Problem Statement 3 — Autonomous AI Creator. Evaluator calls `POST /api/agent/init`
exactly once, then only polls `GET /api/agent/feed` for ~48 hours. No further prompts.

## Current Objective

Implement a real, reliable live-information-source pipeline for autonomous topic
discovery: fetch curated RSS feeds, parse and normalize them into the internal
topic model, persist discovered candidates (clearly distinct from publish/reject),
and wire real discovery into the autonomous lifecycle — while deliberately leaving
editorial scoring, LLM generation, memory, and publishing unimplemented.

## Implemented

- Persistent SQLite storage: `agents`, `posts`, `topics`, `scheduling`.
- Exact API contract (`POST /api/agent/init`, `GET /api/agent/feed`).
- Autonomous scheduler: per-agent loop, persisted next-run, idempotent register/start,
  `recover()` restart recovery, failure isolation, graceful shutdown.
- `AutonomousLifecycle` orchestrating discovery → persist → editorial → generation → memory.
- Live topic discovery from configurable RSS feeds:
  - `TopicSource` abstraction (`src/agent/sources/topicSource.ts`).
  - `RssFeedSource` (fetch with timeout → parse with `rss-parser` → normalize/validate).
  - `LiveTopicDiscovery` (multi-source, per-source failure isolation, in-cycle de-dupe).
  - `src/util/http.ts` `fetchText` HTTP helper with finite `AbortController` timeout.
  - `buildSources` registry (`src/agent/sources/index.ts`).
- Discovery persists candidates to the `topics` trail in the `discovered` state
  (`discovered ≠ reject ≠ publish`); plus `existsBySourceUrl` guard against duplicates.
- Dependency: `rss-parser` (only discovery-specific dependency).

## Not Implemented (intentionally deferred)

- Editorial scoring / decision engine (Phase 2C).
- Editorial threshold / publish-vs-reject decision.
- Content / LLM generation (text + rationale).
- Rationale generation.
- Memory (recent posts, near-duplicate detection).
- Semantic / embedding-based deduplication.
- Publishing (posts are never created yet; `posts` table stays empty).

## Architecture

```
Portal → Agent → Scheduler loop → AutonomousLifecycle
    ↓
LiveTopicDiscovery                          (real; fetches RSS via TopicSource → RssFeedSource)
    ↓ TopicCandidate[]
    →
AutonomousLifecycle.persistDiscovered → topics (decision = "discovered")
    ↓
NoopEditorialEngine (stub, rejects) → NoopContentGenerator (stub) → NoopAgentMemory (stub)
    ↓
GET /api/agent/feed = pure reader of SQLite `posts` (never triggers work)
```

## Important Concurrent Invariants

- Feed endpoint (`GET /api/agent/feed`) is a **pure reader**; it never triggers discovery, generation, or scheduling.
- `init` does **not** synchronously generate posts; it only creates and registers the agent.
- The scheduler owns autonomous execution; one tick == one discovery attempt (no tight inner loop).
- Discovery makes **no editorial decision** (`discovered` ≠ `reject` ≠ `publish`).
- Discovery does **not** generate content or publish.
- Editorial engine stays separate and is still a stub.
- The `topics` decision denotes state, not a final disposition.
- No secrets committed; SQLite (`node:sqlite`) stays the persistence layer.
- No dependency on external websites in the test suite (network is mocked).

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
- **Lifecycle** — ✅ Implemented (`AutonomousLifecycle`); real discovery wired in.
- **Discovery** — ✅ Implemented (`LiveTopicDiscovery` + `RssFeedSource`).
- **Editorial** — 🔲 Stub (`NoopEditorialEngine` rejects everything).
- **Generator** — 🔲 Stub (`NoopContentGenerator`).
- **Memory** — 🔲 Stub (`NoopAgentMemory`).

## Tests

Last verified: `npm run typecheck` passes (strict TS); `npm test` **64/64 pass**;
`npm run build` passes.

Test files: `tests/api.test.ts`, `tests/repositories.test.ts`, `tests/config.test.ts`,
`tests/scheduler.test.ts`, `tests/scheduling.test.ts`, `tests/lifecycle.test.ts`,
`tests/discovery/rssFeedSource.test.ts`, `tests/discovery/liveTopicDiscovery.test.ts`
(plus `tests/fakeClock.ts`, `tests/helpers.ts`). Discovery tests use injected fakes — no real web.

## Important Architectural Decisions

1. Node.js + TypeScript + Express; SQLite via Node's built-in `node:sqlite`.
2. Feed = pure reader; scheduler owns autonomous execution.
3. Interfaces before implementation (discovery/editorial/generator/memory + `TopicSource` seams).
4. RSS is the initial live source via a `TopicSource` abstraction (future sources plug in).
5. `rss-parser` for XML; first-party `fetchText` for HTTP with finite `AbortController` timeouts.
6. Failure isolation everywhere: a per-source (or item-level) failure degrades to "no candidates" / skip.
7. Discovery ≠ decision — candidates stored in `discovered` state (`decided_at` null), never `publish`/`reject`.
8. Minimal deterministic dedupe (source URL; in-cycle + against persisted sources); no embeddings.
9. Fake-clock deterministic testing for the scheduler and discovery — no flaky real-time tests.

## Known Issues

- None known. (A Node "SQLite is an experimental feature" warning appears in output — benign; `node:sqlite` is stable enough for this project's scale.)

## Deferred Work

- Phase 2C editorial decision engine / threshold.
- LLM generation + rationale (persona-driven).
- Memory with semantic dedup.
- Publishing cadence / cooldown / "empty news day" handling.
- Source diversity (GitHub, arXiv, news APIs) beyond RSS.
- Deployment + monitoring / heartbeat.

## Exact Next Phase

Phase 2C — Editorial Decision Engine: replace `NoopEditorialEngine` with a real scorer that
takes `discovered` candidates, scores them on novelty / relevance / importance / freshness /
persona fit, applies a publish threshold, and updates the `topics` trail (rejecting the rest)
— while still NOT generating or publishing posts. Followed by LLM generation and memory.

## Current Completed Session

Session 3 — Live Topic Discovery (see PROMPTS.md for the full log).

## Last Verified Commit

Before this session (do not invent one): `97fad13` Phase 2A. Phase 2B changes are uncommitted in the working tree; the expected follow-up is to create a Phase 2B commit when ready.