# Sentinel AI — Architecture

## Project Identity

**Sentinel AI** is the project/system name. The runtime AI persona is **not** hardcoded — it is supplied by the evaluator via `POST /api/agent/init` (e.g. `{ "persona": { "name": "Ada", "domain": "AI Security" } }`).

## Problem Context

Problem Statement 3 — Autonomous AI Creator. The evaluator calls `POST /api/agent/init` exactly once, then only polls `GET /api/agent/feed` for ~48 hours. The system must become autonomous immediately after initialization: discover live topics, decide what to publish, write in a consistent voice, remember prior content, and continue publishing over time — all without further human prompts.

## Current Phase (Foundation)

This repository currently implements the **foundation phase**:

- Persistent storage (SQLite) with agents, posts, and topic-decision tables.
- The exact API contract (`init` + `feed`).
- The lifecycle seam: interfaces for the scheduler, discovery, editorial engine, generator, and memory that later phases will implement.
- A test suite and configuration foundation.

**Autonomous publishing is NOT yet implemented.** The scheduler, live topic discovery, editorial reasoning, LLM content generation, and memory are stubbed as interfaces only.

## Architecture Diagram

```
                       ┌─────────────────────┐
                       │   Init Endpoint      │
                       │  POST /api/agent/init│
                       └──────────┬───────────┘
                                  │ creates
                                  ▼
                       ┌─────────────────────┐
                       │   Agent Record        │  (SQLite: agents)
                       │ (persona + config)    │
                       └──────────┬───────────┘
                                  │ starts (foundation: interface only)
                                  ▼
        ┌───────────────────────────────────────────┐
        │              Autonomous Loop                │  Scheduler interface
        │        (scheduler → discovery → decision →  │  (NOT implemented yet)
        │         generation → memory → store)        │
        └───────────────────────────────────────────┘
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
| `POST /api/agent/init` | ✅ Implemented | Validate persona, create agent record (persistent), return `agentId`. Does **not** generate posts. |
| `GET /api/agent/feed` | ✅ Implemented | Pure read of persisted posts, newest-first. Never triggers generation. |
| Repositories | ✅ Implemented | `agents`, `posts`, `topics` — SQLite-backed CRUD + queries. |
| Scheduler | 🔲 Interface only | `src/agent/lifecycle.ts` — `Scheduler` interface. |
| Topic Discovery | 🔲 Interface only | `src/agent/discovery.ts` — `TopicDiscovery` interface. |
| Editorial Decision | 🔲 Interface only | `src/agent/editorial.ts` — `EditorialDecisionEngine` interface. |
| Content Generation | 🔲 Interface only | `src/agent/generator.ts` — `ContentGenerator` interface. |
| Memory | 🔲 Interface only | `src/agent/memory.ts` — `AgentMemory` interface. |

## Project Structure

```
sentinel-ai/
├─ src/
│  ├─ agent/            # Autonomous lifecycle interfaces (discovery, editorial, generator, memory, lifecycle)
│  ├─ api/              # HTTP routes + validation
│  ├─ config/           # Environment configuration
│  ├─ db/               # SQLite connection + schema
│  ├─ models/           # Domain types (Agent, Post, Topic, Persona)
│  ├─ repositories/     # Data access (agents, posts, topics)
│  ├─ services/         # Application services (agent init, feed read)
│  ├─ util/             # ID / timestamp helpers
│  ├─ app.ts            # Composition root (Express app)
│  └─ index.ts          # Entrypoint
├─ tests/               # Vitest suite
├─ docs/architecture.md # This document
├─ .env.example         # Environment template (no secrets)
├─ autonomous-ai-creator-blueprint.md  # Master plan (Claude)
├─ PROMPTS.md           # AI usage log
└─ README.md
```

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
2. **SQLite via Node's built-in `node:sqlite` (`DatabaseSync`).** Zero-dependency, no native compilation issues on Windows, durable, and exactly matches the blueprint's recommended default. `node:sqlite` is experimental in Node 24 but stable enough for this scale.
3. **Feed endpoint is a pure reader.** Generation is never triggered by a GET. This preserves the autonomous-only lifecycle the judges expect.
4. **`init` never generates posts synchronously.** It only creates the agent record. Publishing happens on the scheduler's clock (once implemented).
5. **Interfaces before implementation.** The lifecycle, discovery, editorial, generator, and memory seams are defined as interfaces so later phases plug in cleanly without rework.
6. **Environment variables for all configuration.** `.env.example` documents them; no secrets are committed.
7. **Rejection trail is a first-class table.** `topics` records every considered topic and its decision, enabling the "considered and rejected" transparency the blueprint prioritizes.

## Not Implemented (Next Phases)

- Scheduler / background worker (persisted next-run state, restart resilience).
- Live topic discovery (RSS/news APIs).
- Editorial scoring engine (novelty, relevance, importance, freshness, persona fit).
- LLM content generation + rationale.
- Memory / duplicate detection (exact + semantic).
- Publishing cadence / cooldown logic.
- Deployment configuration for a long-running host.
- Monitoring / heartbeat dashboard.

## Testing

- `npm test` — Vitest suite (19 tests): API contract, repositories + persistence, config parsing.
- `npm run typecheck` — strict TypeScript check.
- Uses an in-memory SQLite database for isolation.

## Running

```bash
cp .env.example .env   # optional; defaults work for local dev
npm install
npm run dev            # start API with tsx watch
npm test               # run tests
npm run typecheck      # type-check