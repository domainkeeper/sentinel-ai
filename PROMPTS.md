# Sentinel AI — AI Usage Log

> This log records AI-assisted development sessions for the hackathon's authenticity review.
> Entries are chronological and correspond to actual repository changes, git history, and verified functionality.

---

## Session 1 — Foundation Phase

**Date:** 2026-08-08

**Development phase:** Initial implementation — project foundation

**AI tool:** Cline (VS Code extension)

**Objective:** Establish the technical foundation for Sentinel AI, an autonomous AI/technology persona for Problem Statement 3 (Autonomous AI Creator). This session was explicitly scoped to the foundation phase only — NOT the full autonomous system.

### Prompt / Instruction

The session was directed by a detailed task specification requiring:

1. Read the existing planning documents first (`autonomous-ai-creator-blueprint.md`, `PROMPTS.md`, `README.md`) and audit the repository before writing any code.
2. Determine whether the Claude blueprint sufficiently covered architecture, AI/LLM interaction, topic discovery, editorial judgment, memory, persistence, reliability, deployment, testing, and hackathon logistics.
3. Establish a clean, solo-hackathon-appropriate project structure with clear separation between API, agent lifecycle, persona, discovery, editorial decision, content generation, memory, persistence, scheduler, models, configuration, utilities, tests, and documentation.
4. Create the configuration foundation (`.env.example`, no hardcoded secrets).
5. Establish initial data models (Agent, Post, Topic/Discovery) and the API contract foundation for `POST /api/agent/init` and `GET /api/agent/feed` — without implementing the full autonomous intelligence.
6. Define the autonomous lifecycle interfaces (scheduler, discovery, editorial, generator, memory) as seams for later phases.
7. Set up a deterministic testing foundation.
8. Update documentation and `PROMPTS.md`.
9. Stop — do not continue into later implementation phases automatically.

### AI Work

Cline executed the following:

1. **Read & audited** the Claude blueprint, found it comprehensive, and identified the concrete technical choices the blueprint left open.
2. **Made missing technical decisions:**
   - **Node.js + TypeScript + Express** (Node v24 available; fast for a solo hackathon).
   - **SQLite via Node's built-in `node:sqlite` (`DatabaseSync`)** — zero-dependency, avoids native-compile issues on Windows, durable, and matches the blueprint's recommended default.
   - **Vitest** for testing and **zod** for API validation.
3. **Created the project structure** with clear separation: `src/agent`, `src/api`, `src/config`, `src/db`, `src/models`, `src/repositories`, `src/services`, `src/util`, `tests`, `docs`.
4. **Implemented the foundation:**
   - Persistent schema (agents, posts, topics tables)
   - Repositories (Agent, Post, Topic) with SQLite queries
   - The exact API contract (`init` + `feed`) built on the lifecycle seam
   - Service layer (AgentService, FeedService)
   - Configuration module (`loadConfig`) reading from env vars
   - Autonomous lifecycle interfaces (Scheduler, TopicDiscovery, EditorialDecisionEngine, ContentGenerator, AgentMemory, AgentLifecycle)
5. **Wrote a 19-test Vitest suite** covering API contract, persistence, and config parsing.
6. **Verified**:
   - `npm run typecheck` passes (strict TS)
   - All 19 tests pass
   - Live server boots; `/health`, `/api/agent/init`, and `/api/agent/feed` verified against a persistent file-backed SQLite database
7. **Documented** the current state in `README.md` and `docs/architecture.md`, clearly stating what is implemented vs. not implemented (no claiming of unfinished features).

### Files Affected

**Created:**

- `package.json`
- `tsconfig.json`
- `.gitignore`
- `.env.example`
- `vitest.config.ts`
- `docs/architecture.md`
- `src/app.ts`
- `src/index.ts`
- `src/config/env.ts`
- `src/db/connection.ts`
- `src/db/schema.ts`
- `src/models/agent.ts`, `src/models/post.ts`, `src/models/topic.ts`, `src/models/index.ts`
- `src/repositories/agentRepository.ts`, `src/repositories/postRepository.ts`, `src/repositories/topicRepository.ts`, `src/repositories/index.ts`
- `src/services/agentService.ts`, `src/services/feedService.ts`, `src/services/index.ts`
- `src/api/routes.ts`, `src/api/validation.ts`
- `src/agent/lifecycle.ts`, `src/agent/discovery.ts`, `src/agent/editorial.ts`, `src/agent/generator.ts`, `src/agent/memory.ts`, `src/agent/index.ts`
- `src/util/ids.ts`
- `tests/helpers.ts`, `tests/api.test.ts`, `tests/repositories.test.ts`, `tests/config.test.ts`

**Modified:**

- `README.md` (was a single-line stub; rewritten with full project documentation)
- `PROMPTS.md` (was empty; this log entry added)

**Not modified:** `autonomous-ai-creator-blueprint.md` (the master plan was preserved as-is).

**Dependencies installed:** `express`, `zod`, `dotenv`; dev: `typescript`, `tsx`, `vitest`, `supertest`, `@types/node`, `@types/express`, `@types/supertest`.

### Architectural Decisions

1. **Node.js + TypeScript + Express** — familiar, fast, appropriate for a solo hackathon.
2. **SQLite via Node's built-in `node:sqlite` (`DatabaseSync`)** — no native compilation issues on Windows; durable; zero extra infra; matches the blueprint's recommended default.
3. **Feed endpoint is a pure reader** — never triggers generation, preserving the "no further prompts" evaluation premise.
4. **`init` never generates posts synchronously** — it only creates the agent record; publishing is scheduler-driven (once implemented).
5. **Interfaces before implementation** — lifecycle, discovery, editorial, generator, and memory are defined as interfaces so later phases plug in cleanly.
6. **Environment variables for all config** — `.env.example` documents them; no secrets committed.
7. **Rejection trail as a first-class table** (`topics`) — supports the "considered and rejected" transparency the blueprint prioritizes.

### Verification

- `npm run typecheck` — passes with no errors (strict TS).
- `npm test` — 19/19 tests pass (API contract, repository persistence + newest-first ordering, config parsing).
- Live end-to-end check against a file-backed SQLite DB:
  - `GET /health` → `{"status":"ok",...}`
  - `POST /api/agent/init` → `{"agentId":"8df8e2f7"}`
  - `GET /api/agent/feed?agentId=8df8e2f7` → `{"posts":[]}`
  - Confirms the agent persists to disk, not just memory.

### Result

Successfully completed the foundation phase. The repository now has a clean, runnable structure with persistent storage, the exact API contract, well-defined autonomous lifecycle seams, a passing test suite, and honest documentation that does not claim unimplemented functionality.

### Follow-up

The next concrete phase should implement the **autonomous lifecycle core**: a scheduler (with persisted next-run state for restart resilience) that drives topic discovery → editorial scoring → content generation → memory/duplicate check → persistence, then wire it into agent initialization. This will turn the foundation's seams into a working autonomous creator.

---

## Session 2 — Autonomous Lifecycle Core

**Date:** 2026-08-08

**Development phase:** Phase 2A — Autonomous Lifecycle + Scheduler

**AI tool:** Cline (VS Code extension)

**Objective:** Turn the Phase 1 lifecycle interfaces into a working autonomous execution framework: a scheduler with persisted scheduling state, restart recovery, failure isolation, and graceful shutdown — without implementing the downstream intelligence (discovery, editorial, LLM, memory).

### Prompt / Instruction

The session was directed by a detailed task specification requiring:

1. Read the project documentation and Phase 1 implementation first.
2. Implement a scheduler capable of running an agent lifecycle cycle at a configurable interval.
3. Persist scheduling state (last run, next run, agent scheduling state, lifecycle status) in SQLite so it survives restarts.
4. Wire agent initialization into the autonomous lifecycle (register with the scheduler).
5. Implement restart recovery (preserve persisted next-run; do not reset it).
6. Implement graceful shutdown (stop scheduling, close DB cleanly, no dangling timers).
7. Implement failure isolation (a failed cycle must not kill the scheduler; next run still scheduled).
8. Support multiple agents without duplicate scheduler loops.
9. Add deterministic tests (no flaky real-time delays) covering scheduler, persistence, restart, and failure.
10. Keep the feed endpoint a pure reader; do not implement live discovery, editorial scoring, LLM generation, or memory.
11. Update `autonomous-ai-creator-blueprint.md`, `README.md`, `docs/architecture.md`, and `PROMPTS.md`.
12. Stop — do not jump ahead to Phase 2B.

### AI Work

Cline executed the following:

1. **Read & audited** the Phase 1 codebase (interfaces in `src/agent/`, repositories, services, app composition, entrypoint, tests).
2. **Added a `Clock` abstraction** (`src/util/clock.ts`) so the scheduler can be tested deterministically with a fake clock.
3. **Added persisted scheduling state**: a `scheduling` table in the SQLite schema, a `SchedulingState` model, and a `SchedulingRepository`.
4. **Implemented `AutonomousScheduler`** (`src/agent/autonomousScheduler.ts`): per-agent scheduling, idempotent `registerAgent`, `start()`/`stop()`, public `checkDue()` for deterministic testing, `recover()` for restart recovery, and failure isolation.
5. **Implemented `AutonomousLifecycle`** (`src/agent/autonomousLifecycle.ts`): orchestrates discovery → editorial → generation → memory, invoking the Phase 1 interfaces.
6. **Added no-op stubs** (`src/agent/stubs.ts`) for discovery, editorial, generator, and memory so the lifecycle runs end-to-end without fabricating posts.
7. **Wired initialization**: `AgentService.initAgent` now registers the agent with the scheduler; `createApp` builds the scheduler + lifecycle; `index.ts` recovers persisted agents and starts the scheduler after the server listens, with graceful shutdown.
8. **Added deterministic tests** (`tests/scheduler.test.ts`, `tests/scheduling.test.ts`, `tests/fakeClock.ts`) and extended `tests/api.test.ts` to verify init registers the lifecycle and the feed remains a pure reader.
9. **Fixed test issues**: FK constraint failures (tests now persist agents before scheduling) and two scheduler test assertions (start the scheduler before checking `isRunning`; await `checkDue`).
10. **Updated documentation** across all four required files.

### Files Affected

**Created:**

- `src/util/clock.ts`
- `src/models/scheduling.ts`
- `src/repositories/schedulingRepository.ts`
- `src/agent/autonomousScheduler.ts`
- `src/agent/autonomousLifecycle.ts`
- `src/agent/stubs.ts`
- `tests/fakeClock.ts`
- `tests/scheduler.test.ts`
- `tests/scheduling.test.ts`

**Modified:**

- `src/models/index.ts` (export scheduling model)
- `src/db/schema.ts` (add `scheduling` table)
- `src/repositories/index.ts` (export scheduling repository)
- `src/repositories/agentRepository.ts` (add `listAll()`)
- `src/agent/index.ts` (export new classes)
- `src/services/agentService.ts` (register agent with scheduler on init)
- `src/app.ts` (build scheduler + lifecycle)
- `src/index.ts` (recover + start scheduler, graceful shutdown)
- `tests/api.test.ts` (init registers lifecycle; feed is pure reader)
- `autonomous-ai-creator-blueprint.md` (implementation status note)
- `README.md` (Phase 2A status + decisions)
- `docs/architecture.md` (scheduler, persistence, recovery, failure, shutdown)
- `PROMPTS.md` (this entry)

### Architectural Decisions

1. **Scheduler state persisted in SQLite** (`scheduling` table) — last run, next run, active flag survive restarts.
2. **Restart recovery preserves the persisted `nextRunAt`** — a future next-run stays in the future; a past next-run becomes due immediately. It is not reset on restart.
3. **A `Clock` abstraction** lets the scheduler be tested deterministically with a fake clock — no flaky real-time delays.
4. **`checkDue()` is public** so tests drive the scheduler directly; production uses a polling timer.
5. **Failure isolation** — a failed cycle is caught, logged, and the next run is still scheduled; the scheduler never dies from a single bad cycle.
6. **Duplicate-loop prevention** — `registerAgent` is idempotent and `start()` is a no-op if already running.
7. **No-op stubs for downstream interfaces** — the lifecycle runs end-to-end without fabricating posts or fake AI content.
8. **Feed endpoint remains a pure reader** — never triggers generation.

### Verification

- `npm run typecheck` — passes (strict TS).
- `npm test` — **35/35 tests pass** (Phase 1 tests + new scheduler, scheduling persistence, restart recovery, failure isolation, and API lifecycle-registration tests).
- Confirmed the feed endpoint remains a pure reader (polling does not generate posts).

### Result

Successfully completed Phase 2A. An agent can be initialized and is registered with the autonomous lifecycle; a scheduler exists with persisted scheduling state, restart recovery, failure isolation, and graceful shutdown; the lifecycle invokes the downstream interfaces (currently no-op stubs); and the feed endpoint remains a pure reader. No live discovery, editorial scoring, LLM generation, or memory was implemented.

### Follow-up

The next phase is **Phase 2B — Live Topic Discovery**: implement a real `TopicDiscovery` (e.g., RSS feeds) that returns candidate topics, so the lifecycle has actual candidates to evaluate. This will be followed by the editorial engine, LLM generation, and memory in later phases.

---

## Session 3 — Live Topic Discovery

**Date:** 2026-08-08

**Development phase:** Phase 2B — Live Topic Discovery

**AI tool:** opencode (CLI)

**Objective:** Replace the no-op discovery stub with a real, reliable live-information-source pipeline: fetch a live source (RSS), parse it safely, validate and normalize external data into the internal topic model, produce multiple candidate topics, persist discovered candidates without mistaking them for editorial decisions, and wire real discovery into the autonomous lifecycle — while leaving editorial scoring, LLM generation, memory, and publishing strictly unimplemented.

The task specification explicitly required reading all documentation and the Phase 2A implementation before coding, keeping the API contract intact, and keeping the feed endpoint a pure reader.

### Prompt / Instruction

The session was directed by a detailed task specification requiring:

1. Read all project documentation (blueprint, README, architecture, PROMPTS.md), inspect the Phase 2A code, and check git status first.
2. Replace the `NoopTopicDiscovery` with a real `TopicDiscovery` implementation.
3. Introduce a clean `TopicSource` abstraction so the lifecycle never cares whether a candidate came from RSS or a future source.
4. Implement one reliable live source (RSS was the recommended backbone).
5. Implement HTTP fetching with timeouts, response validation, RSS/XML parsing, normalization, and malformed-item handling.
6. Gracefully handle source failures so the scheduler never dies and one bad item never kills a cycle.
7. Persist discovered candidates appropriately without marking them `publish` or `reject` — preserve `DISCOVERED ≠ REJECTED ≠ PUBLISHED`.
8. Add basic, deterministic source-level deduplication (no semantic/embedding dedup).
9. Wire real discovery into `AutonomousLifecycle`, keeping the scheduler behavior and API contract intact.
10. Add deterministic tests that mock external requests (no live websites).
11. Update blueprint, README, architecture, PROMPTS.md, and DEVELOPMENT_STATE.md.
12. Stop — do not implement Phase 2C (editorial), LLM generation, memory, or publishing.

### AI Work

opencode executed the following:

1. **Read & audited** the full codebase (docs, models, repositories, services, lifecycle, scheduler, config, tests) and checked git status — an uncommitted `rss-parser` dependency and a partial `src/agent/sources/topicSource.ts` interface were already present in the working tree; built on them.
2. **Extended the internal topic model** (`src/models/topic.ts`):
   - `TopicCandidate` gained an optional `publishedAt` (source publication timestamp).
   - `TopicDecision` became `"discovered" | "publish" | "reject"`; `TopicRecord` gained `publishedAt?` and made `decidedAt?` optional.
3. **Extended the schema** (`src/db/schema.ts`): added a nullable `source_published_at` column, made `decided_at` nullable, defaulted `decision` to `discovered`, added an `(agent_id, source_url)` index, and an idempotent migration to add the new column to pre-existing tables.
4. **Added `src/util/http.ts`** (`fetchText`) — a tiny first-party HTTP GET with a finite `AbortController` timeout (default 15s, configurable via `DISCOVERY_HTTP_TIMEOUT_MS`).
5. **Implemented `src/agent/sources/rssFeedSource.ts`** (`RssFeedSource` + a pure `normalizeRssItems`): fetches XML via an injected `fetchXml`, parses it with `rss-parser` via an injected `parseFeed`, and normalizes each item while skipping/logging malformed items (missing title/link, duplicate link, unparseable date). `fetch()` never throws.
6. **Implemented `src/agent/sources/index.ts`** — a small `buildSources(rssFeeds, opts)` registry returning `TopicSource[]`.
7. **Implemented `src/agent/liveTopicDiscovery.ts`** (`LiveTopicDiscovery` + pure `normalizeToCandidates` / `deduplicateCandidates`): runs all sources with per-source failure isolation, normalizes items into candidates, stamps `discoveredAt` from the clock, and de-dupes by source URL (with a normalized-title fallback). Never throws.
8. **Extended `TopicRepository`** with `existsBySourceUrl` and support for the new fields.
9. **Wired real discovery into `AutonomousLifecycle`** — persists each discovered candidate to `topics` in the `discovered` state (skipping already-persisted source items) before the editorial stub, which still rejects everything.
10. **Composition** (`src/app.ts`) now builds `LiveTopicDiscovery` from configured RSS feeds and passes the `TopicRepository` into the lifecycle, using a single shared `SystemClock`.
11. **Updated config** (`src/config/env.ts`, `.env.example`) for `DISCOVERY_HTTP_TIMEOUT_MS`; test helpers and config tests updated accordingly.
12. **Added deterministic tests** (`tests/discovery/rssFeedSource.test.ts`, `tests/discovery/liveTopicDiscovery.test.ts`, `tests/lifecycle.test.ts`, plus repository/config additions) using injected fakes — no real websites.
13. **Verified** a live source manually against `https://hnrss.org/frontpage` (20 items fetched/parsed/normalized); an unreachable feed returned `[]` without throwing.

### Files Affected

**Created:**

- `src/agent/sources/rssFeedSource.ts`
- `src/agent/sources/index.ts`
- `src/agent/liveTopicDiscovery.ts`
- `src/util/http.ts`
- `tests/discovery/rssFeedSource.test.ts`
- `tests/discovery/liveTopicDiscovery.test.ts`
- `tests/lifecycle.test.ts`
- `DEVELOPMENT_STATE.md`

(Note: `src/agent/sources/topicSource.ts` — the `TopicSource`/`DiscoveredItem` interface — existed as an untracked file in the working tree before this session; it was retained and completed here.)

**Modified:**

- `src/models/topic.ts` (`publishedAt`; `discovered` decision; optional `decidedAt`)
- `src/db/schema.ts` (source_published_at, nullable decided_at, discovered default, source_url index, migration)
- `src/repositories/topicRepository.ts` (new fields + `existsBySourceUrl`)
- `src/agent/autonomousLifecycle.ts` (persist discovered candidates; inject topic repo)
- `src/agent/index.ts` (export new modules)
- `src/app.ts` (real discovery wiring)
- `src/config/env.ts`, `.env.example` (timeout config)
- `package.json`, `package-lock.json` (`rss-parser`, now used and tested)
- `tests/helpers.ts`, `tests/config.test.ts`, `tests/repositories.test.ts`
- `README.md`, `docs/architecture.md`, `autonomous-ai-creator-blueprint.md`, `PROMPTS.md`

(`rss-parser` was already present as an uncommitted dependency in the working tree before this session; this session put it to use via an injectable parser seam and added tests.)

### Architectural Decisions

1. **`TopicSource` abstraction** (`name` + `fetch(): Promise<DiscoveredItem[]>`). The lifecycle is source-agnostic; RSS is the first concrete implementation, and GitHub/arXiv/news APIs can plug in later.
2. **RSS as the initial live source.** Free, stable, pollable, low rate-limit risk — one reliable end-to-end pipeline before source diversity.
3. **`rss-parser` for XML parsing** (small, well-maintained, no native deps) paired with a **first-party `fetchText`** HTTP helper for clean, bounded timeouts. No large networking/XML framework added.
4. **Failure isolation at every level.** Each source is invoked independently; network/parse errors and malformed items degrade to "no candidates this tick" / "skip item," never to a crash.
5. **Finite timeouts** on every external request (`AbortController`, configurable default 15s).
6. **Discovery ≠ decision.** Candidates are persisted to the `topics` trail in the `discovered` state (`decided_at` null), never `publish`/`reject`.
7. **Minimal deterministic deduplication** — canonical source URL (case-insensitive) + normalized-title fallback, both within a cycle and against already-persisted sources. No embeddings/vector DB.
8. **Feed endpoint remains a pure reader** and the API contract is unchanged.

### Verification

- `npm run typecheck` — passes (strict TS).
- `npm test` — **64/64 tests pass** (Phase 1 + Phase 2A regression + new discovery/source/persistence tests).
- `npm run build` — passes (`tsc`).
- Manual live check: `RssFeedSource` against `https://hnrss.org/frontpage` fetched 20 items and normalized titles/links/ISO timestamps; an unreachable feed returned `[]` without throwing.

### Result

Phase 2B completed. The autonomous loop now discovers real live topics from RSS, normalizes and validates them, de-duplicates basic repeats, and persists them to the `topics` trail in a `discovered` state (distinct from `publish`/`reject`). The editorial, generation, and memory components remain explicit no-op stubs, so no post is ever created — that is the correct state for this phase.

### Follow-up

The next phase is **Phase 2C — Editorial Decision Engine**: score and filter `discovered` candidates against a publish threshold and re-decide the ones selected, so discovered topics (not yet published posts) can begin to be assessed for publication. LLM generation, memory, and publishing cadence still follow later.
