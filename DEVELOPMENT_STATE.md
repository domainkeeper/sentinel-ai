# Sentinel AI — Development State

> This is the permanent handoff / state snapshot for Sentinel AI. Read it at the
> start of every AI-assisted development session. It complements (does not
> replace) `PROMPTS.md` (the historical AI usage log). If code and docs disagree,
> trust the code and RE-MATCH the docs.

## Current Phase

Phase 2D — Content Generation + Rationale

## Project Identity

Sentinel AI (do NOT rename; do NOT call it Aegis). The runtime persona is
supplied via `POST /api/agent/init` — never hardcoded.

## Hackathon Problem

Problem Statement 3 — Autonomous AI Creator. Evaluator calls `POST /api/agent/init`
exactly once, then only polls `GET /api/agent/feed` for ~48 hours. No further prompts.

## Current Objective

Implement real LLM-backed content generation and specific, falsifiable rationale generation for approved editorial topics (`LlmContentGenerator`), complete with configuration, prompt isolation, strict prompt-injection defense, output validation, finite timeouts, error/rate-limit handling, lifecycle integration, and comprehensive unit tests.

## Implemented

- Persistent SQLite storage: `agents`, `posts`, `topics`, `scheduling`.
- Exact API contract (`POST /api/agent/init`, `GET /api/agent/feed`).
- Autonomous scheduler & lifecycle with restart recovery and failure isolation.
- Live topic discovery from curated RSS feeds (`TopicSource`, `RssFeedSource`, `LiveTopicDiscovery`, timeout, deduplication).
- Deterministic Editorial Decision Engine (`DeterministicEditorialEngine`) scoring across relevance, freshness, novelty, source quality, and persona fit against threshold (default 60), persisting structured reasoning and decisions in the `topics` audit trail.
- **Content Generation + Rationale (`LlmContentGenerator`)**:
  - Provider-agnostic `ContentGenerator` abstraction supporting Gemini, OpenAI, and mock providers.
  - Environment configuration (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_TIMEOUT_MS`) with zero secrets committed.
  - Isolated prompt builder (`buildGenerationPrompt`) with strict XML boundaries (`<persona>`, `<editorial_decision>`, `<topic>`, `<source_material>`, `<output_requirements>`) defending against prompt injection.
  - Robust output validation and sanitization (`validateAndSanitizeOutput`) ensuring mandatory text and rationale fields, length limits, and application-controlled source attribution.
  - Lifecycle integration: approved topics undergo LLM generation while rejected topics bypass generation entirely. Failures, timeouts, and rate limits are safely caught and isolated.

## Not Implemented (intentionally deferred)

- Memory with semantic deduplication and long-term post retrieval.
- Publishing cadence / cooldown system (posts table stays empty; publishing belongs to Phase 2E).

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
IF approve: LlmContentGenerator.generate → validated draft + rationale → persisted in decision reasoning
    ↓
GET /api/agent/feed = pure reader of SQLite `posts` (never triggers work)
```

## Important Concurrent Invariants

- Feed endpoint (`GET /api/agent/feed`) is a **pure reader**; it never triggers discovery, generation, or scheduling.
- `init` does **not** synchronously generate posts.
- The scheduler owns autonomous execution; one tick == one discovery & editorial & generation cycle.
- Editorial engine is deterministic, explainable, and testable without LLMs.
- Discovered candidates are initially stored as `discovered` and updated to `publish` or `reject` upon editorial evaluation.
- Approved candidates are transformed into drafts by the content generator; rejected candidates never invoke the generator.
- No secrets committed; SQLite (`node:sqlite`) stays the persistence layer.
- LLM failures, timeouts, and rate limits do not crash or hang the autonomous scheduler.
- Source material is treated strictly as untrusted data.

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
- **Lifecycle** — ✅ Implemented (`AutonomousLifecycle`; discovery, editorial, and generator wired in).
- **Discovery** — ✅ Implemented (`LiveTopicDiscovery` + `RssFeedSource`).
- **Editorial** — ✅ Implemented (`DeterministicEditorialEngine`).
- **Generator** — ✅ Implemented (`LlmContentGenerator` + prompt builder + validator).
- **Memory** — 🔲 Stub (`NoopAgentMemory`).

## Tests

Last verified: `npm run typecheck` passes (strict TS); `npm test` **71/71 pass** (including `tests/generator.test.ts`).

## Important Architectural Decisions

1. Node.js + TypeScript + Express; SQLite via Node's built-in `node:sqlite`.
2. Feed = pure reader; scheduler owns autonomous execution.
3. Deterministic, rule-based scoring across 5 axes against a threshold (default 60).
4. Content generation strictly downstream of editorial approval (rejected topics never invoke the LLM).
5. Isolated prompt builder with XML tags separating persona, editorial decision, topic, and untrusted source material for prompt-injection defense.
6. Application-controlled canonical source attribution (model cannot override source URLs).
7. Timeout and failure isolation: LLM errors, timeouts, and rate limits are caught safely so the scheduler remains alive.

## Known Issues

- None known.

## Deferred Work

- Memory with semantic deduplication.
- Publishing cadence / cooldown system (Phase 2E).

## Exact Next Phase

Phase 2E — Memory & Publishing.

## Last Completed Session

Session 5 — Content Generation + Rationale.

## Last Verified Commit

Working tree contains Phase 2D implementation.
