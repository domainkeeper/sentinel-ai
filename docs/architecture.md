# Sentinel AI — Architecture

## Project Identity

**Sentinel AI** is the project/system name. The runtime AI persona is **not** hardcoded — it is supplied by the evaluator via `POST /api/agent/init` (e.g. `{ "persona": { "name": "Ada", "domain": "AI Security" } }`).

## Problem Context

Problem Statement 3 — Autonomous AI Creator. The evaluator calls `POST /api/agent/init` exactly once, then only polls `GET /api/agent/feed` for ~48 hours. The system must become autonomous immediately after initialization: discover live topics, decide what to publish, write in a consistent voice, remember prior content, and continue publishing over time — all without further human prompts.

## Current Phase (Phase 2A — Autonomous Lifecycle + Scheduler)

This repository currently implements:

- Persistent SQLite storage (agents, posts, topic decisions, **scheduling state**).
- The exact API contract (`init` + `feed`).
- **The autonomous lifecycle + scheduler**: per-agent scheduling, persisted next-run, restart recovery, failure isolation, and graceful shutdown.
- **Initialization wires the agent into the autonomous lifecycle** (registers it with the scheduler).
- The lifecycle seam: interfaces for discovery, editorial engine, generator, and memory — **no-op stubs in this phase**.

**Autonomous publishing is NOT yet implemented.** A scheduler cycle completes without creating posts. Live topic discovery, editorial scoring, LLM generation, and memory are stubs.

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
| `AutonomousLifecycle` | ✅ Implemented | Orchestrates one cycle: discovery → editorial → generation → memory. |
| Topic Discovery | 🔲 Stub | `NoopTopicDiscovery` returns no candidates. |
| Editorial Decision | 🔲 Stub | `NoopEditorialEngine` rejects everything. |
| Content Generation | 🔲 Stub | `NoopContentGenerator` (never reached in Phase 2A). |
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
AutonomousLifecycle.tick(agent)  ← discovery → editorial → generation → memory
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

## Restart Recovery

On application start, `scheduler.recover(agents.listAll())`:

- Reads all active scheduling records.
- Re-registers each agent with the scheduler.
- **Preserves the persisted `nextRunAt`** — a future next-run stays in the future; a past next-run becomes due immediately on the next `checkDue()`.

## Failure Handling

A failed cycle is caught and isolated:

- The error is logged.
- The agent's next run is **still scheduled** (the scheduler never dies from a single bad cycle).
- Future cycles remain possible.

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

### topics
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Unique decision record |
| `agent_id` | TEXT FK | Owning agent |
| `title` / `summary` | TEXT | Candidate topic |
| `source_url` / `source_name` | TEXT | Origin |
| `discovered_at` / `decided_at` | TEXT (ISO UTC) | Discovery + decision time |
| `decision` | TEXT | `publish` / `reject` |
| `reasoning` | TEXT (JSON) | Structured scoring / reject reason |

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

## Not Implemented (Next Phases)

- Live topic discovery (RSS/news APIs).
- Editorial scoring engine (novelty, relevance, importance, freshness, persona fit).
- LLM content generation + rationale.
- Memory / duplicate detection (exact + semantic).
- Publishing cadence / cooldown logic.
- Deployment configuration for a long-running host.
- Monitoring / heartbeat dashboard.

## Testing

- `npm test` — Vitest suite (35 tests): API contract, repositories + persistence, config parsing, scheduler behavior, scheduling persistence, restart recovery, failure isolation.
- `npm run typecheck` — strict TypeScript check.
- Uses an in-memory SQLite database for isolation; a fake clock drives the scheduler deterministically.

## Running

```bash
cp .env.example .env   # optional; defaults work for local dev
npm install
npm run dev            # start API with tsx watch
npm test               # run tests
npm run typecheck      # type-check