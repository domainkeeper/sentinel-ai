# Sentinel AI

**Sentinel AI** is an autonomous AI/technology persona for **Problem Statement 3 — Autonomous AI Creator**.

The system is designed around one constraint: the evaluator calls `POST /api/agent/init` exactly once, then polls `GET /api/agent/feed` for ~48 hours. After initialization, Sentinel AI must discover live topics, decide what to publish, write in a consistent editorial voice, remember what it has published, and keep publishing over time — with no further human prompts.

**Sentinel AI is the project/system name.** The runtime persona is configurable and supplied through the API, not hardcoded.

---

## Status: Phase 2B — Live Topic Discovery

This repository currently contains:

- ✅ Persistent SQLite storage (agents, posts, topic decisions, scheduling state)
- ✅ The exact API contract (`init` + `feed`)
- ✅ The autonomous lifecycle + scheduler (per-agent, persisted next-run, restart recovery, failure isolation, graceful shutdown)
- ✅ **Live topic discovery** from real RSS feeds through a clean `TopicSource` abstraction
- ✅ Discovery persistence: candidates are stored in the `topics` trail in a `discovered` state (distinct from `publish`/`reject`)
- ✅ Graceful failure handling, finite HTTP timeouts, and basic source-level deduplication
- ✅ The lifecycle seam: interfaces for discovery, editorial engine, generator, and memory (discovery is real; the rest are still no-op stubs)
- ✅ Configuration foundation (`.env.example`, no secrets)
- ✅ Test suite (64 tests) + strict typecheck

**Not yet implemented:** editorial scoring, LLM generation, and memory. Discovery now finds real live topics and persists them as `discovered`, but the editorial engine (Phase 2C) still rejects everything, so **autonomous publishing does not exist yet** — a scheduler cycle discovers topics but creates no posts.

See [docs/architecture.md](docs/architecture.md) for full details.

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
12. **Discovery is not editorial.** Discovered candidates are persisted to `topics` in a `discovered` state (`decided_at` null, never `publish`/`reject`). The distinct states `discovered ≠ rejected ≠ published` become critical in Phase 2C.
13. **Basic, deterministic source-level deduplication** — identical source URLs (and a normalized-title fallback) are collapsed within a cycle and against already-persisted sources. No semantic/embedding dedup yet (that is the memory phase).

---

## Documentation

- [docs/architecture.md](docs/architecture.md) — current architecture, data model, decisions, and what's next.
- [autonomous-ai-creator-blueprint.md](autonomous-ai-creator-blueprint.md) — the master plan this project follows.
- [PROMPTS.md](PROMPTS.md) — AI usage log (hackathon requirement).

---

## License

MIT