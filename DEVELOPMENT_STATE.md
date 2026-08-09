# Sentinel AI — Development State

> This is the permanent handoff / state snapshot for Sentinel AI. Read it at the
> start of every AI-assisted development session. It complements (does not
> replace) `PROMPTS.md` (the historical AI usage log). If code and docs disagree,
> trust the code and RE-MATCH the docs.

## Current Phase

Phase 2.4 — Premium, persona-agnostic Editorial Frontend (COMPLETE). Backend Phase 3A complete; Phase 2.1 foundation and Phase 2.2 feed experience complete.

> IMPORTANT product correction applied in this session: Sentinel is an autonomous **editorial / content system** with a configurable persona — **not a cybersecurity product**. The UI no longer reads as a dark monitoring terminal; it is a warm, light, editorial-premium platform whose accent is person-agnostic.

## Project Identity

Sentinel AI (do NOT rename; do NOT call it Aegis). The runtime persona is
supplied via `POST /api/agent/init` — never hardcoded.

## Hackathon Problem

Problem Statement 3 — Autonomous AI Creator. Evaluator calls `POST /api/agent/init`
exactly once, then only polls `GET /api/agent/feed` for ~48 hours. No further prompts.

## Current Objective

Phase 2.4 (complete): redesign of the judge-facing frontend as a **persona-agnostic, editorial, light** product — warm-paper surfaces, ink text, a single adaptive accent, serif editorial display type (Fraunces) paired with Inter + JetBrains Mono, and a light mesh gradient atmosphere (soft color pools, ruled grid, grain, soft light sweep; reduced-motion aware). No animation library added — effects are pure CSS + small hooks. NO data is faked: views that depend on the not-yet-implemented `/status` and `/topics` endpoints stay honest ("Awaiting status feed", "Phase 2.3"). Copy was reframed platform-first ("one agent · every persona") while Activity / Editorial / Persona / Health views remain presentation-only, and all routing/error/empty states were preserved and verified.

Also fixed the pre-existing "blank screen" defect root causes: (1) the canonical layout-route pattern (single `<Routes>` + layout `<Route>` with `<Outlet/>` — no nested second `<Routes>`), and (2) `Magnetic`/`AmbientBackground` calling `window.matchMedia` unguarded, which threw in environments where the API is missing (e.g. Node/jsdom) and took down rendering. Both are now defensively guarded, so a failing view degrades to a styled boundary instead of a blank app.

The realness rules carry through from Phase 2.2 (presentation-only, never triggers generation) and Phase 3A (backend complete, not redone).

## Implemented

### Backend (Phase 3A complete — unchanged in Phase 2.2)
- Persistent SQLite storage: `agents`, `posts`, `topics`, `scheduling`.
- Exact API contract (`POST /api/agent/init`, `GET /api/agent/feed`).
- Autonomous scheduler & lifecycle with restart recovery and failure isolation.
- Live topic discovery from curated RSS feeds (`TopicSource`, `RssFeedSource`, `LiveTopicDiscovery`, timeout, deduplication).
- Deterministic Editorial Decision Engine (`DeterministicEditorialEngine`) scoring across relevance, freshness, novelty, source quality, and persona fit against threshold (default 60), persisting structured reasoning and decisions in the `topics` audit trail.
- LLM Content Generation + Rationale (`LlmContentGenerator`) with Gemini/OpenAI/mock providers, prompt injection defense, validation, and timeouts.
- Persistent Memory (`SqliteAgentMemory`): exact + near-duplicate Jaccard detection, agent isolation, survives restarts.
- Publishing Policy (`PublishingPolicy`): cooldown and sliding-window frequency caps.
- Autonomous Publication & Persistence: validated posts persisted to SQLite, served newest-first by the feed (pure reader).

### Frontend (`frontend/`)
- **Phase 2.1 — Foundation:** design-system tokens, responsive layout, routing, thin API/data layer, placeholder views.
- **Phase 2.2 — Feed experience (complete):**
  - `FeedList` + `PostCard`: fetch real feed, render newest-first, timestamp, text, rationale (`<details>`), source links (safe, `noopener noreferrer`, never raw HTML), and a "Read post" link.
  - `PostDetailPage` + `PostDetailView`: full text, timestamp, rationale, stacked sources; route `/feed/:postId?agentId=...`; reuses the feed response (no new endpoint).
  - Data layer hardened (`src/lib/api.ts`): typed `ApiError` (timeout/network/http/invalid), fetch timeouts, non-2xx handling, malformed-response guard.
  - `useAgentId` reads `?agentId=` from the URL (read-only). `AgentConnect` is a minimal read-only ID entry — never calls init/generate.
  - States (`States.tsx` + `feed.css`): live "pulse" loading, graceful empty ("no posts yet" — not an error), friendly error with Retry.
  - Live polling (`refreshIntervalMs`, default 60s) silently refreshes without blanking existing posts.
  - Automated tests (`src/__tests__/feed.test.tsx`, 9 tests).
- **Phase 2.4 — Editorial premium redesign (complete):**
  - Design system v3: warm-paper light theme (tokens.css) — paper surfaces, ink text, one adaptive accent (indigo→violet→teal), editorial serif display (Fraunces) + Inter body + JetBrains Mono data, `prefers-reduced-motion` fallback.
  - `AmbientBackground`: light mesh atmosphere (pastel color pools, ruled grid, dots, film grain, soft light sweep, pointer spotlight) — no dark monitoring-room + no animation library.
  - Premium primitives: `Reveal`/`useInView`, `GradientText`, `SpotlightCard`, `PremiumButton`, `StatusIndicator`, `Eyebrow`, `LifecycleTimeline`, skeleton states.
  - Page transitions (CSS `page-enter` keyed on route + scroll-to-top on navigate) + top-level `ErrorBoundary` in `main.tsx` + route-scoped `RouteBoundary`.
  - Editorial `OverviewPage` (hero + mission + operative model + principles + real recent-publications preview) and an editorial PostDetail reading experience (serif lead, reading-width column, sourced rationale callout).
  - Activity / Editorial / Persona / Health views restyled presentation-only and copy reframed platform-first; honest labels where live data is pending (no fabricated metrics).
  - Persona visibility: Persona page now explicitly distinguishes Product = Sentinel from Persona = configurable identity.
  - Blank-screen fixes: guaranteed layout-route routing + guards for `window.matchMedia` in `Magnetic` and `AmbientBackground` (previously unguarded → crash in non-browser envs).
  - Automated tests: 22/22 passing (feed + navigation/route-reliability suites).

## Not Implemented (intentionally deferred)

- External social media integrations (LinkedIn / X API publishing; simulated via SQLite + feed per hackathon rules).
- Live Autonomous Activity / Editorial trail / System Health metrics (depend on backend `/status` and `/topics` endpoints — not yet added; views are designed and labelled awaiting them).

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
    ↓
Frontend (Vite + React + TS) : FeedList → PostCard → PostDetailView (reuses feed by id)
```

## Important Concurrent Invariants

- Feed endpoint (`GET /api/agent/feed`) is a **pure reader**; it never triggers discovery, generation, or scheduling.
- `init` does **not** synchronously generate posts.
- The scheduler owns autonomous execution; one tick == one discovery & editorial & generation & publishing cycle.
- Editorial engine is deterministic, explainable, and testable without LLMs.
- Memory checks are agent-scoped (strict isolation).
- No secrets committed; SQLite (`node:sqlite`) stays the persistence layer.
- LLM failures/timeouts/rate limits do not crash the autonomous scheduler.
- The frontend is presentation-only: it never triggers generation, discovery, or publishing.

## Current Data Model

**agents** `id` PK, `persona_name`, `persona_domain`, `status`, `config` (JSON), `created_at`.
**posts** `id` PK, `agent_id` FK, `created_at`, `text`, `rationale`, `sources` (JSON). Feed reads newest-first by `(agent_id, created_at DESC)`.
**topics** (rejection/decision trail). **scheduling**.

## Current AI Components

- **Scheduler** — ✅ (`AutonomousScheduler`). **Lifecycle** — ✅. **Discovery** — ✅. **Editorial** — ✅. **Generator** — ✅. **Memory** — ✅ (`SqliteAgentMemory`). **Policy** — ✅ (`PublishingPolicy`).

## Tests

- Backend: `npm test` **74/74 pass** (11 files); `npm run typecheck`; `npm run build` all pass.
- Frontend: `npm test` **22/22 pass** (feed + navigation suites); `npm run typecheck` (`tsc -b`); `npm run build` (`tsc -b` + `vite build`, ~63 kB gzipped JS) all pass.

## Important Architectural Decisions

1. Node.js + TypeScript + Express; SQLite via Node's built-in `node:sqlite`.
2. Feed = pure reader; scheduler owns autonomous execution.
3. Deterministic Jaccard token similarity for near-duplicate detection against recent SQLite posts.
4. Agent isolation across memory and publishing policy checks.
5. Cooldown and sliding window limits to prevent bursty publications.
6. Frontend is a separate Vite + React + TypeScript app in `frontend/`, independently deployable, presentation-only.
7. Phase 2.2: feed wired to the existing `GET /api/agent/feed` contract; post detail reuses it by id — no new backend endpoints in this phase.
8. Phase 2.4: animations are pure CSS + two small hooks (`useInView`) — no runtime animation dependency; reduced-motion is respected app-wide.
9. Product identity: the core UI is **Sentinel the platform** (persona-agnostic); the persona is a configurable identity shown on the Persona page. The frontend is light/editorial, not a dark cybersecurity console.

## Known Issues

- Frontend `api.ts` still exports `getStatus`/`getEditorialTrail` types that the backend does not yet serve (Phase 2.3 will add the endpoints); Activity/Editorial/Health views are designed but show "Awaiting" until then.
- Frontend tests currently rely on `globals: true` in the vitest config (for Testing Library auto-cleanup).
- Nothing WIP; all verified passing.

## Deferred Work

- Deployment hardening / production process-manager configuration for the backend.
- Frontend deployment (static host) and backend deployment (always-on host). See SENTINEL_BLUEPRINT_2.0 B25 phases 2.6–2.9.

## Exact Next Phase

Phase 2.3 — Autonomous Intelligence Visualization: Activity + Editorial Intelligence views, which depend on adding small backend `GET /api/agent/status` and `GET /api/agent/topics` endpoints (Blueprint A6). Do NOT implement until Phase 2.2 is done (it is).

## Last Completed Session

Session 10 — Phase 2.4 round 2: persona-agnostic editorial redesign + zero-blank-screen/routing fixes (preceded by Session 9 Phase 2.4 premium polish, Session 8 Phase 2.2, Session 7 Phase 2.1, Session 6 Phase 3A).

## Last Verified Commit

Working tree contains Phase 3A (backend), Phase 2.1 (foundation), Phase 2.2 (feed), Phase 2.4/2.4r2 (editorial premium). Phase 2.5 (backend integration hardening) was NOT done this session. All verified: backend 74/74 + typecheck + build; frontend 22/22 + typecheck + build.