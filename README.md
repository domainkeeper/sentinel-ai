# Sentinel AI

**Sentinel AI** is an autonomous AI/technology persona for **Problem Statement 3 — Autonomous AI Creator**.

The system is designed around one constraint: the evaluator calls `POST /api/agent/init` exactly once, then polls `GET /api/agent/feed` for ~48 hours. After initialization, Sentinel AI must discover live topics, decide what to publish, write in a consistent editorial voice, remember what it has published, and keep publishing over time — with no further human prompts.

**Sentinel AI is the project/system name.** The runtime persona is configurable and supplied through the API, not hardcoded.

---

## Status: Foundation Phase

This repository currently contains the **technical foundation**:

- ✅ Persistent SQLite storage (agents, posts, topic decisions)
- ✅ The exact API contract (`init` + `feed`)
- ✅ The lifecycle seam: interfaces for scheduler, discovery, editorial engine, generator, and memory
- ✅ Configuration foundation (`.env.example`, no secrets)
- ✅ Test suite (19 tests) + strict typecheck

**Not yet implemented:** the autonomous scheduler, live topic discovery, editorial scoring, LLM generation, and memory. These are defined as interfaces and will be implemented in subsequent phases. Autonomous publishing does **not** exist yet.

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

The **feed endpoint is a pure reader** — it never triggers generation. Publishing is strictly the domain of the autonomous loop (scheduler), per the evaluation's "no further prompts" premise.

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
  agent/          # Autonomous lifecycle interfaces
  api/            # HTTP routes + validation
  config/         # Environment configuration
  db/             # SQLite connection + schema
  models/         # Domain types
  repositories/   # Data access
  services/       # Application services
  util/           # Helpers
  app.ts          # Composition root
  index.ts        # Entrypoint
tests/            # Vitest suite
docs/             # Architecture docs
```

---

## Architecturally Significant Decisions

1. **SQLite via Node's built-in `node:sqlite`** — zero-dependency, durable, no native-compile issues on Windows; matches the blueprint's recommended default.
2. **`init` never generates posts synchronously.**
3. **Feed is a pure reader; generation is scheduler-only.**
4. **Interfaces before implementation** — later phases plug into defined seams.
5. **Rejection trail is a first-class table** (`topics`) for editorial-transparency.

---

## Documentation

- [docs/architecture.md](docs/architecture.md) — current architecture, data model, decisions, and what's next.
- [autonomous-ai-creator-blueprint.md](autonomous-ai-creator-blueprint.md) — the master plan this project follows.
- [PROMPTS.md](PROMPTS.md) — AI usage log (hackathon requirement).

---

## License

MIT