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

The session was detailed in the foundation phase specifications (see repository git history).

### AI Work

Cline established the project structure, SQLite storage, repositories, models, API contract, and tests.

---

## Session 2 — Autonomous Scheduler & Lifecycle

**Date:** 2026-08-08

**Development phase:** Phase 2A — Autonomous Scheduler & Lifecycle

**AI tool:** Cline (VS Code extension)

**Objective:** Implement the autonomous scheduler, persistent scheduling state, restart recovery, failure isolation, and graceful shutdown.

### AI Work

Cline implemented `AutonomousScheduler`, `AutonomousLifecycle`, scheduling table, restart recovery, and tests.

---

## Session 3 — Live Topic Discovery

**Date:** 2026-08-08

**Development phase:** Phase 2B — Live Topic Discovery (Implemented using OpenCode due to Cline usage limit exhaustion)

**Objective:** Implement real live topic discovery via RSS feeds, normalization, deduplication, discovery persistence, and lifecycle integration.

### AI Work

OpenCode implemented `TopicSource`, `RssFeedSource`, `LiveTopicDiscovery`, discovery persistence (`discovered` state), and tests.

---

## Session 4 — Editorial Decision Engine

**Date:** 2026-08-08

**Development phase:** Phase 2C — Editorial Decision Engine

**AI tool:** OpenCode

**Objective:** Implement the real deterministic editorial decision engine to replace `NoopEditorialEngine`, evaluating candidate topics across multiple dimensions (relevance, freshness, novelty, source quality, persona fit), applying a configurable publish threshold, producing structured rejection/approval reasons, persisting editorial decisions in the `topics` table, and integrating the engine into `AutonomousLifecycle` while keeping the generator as a stub (no posts published yet).

### Prompt / Instruction

Problem Statement 3 — Phase 2C Editorial Decision Engine:
1. Audit Phase 2B implementation (verified correct and robust).
2. Design and implement a deterministic, rule-based, explainable editorial scoring engine (`DeterministicEditorialEngine`).
3. Evaluate candidates across dimensions: relevance, freshness, novelty, source quality, persona fit (0-100 scale).
4. Implement threshold-based decision making (`publish` if score >= threshold, default 60; otherwise `reject`).
5. Generate structured rejection reasons and score breakdowns.
6. Persist editorial decisions (`publish` or `reject`), decisions timestamps, and structured reasoning into the SQLite `topics` table.
7. Wire the real editorial engine into `AutonomousLifecycle`.
8. Keep the content generator as a stub (no posts fabricated, feed remains a pure reader).
9. Add comprehensive unit tests and verify typecheck and full test suite.
10. Synchronize documentation (`README.md`, `docs/architecture.md`, `DEVELOPMENT_STATE.md`, `PROMPTS.md`).

### AI Work

OpenCode executed the following:

1. **Audited Phase 2B:** Verified RSS fetching, parsing, normalization, source abstraction, in-cycle deduplication, and persistence (`discovered` state). Found no genuine bugs or architectural violations.
2. **Designed & Implemented `DeterministicEditorialEngine`** (`src/agent/editorial.ts`):
   - Evaluates candidate topics across 5 distinct axes: relevance (keyword/domain match against agent persona domain), freshness (source publication age vs discovery time), novelty (summary length/substantive detail depth), source quality (known reputable sources like arXiv, Hacker News, GitHub, official blogs, HTTPS), and persona fit (technical significance/vocabulary).
   - Computes a weighted total score (0-100).
   - Applies a threshold check (`threshold` config, default 60) to determine `publish` vs `reject`.
   - Produces structured reasons and per-axis breakdown.
3. **Updated Persistence (`TopicRepository` & `AutonomousLifecycle`):**
   - Added `updateDecision` method to `TopicRepository` to update pre-existing `discovered` topic rows with the editorial decision (`publish`/`reject`), decided timestamp, and structured reasoning JSON.
   - Wired editorial evaluation and decision persistence into `AutonomousLifecycle.tick(...)`.
4. **Wrote Comprehensive Tests (`tests/editorial.test.ts`):**
   - Verified high-scoring strong technical topic approval.
   - Verified low-scoring weak topic rejection.
   - Verified freshness aging behavior.
5. **Verified:**
   - `npm run typecheck` passes with strict TypeScript rules.
   - `npm test` passes **67/67 tests** successfully (all previous tests + new editorial engine tests).
6. **Updated Documentation:** Synchronized `README.md`, `docs/architecture.md`, `DEVELOPMENT_STATE.md`, and `PROMPTS.md`.

### Files Affected

**Created:**

- `tests/editorial.test.ts`

**Modified:**

- `src/agent/editorial.ts` (replaced stub with `DeterministicEditorialEngine`)
- `src/agent/autonomousLifecycle.ts` (wired editorial engine and decision persistence)
- `src/repositories/topicRepository.ts` (added `updateDecision`)
- `README.md` (updated status to Phase 2C, editorial engine features)
- `docs/architecture.md` (updated status and editorial component architecture)
- `DEVELOPMENT_STATE.md` (updated current phase, implemented features, tests)
- `PROMPTS.md` (added Session 4 log)

### Architectural Decisions

1. **Deterministic & Rule-Based Scoring:** Kept editorial scoring completely deterministic and explainable without calling an LLM or vector database, fulfilling the lightweight, fast, testable hackathon requirement.
2. **Multi-Axis Scoring:** Evaluates relevance, freshness, novelty, source quality, and persona fit with weighted aggregation.
3. **Threshold-Based Decision:** Uses a configurable threshold (default 60) so topics can be rejected even if they are the top candidate, allowing "empty news days" or strict editorial standards.
4. **Two-Stage Topic Trail (`discovered` → `publish`/`reject`):** Preserves the immutable audit trail where items are first stored as `discovered` during discovery and updated to `publish`/`reject` after editorial evaluation.
5. **Generator Remains Stubbed:** Confirms that Phase 2C strictly decides editorial verdicts without generating or publishing final posts, keeping responsibilities cleanly separated.

### Verification

- `npm run typecheck` — passes with no errors.
- `npm test` — **67/67 tests pass** cleanly.
- `npm run build` — passes (`tsc`).

### Result

Phase 2C completed successfully. Sentinel AI now possesses a real, deterministic, explainable editorial decision engine that reviews discovered live topics, applies editorial judgment against a threshold, records structured rejection reasons, and persists decisions into the SQLite audit trail — while remaining fully decoupled from content generation and publishing.

### Follow-up

The next phase is **Phase 2D — Content Generation**: transforming approved topics into persona-driven posts and rationales using an LLM while maintaining memory and temporal publishing rules.
