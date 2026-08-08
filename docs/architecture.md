# Sentinel AI — Architecture

## Project Identity

**Sentinel AI** is the project/system name. The runtime AI persona is **not** hardcoded — it is supplied by the evaluator via `POST /api/agent/init` (e.g. `{ "persona": { "name": "Ada", "domain": "AI Security" } }`).

## Problem Context

Problem Statement 3 — Autonomous AI Creator. The evaluator calls `POST /api/agent/init` exactly once, then only polls `GET /api/agent/feed` for ~48 hours. The system must become autonomous immediately after initialization: discover live topics, decide what to publish, write in a consistent voice, remember prior content, and continue publishing over time — all without further human prompts.

## Current Phase (Phase 2B — Live Topic Discovery)

This repository currently implements:

- Persistent SQLite storage (agents, posts, topic decisions, **scheduling state**).
- The exact API contract (`init` + `feed`).
- **The autonomous lifecycle + scheduler**: per-agent scheduling, persisted next-run, restart recovery, failure isolation, and graceful shutdown.
- **Real live topic discovery** from RSS feeds through a `TopicSource` abstraction.
- **Discovery persistence**: candidates stored in the `topics` trail in a `discovered` state (distinct from `publish`/`reject`).

**Autonomous publishing is NOT yet implemented.** A scheduler cycle now discovers real live topics and persists them as `discovered`, but the editorial engine, LLM generation, and memory are still no-op stubs — so no post is ever created.

## Architecture Diagram

```
                       ┌─────────────────────┐
                       │   Init Endpoint      │
                       │  POST /api/agent/init│
                       └──────────┬───────────┘
                                  │ creates + registers
                                  ▼
                       ┌─────────────────────┐
                       │   Agent Record        │  (SQLite: agents)
                       │ (persona + config)    │
                       └──────────┬───────────┘
                                  │
                                  ▼
        ┌───────────────────────────────────────────┐
        │              Autonomous Scheduler          │  (SQLite: scheduling)
        │  per-agent loop → checkDue → runCycle      │
        └───────────────────────────────────────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Autonomous Lifecycle │  (discovery → editorial →
                       │  (orchestrator)       │   generation → memory)
                       └─────────────────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Feed Endpoint       │  GET /api/agent/feed
                       │  (pure reader)       │  reads SQLite: posts
                       └─────────────────────┘
```

## Component Responsibilities

| Component | Status | Responsibility |
|---|---|---|
| `POST /api/agent/init` | ✅ Implemented | Validate persona, create agent record (persistent), **register with scheduler**, return `agentId`. Does **not** generate posts. |
| `GET /api/agent/feed` | ✅ Implemented | Pure read of persisted posts, newest-first. Never triggers generation. |
| Repositories | ✅ Implemented | `agents`, `posts`, `topics`, `scheduling` — SQLite-backed CRUD + queries. |
| `AutonomousScheduler` | ✅ Implemented | Per-agent scheduling loop; persisted next-run; restart recovery; failure isolation; graceful shutdown; duplicate-loop prevention. |
| `AutonomousLifecycle` | ✅ Implemented | Orchestrates one cycle: discovery → persist → editorial → generation → memory. |
| `TopicSource` (abstraction) | ✅ Implemented | Source-agnostic interface producing normalized `DiscoveredItem`s. |
| `RssFeedSource` | ✅ Implemented | Fetch (HTTP + timeout) → parse (rss-parser) → normalize/validate items. |
| `LiveTopicDiscovery` | ✅ Implemented | Runs all sources, normalizes to candidates, in-cycle de-duplication. |
| Editorial Decision | 🔲 Stub | `NoopEditorialEngine` rejects everything. |
| Content Generation | 🔲 Stub | `NoopContentGenerator` (never reached). |
| Memory | 🔲 Stub | `NoopAgentMemory` returns no posts, never a duplicate. |

## Scheduler Design

The `AutonomousScheduler` is a simple, reliable per-agent scheduler:

- **Per-agent scheduling**: each agent has a persisted `SchedulingState` (last run, next run, active).
- **`registerAgent`** is idempotent — it never creates a duplicate in-memory loop. On recovery it preserves the persisted `nextRunAt` rather than resetting it.
- **`start()`** runs a single polling loop that calls `checkDue()` on a cadence. Calling `start()` twice is a no-op (no duplicate loops).
- **`checkDue()`** is public so tests can drive it deterministically with a fake clock (no real-time delays).
- **`recover(agents)`** re-registers all active agents from the `scheduling` table after a restart, preserving persisted next-run.
- **`stop()`** clears the timer and marks the scheduler stopped.

### Scheduling flow

```
Agent initialized
    ↓
Agent persisted (agents table)
    ↓
Lifecycle registered (scheduler.registerAgent)
    ↓
Next run persisted (scheduling table)
    ↓
Scheduler waits (polling loop)
    ↓
Cycle due (checkDue)
    ↓
AutonomousLifecycle.tick(agent)  ← discovery → persist → editorial → generation → memory
    ↓
Run state persisted (last_run_at, next_run_at)
    ↓
Repeat
```

## Persisted Scheduling State

The `scheduling` table stores, per agent:

| Column | Type | Notes |
|---|---|---|
| `agent_id` | TEXT PK / FK | Owning agent |
| `last_run_at` | TEXT (ISO UTC) | Last completed cycle (or null) |
| `next_run_at` | TEXT (ISO UTC) | Next scheduled run |
| `active` | INTEGER | Whether the agent is scheduled |
| `created_at` | TEXT (ISO UTC) | Record creation |
| `updated_at` | TEXT (ISO UTC) | Last update |

This state survives process restarts, enabling restart recovery.

## Topic Discovery — Fetch / Parse / Normalize

The discovery pipeline is:

```
fetch → parse → validate → normalize → de-dupe → persist → lifecycle
```

### `TopicSource` abstraction

```ts
interface TopicSource {
  readonly name: string;
  fetch(): Promise<DiscoveredItem[]>;
}
```

The scheduler/lifecycle never knows the concrete source type. RSS is the Phase 2B
source; GitHub, arXiv, or news APIs can plug in later without touching the lifecycle.

### `RssFeedSource`

- **HTTP fetching** via a first-party `fetchText` helper (`src/util/http.ts`) that
  enforces a finite timeout with `AbortController` (default 15s, configurable via
  `DISCOVERY_HTTP_TIMEOUT_MS`). No external networking framework.
- **Parsing** via `rss-parser` (a small, well-maintained, zero-native-dependency XML/RSS
  parser — the only new dependency).
- **Validation / normalization** in `normalizeRssItems`:
  - Missing/empty title → skipped (logged).
  - Missing/empty link → skipped (logged) — no canonical URL means no candidate.
  - Missing summary → empty string is retained; prefers `summary` → `contentSnippet` → `content`.
  - No parseable publication date → `publishedAt` undefined (never fabricated).
  - Duplicate links within a single feed → collapsed.
- `fetch()` never throws: any network, XML, or item-level failure returns an empty list. A
  single malformed feed/item never kills the discovery cycle.

### `LiveTopicDiscovery`

Implements the `TopicDiscovery` interface (`discover(agentId): Promise<TopicCandidate[]>`):

- Iterates every configured source.
- Per source: `try { items = await source.fetch() } catch { log; continue }` — one failing
  source never blocks the others.
- Normalizes `DiscoveredItem`s into `TopicCandidate`s (stamping `discoveredAt` from the clock).
- **In-cycle de-duplication** by canonical source URL (case-insensitive) with a normalized-title
  fallback.
- Returns `[]` if every source fails or none are configured. Never throws.

### Discovery Persistence

`AutonomousLifecycle` persists each discovered candidate to the `topics` table **in the
`discovered` state** before invoking the editorial engine. This is deliberate:

- `discovered ≠ reject ≠ publish`. A discovered topic is not an editorial decision.
- A repeated source item already persisted on a previous cycle is skipped
  (`TopicRepository.existsBySourceUrl`), preventing uncontrolled duplicate rows.

Distinguishing discovered-from-rejected-from-published becomes critical in Phase 2C.

## Restart Recovery

On application start, `scheduler.recover(agents.listAll())`:

- Reads all active scheduling records.
- Re-registers each agent with the scheduler.
- **Preserves the persisted `nextRunAt`** — a future next-run stays in the future; a past next-run becomes due immediately on the next `checkDue()`.

## Failure Handling

### Scheduler / lifecycle failures

A failed cycle is caught and isolated:

- The error is logged.
- The agent's next run is **still scheduled** (the scheduler never dies from a single bad cycle).
- Future cycles remain possible.

### Topic-source failures

| Failure | Behavior |
|---|---|
| No internet / DNS failure | `fetchText` throws → `RssFeedSource` logs and returns `[]`. |
| Timeout | `AbortController` aborts after `DISCOVERY_HTTP_TIMEOUT_MS` (default 15s) → returns `[]`. |
| HTTP 4xx / 5xx | `fetchText` throws on non-2xx → returns `[]`. |
| Malformed XML | `rss-parser` throws → returns `[]`. |
| Malformed item | normalized → skipped + logged → remaining items survive. |
| Empty feed | returns `[]`. |
| Duplicate item | collapsed in-feed and in-cycle; persisted duplicates skipped. |
| One source fails, others live | failing source skipped; others still contribute. |
| All sources fail | no candidates this tick; the scheduler continues. |

A source failure is "this source failed this tick," never "Sentinel AI died." Network requests
are always bounded by a finite timeout so the autonomous scheduler can never hang on a source.

## Graceful Shutdown

On `SIGINT`/`SIGTERM`:

- `scheduler.stop()` clears the polling timer.
- The HTTP server closes.
- The database closes cleanly.
- No dangling timers remain.

## Data Model

### agents
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Agent ID returned to evaluator |
| `persona_name` | TEXT | Persona display name |
| `persona_domain` | TEXT | Persona niche/domain |
| `status` | TEXT | `active` / `paused` / `error` |
| `config` | TEXT (JSON) | Free-form agent config |
| `created_at` | TEXT (ISO UTC) | Creation timestamp |

### posts
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Unique post ID |
| `agent_id` | TEXT FK | Owning agent |
| `created_at` | TEXT (ISO UTC) | Publication time |
| `text` | TEXT | Post body |
| `rationale` | TEXT | Editorial rationale |
| `sources` | TEXT (JSON array) | Source URLs |

Indexed by `(agent_id, created_at DESC)` for newest-first feed reads.

### topics (rejection / decision trail)
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Unique decision record |
| `agent_id` | TEXT FK | Owning agent |
| `title` / `summary` | TEXT | Candidate topic |
| `source_url` / `source_name` | TEXT | Origin |
| `discovered_at` | TEXT (ISO UTC) | Discovery time |
| `source_published_at` | TEXT (ISO UTC), nullable | Source publication time, if provided |
| `decided_at` | TEXT (ISO UTC), nullable | Decision time (`null` while `discovered`) |
| `decision` | TEXT | `discovered` (Phase 2B) / `publish` / `reject` |
| `reasoning` | TEXT (JSON) | Structured scoring / reject reason |

Indexed by `(agent_id, discovered_at DESC)` and `(agent_id, source_url)` (discovery de-dup).

### scheduling
| Column | Type | Notes |
|---|---|---|
| `agent_id` | TEXT PK / FK | Owning agent |
| `last_run_at` | TEXT (ISO UTC) | Last completed cycle (or null) |
| `next_run_at` | TEXT (ISO UTC) | Next scheduled run |
| `active` | INTEGER | Whether the agent is scheduled |
| `created_at` | TEXT (ISO UTC) | Record creation |
| `updated_at` | TEXT (ISO UTC) | Last update |

## API Contract

```
POST /api/agent/init
Body: { "persona": { "name": "Ada", "domain": "AI Security" } }
201: { "agentId": "abc-123" }

GET /api/agent/feed?agentId=abc-123
200: { "posts": [ { "id", "createdAt", "text", "rationale", "sources" } ] }
     (newest first; empty array if none)
400: missing agentId
404: unknown agentId
```

## Key Architectural Decisions

1. **Node.js + TypeScript + Express.** Fast to develop, well-known, and sufficient for a solo hackathon.
2. **SQLite via Node's built-in `node:sqlite` (`DatabaseSync`).** Zero-dependency, no native compilation issues on Windows, durable, and exactly matches the blueprint's recommended default.
3. **Feed endpoint is a pure reader.** Generation is never triggered by a GET. This preserves the autonomous-only lifecycle the judges expect.
4. **`init` never generates posts synchronously.** It only creates the agent record and registers it with the scheduler. Publishing happens on the scheduler's clock.
5. **Interfaces before implementation.** The lifecycle, discovery, editorial, generator, and memory seams are defined as interfaces so later phases plug in cleanly.
6. **Environment variables for all configuration.** `.env.example` documents them; no secrets are committed.
7. **Rejection trail is a first-class table.** `topics` records every considered topic and its decision.
8. **Scheduler state is persisted in SQLite** (`scheduling` table) — last run, next run, active flag survive restarts; recovery preserves the persisted next-run rather than resetting it.
9. **A clock abstraction** (`Clock`) lets the scheduler be tested deterministically with a fake clock — no flaky real-time delays.
10. **Failure isolation** — a failed cycle is caught, logged, and the next run is still scheduled; the scheduler never dies from a single bad cycle.
11. **Duplicate-loop prevention** — `registerAgent` is idempotent and `start()` is a no-op if already running.
12. **`TopicSource` abstraction** — the lifecycle never cares whether a candidate came from RSS, GitHub, arXiv, or a future source; it only sees normalized candidates.
13. **RSS as the initial live source** — free, stable, pollable, low rate-limit risk; one reliable end-to-end pipeline before source diversity. `rss-parser` handles XML; a first-party `fetchText` handles HTTP with a finite timeout.
14. **Discovery ≠ editorial decision.** Discovered candidates are stored in the `discovered` state (never `publish`/`reject`), so a single trail row can later be decided by the editorial engine.
15. **Basic deterministic source-level deduplication** — canonical source URL (case-insensitive) + normalized-title fallback, both within a cycle and against already-persisted sources. No semantic/embedding dedup yet.

## Not Implemented (Next Phases)

- Editorial scoring engine (novelty, relevance, importance, freshness, persona fit).
- Content generation + rationale.
- Memory / duplicate detection (exact + semantic).
- Publishing cadence / cooldown logic (posts are never created yet).
- Deployment configuration for a long-running host.
- Monitoring / heartbeat dashboard.
- Additional topic-source types beyond RSS.

## Testing

- `npm test` — Vitest suite (**64 tests**): API contract, repositories + persistence, config parsing, scheduler behavior, scheduling persistence, restart recovery, failure isolation, RSS source (fetch/parse/normalize/malformed/empty), live discovery (multi-source, dedupe, failure isolation), and lifecycle persistence (discovered state, no duplicate source rows, editorial stub → no posts).
- Discovery tests use **injected fake** HTTP/parser sources — **no dependency on real external websites**, so the suite is never flaky.
- `npm run typecheck` — strict TypeScript check.
- Uses an in-memory SQLite database for isolation; a fake clock drives scheduler/discovery deterministically.

## Running

```bash
cp .env.example .env   # optional; defaults work for local dev
# Configure a live source, e.g.:
#   DISCOVERY_RSS_FEEDS=https://hnrss.org/frontpage
#   DISCOVERY_HTTP_TIMEOUT_MS=15000
npm install
npm run dev            # start API with tsx watch
npm test               # run tests
npm run typecheck      # strict type-check
```