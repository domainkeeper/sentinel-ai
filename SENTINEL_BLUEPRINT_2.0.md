# Sentinel AI — Blueprint 2.0
### Phase 2: Architecture + Premium Frontend & Deployment Plan

> **Note on sourcing**: This document plans against the capabilities described as complete in this conversation and the original blueprint (`autonomous-ai-creator-blueprint.md`). It does not assume or invent specific filenames, test counts, commit hashes, or implementation behavior beyond what has been stated. Wherever a decision depends on actual repository state, that dependency is called out explicitly as something to verify before proceeding.
>
> This is **Blueprint 2.0** — the next-phase companion to the original ~26-section architecture document, which remains the foundational/historical reference and is not replaced by this one. Blueprint 1.0 defined *how Sentinel thinks and acts*. This document defines *how Sentinel is seen, deployed, and kept alive.*

---

## PART A — ARCHITECTURE

### A1. Purpose

This part describes the architecture of Sentinel AI's next phase: the addition of a judge-facing frontend, a real deployment, and production hardening around the already-completed autonomous backend. It exists alongside — not in place of — the original architecture document, which remains the authoritative record of the foundational design (persona, discovery, editorial engine, memory, publishing logic).

### A2. Relationship to the Original Architecture

The original blueprint defined *how the agent thinks and acts*: discovery strategy, editorial scoring, memory approach, publishing cadence, rationale generation, and failure handling. None of that is revisited or superseded here. This document assumes all of it is implemented and correct, and describes only what sits *around* it: how a human (judge) observes it, and how it's deployed and kept alive.

Where this document and the original ever appear to conflict, the original blueprint's backend-behavior decisions take precedence — this phase adapts to the backend, not the reverse.

### A3. Current Backend Architecture (as understood)

Per stated project status, the backend implements the original blueprint's five-component design:

- **Init endpoint** (`POST /api/agent/init`) — one-time agent creation.
- **Autonomous loop/scheduler** — persisted state, restart recovery, failure isolation per tick.
- **Topic discovery** — live RSS/source ingestion.
- **Editorial decision engine** — selection and rejection of candidate topics.
- **Persona & rationale generation** — LLM-based content generation with per-post rationale.
- **Memory/store** — persistent posts, duplicate prevention, presumably backing continuity.
- **Feed endpoint** (`GET /api/agent/feed?agentId=...`) — read-only, newest-first.

Additional stated hardening already in place: prompt-injection defenses on ingested content, environment-based secret handling, output validation, and an existing automated test suite.

This phase treats all of the above as a stable foundation and does not modify it except where a specific, minimal, additive need is identified (a status/activity endpoint — see A6).

### A4. Completed Autonomous Lifecycle

Unchanged from the original design:

```
INITIALIZE (once)
     │
     ▼
DISCOVER ──▶ EVALUATE ──▶ DECIDE ──▶ GENERATE ──▶ REMEMBER ──▶ PUBLISH
     ▲                                                              │
     └──────────────────────── repeat autonomously ◀────────────────┘
```

This phase's job is to make each of these six stages *legible* to an outside observer without altering how any of them function internally.

### A5. Frontend Architecture

The frontend is a separate application, communicating with the existing backend exclusively through its public API (plus, if added per A6, a lightweight status endpoint). It holds no independent business logic about discovery, editorial judgment, or generation — it is a presentation layer over data the backend already produces and persists.

Conceptual structure:

- **Views** corresponding to the Information Architecture in Part B (Overview, Feed, Post Detail, Activity, Editorial Intelligence, Persona, System Health).
- **A thin data layer** responsible for fetching, caching briefly, and polling the backend — no state beyond what's needed to render the current view.
- **A design system layer** (tokens, shared components) implementing the visual language described in Part B.

The frontend should be independently deployable and independently restartable without any effect on the running agent — this separation is deliberate and is what keeps frontend iteration from ever risking the 48-hour autonomous run.

### A6. Frontend / Backend Boundary

The boundary is the existing public API, plus one likely addition:

| Concern | Existing | Addition needed? |
|---|---|---|
| Initialize agent | `POST /api/agent/init` | No |
| Read published posts | `GET /api/agent/feed` | No |
| Current operational status / last cycle / next cycle | Not confirmed to exist | **Likely yes** — a lightweight `GET /api/agent/status` (or similar) is recommended so the frontend isn't forced to infer liveness purely from feed timestamps |
| Considered-but-rejected topics | Not confirmed to exist as a queryable resource | **Possibly** — if rejection reasoning isn't already persisted and exposed, this is the second-most-likely small backend addition |

Any addition here should be additive only — new, optional-to-consume endpoints, never a change to the existing two-endpoint contract the evaluator depends on.

### A7. API Integration

The frontend treats the backend as a read-mostly service post-init:

- Init is called at most once, deliberately, outside of normal judge-facing frontend flow (or already done ahead of time) — the frontend should not expose a casual "re-initialize" action.
- Feed and (if added) status/activity data are fetched via polling on a modest interval, with client-side error handling, timeouts, and retry-with-backoff for transient failures.
- No endpoint the frontend calls should have a side effect on the agent's behavior — this preserves the "evaluator never sends another prompt" property the entire system is built around, and extends it to "neither does the frontend, on the judge's behalf."

### A8. State / Data Flow

```
Backend (autonomous, always-on)
   │  persists to
   ▼
Store (posts, rejections if exposed, agent state)
   │  read via HTTPS/API
   ▼
Frontend data layer (polling, caching in-memory only)
   │  renders into
   ▼
Views (Feed, Activity, Editorial Intelligence, etc.)
```

State flows one direction only: backend → frontend. The frontend never writes agent state. This keeps the frontend's failure modes strictly cosmetic (a broken view) rather than something that could ever corrupt or interrupt the autonomous process.

### A9. Deployment Architecture

```
                    USER / JUDGE
                         │
                         ▼
                ┌─────────────────┐
                │  Sentinel UI     │  (separately hosted,
                │  (frontend)      │   e.g. Vercel/Netlify)
                └────────┬────────┘
                         │ HTTPS / REST
                         ▼
                ┌─────────────────┐
                │  Sentinel        │  (always-on host,
                │  Backend         │   e.g. Railway/Fly.io/
                │  (API + agent    │   Lightsail — see B10)
                │   loop)          │
                └────────┬────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌────────────┐ ┌─────────────┐ ┌─────────────┐
   │ Persistent  │ │ External    │ │ External    │
   │ store       │ │ LLM         │ │ RSS / live   │
   │ (SQLite on  │ │ provider    │ │ topic        │
   │ volume)     │ │ API         │ │ sources      │
   └────────────┘ └─────────────┘ └─────────────┘
```

Frontend and backend are deployed to separate platforms deliberately (see B11) — this isolates the always-on reliability requirement to only the component that genuinely needs it.

### A10. Database / Persistence

Unchanged from the original blueprint's recommendation: SQLite on a persistent volume, sized appropriately for a single agent's 48-hour output. No new database technology is introduced in this phase. The one deployment-specific requirement is confirming the chosen host provides genuinely persistent (not ephemeral) disk for that SQLite file — this is the most common way a "complete" persistence layer silently fails once deployed.

### A11. Process Management

The backend process (API + autonomous loop, assumed to run together per the original architecture's simplicity recommendation) relies on the hosting platform's own crash-restart supervision rather than a custom process manager. The critical architectural property this phase must preserve: **on any restart, the scheduler must resume from persisted state, not reset to a fresh cycle.**

### A12. 48-Hour Operation

The operational contract for this phase is unchanged from the original: initialize once, then the system runs the full discover→evaluate→decide→generate→remember→publish cycle unattended, indefinitely, for the evaluation window. This phase's architectural contribution is purely observational — the status/activity surface (A6) exists so this contract's fulfillment can be *verified* by a human without interfering with it.

### A13. Security (architecture-level)

CORS scoped to the known frontend origin (and the evaluator's access pattern, once confirmed), no re-rendering of raw unsanitized source content as HTML on the frontend, and generic (non-leaking) error responses from any newly added status/activity endpoint. All backend-internal security properties (prompt-injection defenses, secret handling, output validation) remain as already implemented and are not altered by this phase.

### A14. Observability (architecture-level)

A single lightweight status/health surface, consumed by both the frontend (System Health view) and by whoever is monitoring the deployment personally during the window. One endpoint, a small set of fields (process up, last cycle time, last publication time) — rather than a separate observability stack.

### A15. Testing (architecture-level)

Additive to, not a replacement for, the existing suite: frontend rendering/error-state tests, integration tests against the real (not mocked) deployed API, and a manual extended-run verification on the actual deployment target. See B16 for the full breakdown.

### A16. AI-Agent Continuity

This document, together with the original blueprint, this document's Part B, `DEVELOPMENT_STATE.md`, `README.md`, and `PROMPTS.md`, forms the complete context any new AI coding agent needs before touching the project — see B19 for the required reading order and B20 for what `DEVELOPMENT_STATE.md` must track.

### A17. Final System Architecture (target end state)

```
                         USER / JUDGE
                              │
                              ▼
                    ┌───────────────────┐
                    │   Sentinel UI       │
                    │  (Overview, Feed,   │
                    │  Post Detail,       │
                    │  Activity, Editorial│
                    │  Intelligence,      │
                    │  Persona, Health)   │
                    └──────────┬─────────┘
                               │ HTTPS / REST (read-mostly)
                               ▼
                    ┌───────────────────┐
                    │  Sentinel Backend   │
                    │  API + Scheduler    │
                    │  (always-on host)   │
                    └──────────┬─────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │ Discovery        │ │ Editorial       │ │ Persona &       │
   │ (RSS/live         │ │ Decision        │ │ Rationale        │
   │  sources)          │ │ Engine          │ │ Generation       │
   └────────┬───────┘ └────────┬───────┘ └────────┬───────┘
            └──────────────────┼──────────────────┘
                               ▼
                    ┌───────────────────┐
                    │  Persistent Store   │
                    │  (SQLite / volume)  │
                    │  posts · rejections │
                    │  · agent state      │
                    └───────────────────┘
```

This is the same core backend architecture from the original blueprint, with the frontend and its thin status surface added on top — no core autonomous-lifecycle component has been redesigned in this phase.

---

## PART B — PREMIUM FRONTEND & DEPLOYMENT PLAN

### B1. Executive Summary

Sentinel AI is an autonomous AI-security-focused publishing agent built against Problem Statement 3 — Autonomous AI Creator. The backend — initialization, scheduler, topic discovery, editorial evaluation, generation, memory, and publishing — is treated as complete for the purposes of this plan.

This phase is not about adding backend capability. It is about **making the completed autonomy visible, trustworthy, and demo-ready**. A judge who only sees raw JSON from `/api/agent/feed` has to *infer* editorial judgment, persona consistency, and memory from text alone. A well-built frontend turns those into something a judge can see directly within seconds.

**The backend is complete. This phase is presentation, integration, deployment, and hardening — not new capability.**

### B2. Current State

**Completed**: API contract, agent init and persistent state, autonomous scheduler with restart recovery, failure isolation, live topic discovery, editorial evaluation, generation with rationale, persona consistency, memory/duplicate prevention, autonomous publishing, source attribution, prompt-injection defenses, secret handling, output validation, existing tests, existing docs and AI-usage history.

**Next phase**: a judge-facing frontend, a concrete deployment, production hardening (security, observability, billing safety), documentation continuity practices, and a demo strategy tied to the finished product.

### B3. Problem Statement 3 Requirements → Product Mapping

| Requirement | Backend capability | Frontend presentation | Evidence visible to judge | Remaining polish |
|---|---|---|---|---|
| Autonomy | Scheduler runs independently post-init | "Autonomous Activity" view | Timestamp gap between init and most recent post with no further human input | Confirm scheduler status is exposed via a pollable endpoint |
| Topic discovery | RSS/live source ingestion | Source list per post + discovery indicator | Named sources, fetched-at times | Verify discovery events are queryable, not just final posts |
| Editorial judgment | Selection/rejection logic | "Editorial Intelligence" view | Explicit rejected-topic entries with reasons | Confirm rejected topics are persisted/exposed |
| Persona | Consistency mechanism | "Persona" page + consistent tone site-wide | Reading two posts, same voice/opinions | None — presentation only |
| Memory | Duplicate prevention, continuity | Post Detail references related prior posts | Cross-links between related posts | Verify an API path for related/prior posts exists or can be derived client-side |
| Publishing over time | Scheduler cadence | Feed sorted newest-first, real timestamps | Visible multi-hour gaps between posts | None |
| Rationale | Per-post rationale generation | Rationale rendered on Post Detail | Specific, source-tied reasoning | None |
| Sources | Attribution stored per post | Source links on Feed + Post Detail | Clickable, named sources | Verify URLs are live, not placeholder |
| Continued operation | Restart recovery, failure isolation | System Health heartbeat view | Heartbeat advancing across 48h | Requires a health/heartbeat endpoint if none exists |

**Action item before frontend work starts**: confirm which "evidence" data points above are already retrievable from the existing API versus requiring a small backend addition (see A6).

### B4. Product Vision

Sentinel should read as a **live intelligence system**, not a content app. The mental model: *this is a running process, and I am looking at its output in real time.*

**Should feel like**: an operating security-intelligence dashboard — restrained, dense with real information, quietly confident.

**Should not feel like**: a generic SaaS dashboard template, a ChatGPT clone, a crypto-trading dashboard, an over-animated cyberpunk site, or a portfolio piece straining to impress.

**Design pillars**: premium, technical, intelligent, trustworthy, modern, controlled, security-focused. "Controlled" matters most — restraint is itself part of the persona.

### B5. Frontend Information Architecture

- **Landing / Overview** — identity, domain, mission line, operational state, preview of latest publications. The 10-second read.
- **Live Feed** — chronological posts, newest first; card shows title/topic, timestamp, excerpt, source count.
- **Post Detail** — full text, rationale, sources, timestamp, related-posts link where supported.
- **Autonomous Activity** — the most demo-critical view: last cycle, next expected cycle, recent cycle log (published/rejected/idle) if exposed.
- **Editorial Intelligence** — considered-but-rejected topics with reasons; the single highest-leverage view for proving editorial judgment.
- **Persona** — identity, domain, editorial principles, voice, interests, as a reference point for judges checking consistency.
- **System Health** — heartbeat, last cycle, last publication, basic service status; minimal and factual.
- **Sources** — dedicated page optional; per-post attribution is not.
- **Error / Empty States** — first-run, zero-posts-after-a-long-window, loading, backend unavailable, temporary autonomous failure distinguishable from total breakage.

### B6. Mobile + Desktop

Mobile-first, not desktop-shrunk. Small, fixed navigation set (Overview, Feed, Activity, Editorial, Persona) — bottom/compact nav on mobile, sidebar/top nav on desktop. Technical, restrained typography legible at small sizes. Cards with consistent scannable structure. Comfortable touch targets on source links and cards. Skeleton loaders over spinners, to reinforce "live system."

### B7. Visual Design System

- **Color**: dark, low-saturation base with one restrained accent for "live/active" signals; muted, distinct status colors (published/rejected/idle) — not traffic-light garish.
- **Typography**: clean technical sans for UI, optional monospace accent for timestamps/status/IDs.
- **Spacing**: generous, consistent scale; density intentional, especially on Activity/Editorial views.
- **Borders/cards**: thin, low-contrast borders over heavy shadows.
- **Icons**: one consistent set, used sparingly, mainly for status.
- **Animation**: communicates state change (heartbeat pulse, new-post transition, cycle state change) — never decorative (no parallax, no particle effects).
- **Data viz**: minimal — a simple publishing-cadence sparkline beats a chart-heavy dashboard.
- **Status indicators**: one small, consistent dot+label vocabulary reused everywhere.

### B8. Frontend Technology

**Recommended**: a React-based framework with SSR/SSG support (e.g., Next.js) — pairs naturally with a likely Node/TypeScript backend, strong free-tier deployment story, fast initial load for a judge's first impression, mature ecosystem for a custom (non-templated) design system.

**Alternative**: a lighter Vite + React SPA if minimizing build complexity matters more than SSR.

Avoid heavy pre-styled UI kits whose default look reads as a template — cuts against B4's "should not feel like" list.

### B9. Backend ↔ Frontend Integration

Init stays a one-time, deliberate action, never a casual frontend-triggered one. Feed (and status, if added) polled on a modest interval (e.g., 30–60s) with timeouts and retry-with-backoff. If no status endpoint exists yet, this is the one place a small backend addition is justified (flag to whoever implements, don't assume it exists). Every fetch needs explicit error handling and a defined fallback UI state. Render source links exactly as returned — never "fix" or fabricate attribution client-side.

### B10. Deployment Strategy

| Option | Persistent process | Scheduler support | Persistence | Sleep behavior | Free tier | Complexity | Verdict |
|---|---|---|---|---|---|---|---|
| Render (free) | Yes, but free tier can spin down | Yes if alive | Ephemeral disk on free tier | **Spins down on idle** | Yes | Low | Risky as-is |
| Railway | Yes | Yes | Yes, with volume | No forced sleep on always-on services (verify current terms) | Limited free/trial credit | Low | Strong candidate |
| Fly.io | Yes | Yes | Yes, with volume | Configurable, can run always-on | Free allowance for small VMs (verify) | Medium | Strong candidate |
| AWS Lightsail | Yes | Yes | Yes | No forced sleep | No permanent free tier; historical trial windows — verify | Medium | Reliable if within trial window |
| AWS EC2 (free tier) | Yes | Yes | Yes | No forced sleep | 12-month tier for eligible new accounts (verify) | Medium-High | Reliable but needs billing care |

**Primary**: Railway or Fly.io — genuine always-on, no idle-sleep, matches this project's core "don't go quiet" requirement.
**Backup**: AWS Lightsail/EC2 free tier, only with billing alerts configured before deployment.
**Do not deploy to a platform whose free tier idles/sleeps the process.**

### B11. Production Architecture

Frontend on a static/SSR-friendly host (Vercel/Netlify free tier), separate from the always-on backend host. SQLite on a persistent volume — no separate managed database needed. Secrets via the platform's env-var store, never committed. HTTPS by default on the recommended platforms — confirm it's actually enabled. Rely on the platform's own restart-on-crash rather than a custom process manager. Logs via the platform's default tooling. A lightweight `/health` or `/status` endpoint for both platform and frontend polling.

**Separate hosting for frontend and backend is the recommended architecture** — isolates the always-on requirement to only the component that needs it.

### B12. 48-Hour Autonomous Reliability

Extends A12/original blueprint's failure handling into the deployed environment: confirm persisted scheduler state actually resumes after a *real* platform restart (not just local testing); confirm outbound network access to source/LLM providers is actually permitted by the host (some restrict egress by default); use the deployed health/status endpoint to verify the full cycle is really happening unattended. **Run the deployed instance for several hours unattended and check before the evaluation window opens** — don't skip this just because local tests passed.

### B13. Billing / Cost Safety

Prefer genuine no-card-required free tiers (Fly.io, Railway's free allowance, Vercel/Netlify) where possible. Main charge risk: backend compute and any paid LLM usage beyond free tiers (use the free-provider options already discussed — Groq, OpenRouter, Cerebras). If a card-requiring platform is used at all, set a low-threshold billing alert *before* deployment. Smallest viable instance size, no autoscaling, no managed database beyond SQLite-on-volume. Check usage at least once mid-window. Know the shutdown steps in advance.

### B14. Security Hardening

API keys via platform secret store, not `.env` in a build artifact. CORS restricted to the deployed frontend's origin (and the evaluator's access pattern, once confirmed). Prompt-injection/malicious-RSS defenses already covered backend-side — frontend just avoids re-rendering raw source content as HTML. No client-side "fixing" of source URLs. Basic rate limiting on public endpoints. Generic production error messages, full detail only in server logs. Confirm debug flags are off in the deployed build. Proportional to a hackathon, not an enterprise audit.

### B15. Observability

A `/health`/`/status` endpoint: process up, last successful cycle, last publication. Structured per-cycle logs (published/rejected/idle/errored) — doubles as demo material. Platform's built-in log viewer is sufficient; no separate logging service needed.

### B16. Testing

**Automated**: confirm existing suite still passes against deployed config (real env vars, real network egress), not just mocked conditions.
**Production**: build succeeds on the platform; smoke test against live HTTPS endpoints; manual restart test confirms persistence.
**Manual**: after a real deployed init, confirm sustained operation, real discovery, real rejections, real publishing, feed updates, no repeats, and recovery from an injected failure (e.g., temporarily blocking a source).

### B17. Hackathon Evaluation

Confirm public repo, working deployed link, and properly formatted AI Usage Log before submission — gating, not optional. `PROMPTS.md` must reflect genuine history, no fabrication under any time pressure. Foreground autonomy, editorial intelligence, persona, memory, and rationale in the demo — the differentiators competitors are least likely to have. Keep the codebase simple enough for a live judge-requested modification to be feasible.

### B18. PROMPTS.md Continuity

Every AI-assisted session from now on adds an entry: session number, date, phase, tool/model, objective, exact prompt used, what the AI did, files affected, architectural decisions, verification, test results, outcome, follow-up. **Only record what actually happened** — never fabricate.

### B19. AI Agent Handoff / Model Switching

Because implementation may move between tools due to usage limits, a new agent with no prior context should read, in order:

1. **`autonomous-ai-creator-blueprint.md`** — original foundational architecture and reasoning.
2. **This document (`SENTINEL_BLUEPRINT_2.0.md`)** — current-phase architecture (Part A) and execution roadmap (Part B).
3. **`DEVELOPMENT_STATE.md`** — live continuity: exactly where things stand right now.
4. **`README.md`** — public-facing summary, a sanity check against actual implementation.
5. **`PROMPTS.md`** — full session history, the "how we got here."

Every new agent must inspect existing work first, avoid rebuilding completed features, preserve established architecture, and update `PROMPTS.md`/`DEVELOPMENT_STATE.md` after any meaningful change.

### B20. DEVELOPMENT_STATE.md

The single most important continuity document, because everything else here is static. Must always communicate: current phase, completed work, remaining work, architecture summary, frontend status, deployment status, test status, known issues, required env var names (never values), immediate next task, and important decisions (especially deviations from this plan, and why). Update after every meaningful session.

### B21. Documentation Maintenance

`autonomous-ai-creator-blueprint.md`, this document, `DEVELOPMENT_STATE.md`, `README.md`, and `PROMPTS.md` should stay mutually consistent. Don't retroactively rewrite the static plans to match reality — that's `DEVELOPMENT_STATE.md`'s job. Never mark an unimplemented feature as done anywhere.

### B22. Demo Strategy

**30-second explanation**: *"Sentinel is an autonomous AI security researcher. We initialized it once, and for the past [N] hours it's been running entirely on its own — discovering security news, deciding what's actually worth covering, writing about it in a consistent voice, and remembering what it's already said so it doesn't repeat itself. We haven't touched it since init."*

**2-minute sequence**: Persona page (who it is) → Autonomous Activity (real multi-hour cycle history) → a rejected topic on Editorial Intelligence with its reason (strongest evidence) → a generated post with full rationale walked through against a real source → two related posts side by side (persona + memory consistency) → the live Feed scrolled to show real time spread → close on System Health, still running right now.

### B23. Portfolio Value (optional, post-hackathon)

Architecture diagram/case study, short technical walkthrough of the lifecycle, deployment/reliability write-up, security-pass summary, demo video, a few strong screenshots (Feed, Editorial Intelligence, Activity). Skip anything without genuine engineering substance behind it.

### B24. Scope Control

| Priority | Items |
|---|---|
| **P0 — Must have** | Feed, Post Detail, Overview, basic Editorial Intelligence, always-on deployment, health endpoint, mobile-responsive layout, source attribution |
| **P1 — High-value polish** | Autonomous Activity with real cycle history, Persona page, refined design system, loading/error states, System Health page |
| **P2 — Optional portfolio** | Publishing-cadence viz, in-app architecture diagram, demo video, extra animated transitions |
| **P3 — Avoid / out of scope** | Websocket/real-time push (unless trivial), user accounts/auth beyond admin init, multi-agent support, custom logging service, autoscaling infra |

**Reliability and clear presentation of existing capability outrank additional features at every stage.**

### B25. Implementation Roadmap

| Phase | Objective | Key dependencies | Acceptance criteria | Status |
|---|---|---|---|---|
| 2.1 — Frontend Foundation | Scaffold, tokens, routing, layout | B8 stack decision | Deploys a placeholder shell | **In progress — scaffold, tokens, layout, routing, and placeholder views added in `frontend/` (Vite + React + TS). Deployment of the shell not yet done.** |
| 2.2 — Feed experience | Feed + Post Detail wired to a real API | Confirmed feed shape | Real posts render, incl. error/empty states | **Complete in `frontend/` — real feed wired to `GET /api/agent/feed`, newest-first, with loading (live pulse), empty, error+retry states, and a post-detail view reusing the feed response. 9 frontend tests.** |
| 2.3 — Autonomous intelligence visualization | Activity + Editorial Intelligence views | Status/activity endpoint (A6) | Judge can see cycle history and a real rejection | Pending |
| 2.4 — Premium visual polish | Full design system across all views | 2.1–2.3 | Passes fresh-eyes review against B4 | Pending |
| 2.5 — Backend integration hardening | Error handling, retries, timeouts | 2.2–2.3 | No unhandled failure states manually found | Pending |
| 2.6 — Production hardening | Security pass (B14), secret audit | 2.1–2.5 | B14 checklist fully reviewed | Pending |
| 2.7 — Deployment | Backend + frontend deployed (B10–11) | 2.6 | Both reachable over HTTPS, health green | Pending |
| 2.8 — 48-hour reliability test | Extended unattended run on real deployment | 2.7 | Cycle continues correctly across a multi-hour window | Pending |
| 2.9 — Final submission polish | README, demo rehearsal, doc final pass | 2.1–2.8 | B26 fully met | Pending |

Each phase closes with a `DEVELOPMENT_STATE.md` update and, where AI-assisted, a `PROMPTS.md` entry.

### B26. Definition of Done

- Backend operational and stable on the deployed host
- Frontend polished (B4–B7), deployed and reachable
- All API integrations working with proper error handling (B9)
- Deployment stable across an extended unattended test (B12)
- Autonomous operation, persistence, memory verified on the *deployed* instance
- Source attribution verified accurate and clickable
- Security checklist (B14) reviewed
- Logs/health endpoint checked at least once mid-window
- Billing safety (B13) in place *before* the evaluation window opens
- README accurate to actual implementation
- This document and the original blueprint reflect what was actually built (update if reality diverged)
- `PROMPTS.md` accurate and current
- `DEVELOPMENT_STATE.md` current as of submission
- Public repository, working link, AI Usage Log all confirmed ready for submission
