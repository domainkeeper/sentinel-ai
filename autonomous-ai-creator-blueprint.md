# Autonomous AI Creator — Engineering Blueprint
### Problem Statement 3 · 48-Hour Autonomous Evaluation

---

> **Implementation status (Phase 2B — Live Topic Discovery):**
> The autonomous lifecycle + scheduler (Phase 2A) and live topic discovery
> (Phase 2B) described in this blueprint are now implemented. See
> `docs/architecture.md` for the current technical state.
> Live discovery now runs against real curated RSS feeds and persists
> `discovered` candidates to the `topics` trail. Editorial scoring, LLM
> generation, and memory remain future phases (the lifecycle still invokes
> no-op stubs for these today).

---

## 1. Project Understanding

### What the judges actually care about

The API contract tells you more than it looks like it does. `POST /api/agent/init` is called **exactly once**, then the evaluator only ever polls `GET /api/agent/feed`. That single design choice means the judges are not scoring your code quality in isolation — they are scoring **whether an unattended process can behave like an editor for two days straight**. Everything else is in service of that.

Concretely, they are likely weighting:

| Dimension | What it really tests |
|---|---|
| Autonomous operation | Does *anything* happen without a human in the loop after init? |
| Editorial judgment | Is there visible evidence of rejection, not just publication? |
| Persona consistency | Does post #1 and post #20 sound like the same "person"? |
| Memory | Does the agent reference or avoid repeating its own history? |
| Publishing over time | Is there a real temporal spread, or a burst at t=0? |
| Transparency | Can a judge reconstruct *why* each decision was made from the rationale field alone? |
| Engineering quality | Does it survive 48 hours without crashing, stalling, or silently dying? |

### Hidden evaluation points

These are easy to miss because they're not stated as requirements, but they follow logically from "periodic polling for 48 hours":

- **Time-distribution shape.** A judge who polls at hour 1, hour 20, and hour 45 will directly observe your publishing cadence. If all posts have timestamps within the first 10 minutes, autonomy is falsified regardless of what the code does.
- **Idle-day resilience.** If your only topic source goes quiet (e.g., a slow news day), does the agent do nothing forever, or does it gracefully lower its bar, wait, and explain why in the next rationale? Silence for 48 hours reads as "broken," not "disciplined."
- **Rejection visibility.** Nothing in the API contract *requires* you to expose rejected topics, but if there's no way for a judge to see editorial judgment in action, "we reject bad topics" is just a claim, not evidence. Consider whether rejections should be inferable from the rationale of what *was* published (e.g., "chosen over X and Y because...").
- **Persona drift under pressure.** Cheap implementations use a static system prompt and hope. Robust implementations actively check new drafts against the persona's established voice/opinions, especially as memory grows and context windows get more crowded.
- **Duplicate/near-duplicate detection**, not just exact-string detection. Two posts about "a new jailbreak technique" three days apart, worded differently, is still a repetition failure in spirit even if no string matches.
- **Timestamp integrity.** ISO UTC, monotonically sensible, no clock drift, no timestamps in the future relative to `createdAt` of init.
- **Graceful degradation over hard failure.** A crashed scheduler that produces zero posts after hour 6 will likely score far worse than an agent that produces fewer, sparser, but well-reasoned posts.

### Common mistakes / how submissions usually fail

1. **Front-loading**: generating 10–15 posts at `init` time and then going quiet. This is the single most common and most fatal failure mode for this problem statement — it directly contradicts "publishing over time."
2. **No real rejection logic**: an LLM call that "writes about whatever it's given" with no scoring/filtering step, dressed up with a rationale field that just restates the topic.
3. **Rationale as decoration**: rationale text that's generic boilerplate ("this is important because AI is advancing rapidly") rather than specific to the topic, source, and timing.
4. **Memory that doesn't actually influence behavior**: storing past posts but never using them to block near-duplicates or maintain continuity (e.g., referencing an earlier post's stance).
5. **Fragile schedulers**: a single long-running process with no persistence — if it restarts (deploy hiccup, host reboot, memory limit), all in-memory state and pending schedule is lost silently.
6. **No handling for "no good topics today"**: crashing, publishing something low-quality out of desperation, or hanging.
7. **Persona described once in a prompt, never enforced**: as post count grows, later posts read like a generic AI voice because the persona isn't actively checked or reinforced.
8. **Treating this as a demo instead of a service**: code that works when *you* run it once but wasn't built to run continuously and survive process restarts, rate limits, and empty result sets.

### How to maximize scoring

Given the above, the highest-leverage investments, roughly in order:

1. A **scheduler that is provably still alive at hour 40** — this alone prevents the worst failure mode.
2. A **visible rejection trail** — even a simple "considered N topics, published 1" log or field goes a long way toward proving editorial judgment.
3. **Rationale fields that cite specifics** — actual source titles/URLs, actual comparison to alternatives, actual timing justification.
4. **A memory mechanism that measurably prevents repeats** — testable, not just claimed.
5. **A demo narrative** that walks judges through autonomy directly (see Section 12) rather than making them infer it from raw JSON.

---

## 2. Architecture Planning

### System overview (conceptual)

The system is best thought of as five loosely coupled components, not a monolith:

```
                     ┌─────────────────────┐
                     │   Init Endpoint      │
                     │  (one-time trigger)  │
                     └──────────┬───────────┘
                                │ creates
                                ▼
                     ┌─────────────────────┐
                     │   Agent Record        │
                     │ (persona + config)    │
                     └──────────┬───────────┘
                                │ starts
                                ▼
        ┌───────────────────────────────────────────┐
        │              Autonomous Loop                │
        │  (long-running / scheduled, NOT request-driven) │
        └───────────────────────────────────────────┘
                 │            │             │
                 ▼            ▼             ▼
      ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
      │ Topic          │ │ Editorial    │ │ Persona &      │
      │ Discovery      │ │ Decision     │ │ Rationale      │
      │ (sources)      │ │ Engine       │ │ Generation     │
      └──────┬───────┘ └──────┬──────┘ └───────┬──────┘
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                    ┌───────────────────┐
                    │  Memory / Store     │
                    │ (posts, rejections, │
                    │  persona state)     │
                    └──────────┬─────────┘
                               │
                               ▼
                    ┌───────────────────┐
                    │  Feed Endpoint      │
                    │  GET /agent/feed    │
                    └───────────────────┘
```

### Components and responsibilities

| Component | Responsibility | Should NOT do |
|---|---|---|
| Init endpoint | Validate persona config, create agent record, kick off the autonomous loop, return `agentId` | Generate any posts synchronously |
| Autonomous loop / scheduler | Wake up on a cadence (or event), orchestrate discovery → decision → generation → storage | Block on slow network calls without timeouts |
| Topic discovery | Pull candidate topics from one or more live sources | Decide what to publish |
| Editorial decision engine | Score/filter candidates, decide publish vs. reject, decide *which one* if multiple qualify | Generate the post text itself |
| Persona & rationale generation | Turn an approved topic into on-brand text + rationale | Re-decide whether to publish (that's already decided) |
| Memory / store | Durable record of published posts, rejected topics, persona state, dedup fingerprints | Live only in process memory |
| Feed endpoint | Serve stored posts newest-first, read-only | Trigger new generation as a side effect of being polled |

### Data flow / lifecycle

1. **Init**: persona config in → agent record created (status: `active`) → scheduler registered → `agentId` out.
2. **Tick** (on each scheduler wake-up): fetch persona + recent memory → discover candidate topics → filter already-seen/duplicate topics using memory → score remaining candidates → decide: publish 0 or 1 (rarely more) → if publish: generate text + rationale in persona voice → write to store with unique ID, ISO UTC timestamp → update dedup fingerprints.
3. **Idle tick**: if no candidate clears the bar, log a "considered and rejected" record (for transparency / demo purposes) and sleep until next tick — do not force a publish.
4. **Feed read**: pure read from store, newest-first, no side effects.

The critical architectural decision embedded here: **the feed endpoint must be a pure reader.** If generation is accidentally triggered by a GET request (e.g., "generate if nothing exists yet"), you violate the "never sends another prompt" premise the moment a judge's polling *becomes* the trigger. Keep discovery/generation strictly on the scheduler's clock.

### Lifecycle / state machine for the agent

```
        init
         │
         ▼
      [active] ──tick──▶ [evaluating candidates]
         ▲                        │
         │                 publish or reject
         │                        │
         └────────sleep───────────┘
         │
   (optional) [paused/error] ──recover──▶ [active]
```

An explicit `paused`/`error` state, with a recovery path, matters more than it looks like — see Section 9.

---

## 3. Persona Design

Do not lock a persona in before comparing options — the persona *is* a scoring dimension (consistency, memorability), so it deserves deliberate design.

### Option A — "The Skeptical Practitioner"
- **Niche**: AI security / adversarial ML.
- **Voice**: terse, technically precise, allergic to hype; often opens by naming what's *not* new about a story.
- **Editorial philosophy**: publishes rarely, but only on topics with concrete technical substance (a paper, a CVE, a reproducible exploit) — good fit for visibly rejecting hype-only topics.
- **Strength**: rejection behavior is very legible to judges ("rejected: no technical substance, just a press release").
- **Risk**: rare publishing could look like *inactivity* rather than *discipline* if not paired with visible rejection logs.

### Option B — "The Connector"
- **Niche**: applied AI across industries (healthcare, education, climate).
- **Voice**: warm, explanatory, always links a technical development to a real-world consequence.
- **Editorial philosophy**: publishes more frequently, on breadth rather than depth; rejects topics that are purely technical with no real-world hook.
- **Strength**: naturally generates rich rationale ("why it matters now") since that's the persona's whole lens.
- **Risk**: broader topic net makes duplicate/near-duplicate detection harder — more surface area for repetition.

### Option C — "The Contrarian Analyst"
- **Niche**: general AI industry news, but with a consistent editorial stance (e.g., skeptical of scaling-only narratives).
- **Voice**: opinionated, takes a clear side, willing to say a widely-covered story is overrated.
- **Editorial philosophy**: actively seeks topics that let it disagree with prevailing narrative — strong "editorial opinion" signal.
- **Strength**: opinions are an explicit requirement ("editorial opinions") — this persona demonstrates that requirement most directly.
- **Risk**: sustaining a consistent contrarian stance for 48 hours without becoming repetitive or incoherent is harder to pull off well.

### Comparison

| Criterion | Skeptical Practitioner | Connector | Contrarian Analyst |
|---|---|---|---|
| Rejection visibility | High | Medium | Medium |
| Rationale richness | Medium | High | High |
| Persona memorability | Medium | Medium | High |
| Risk of repetition | Low (narrow niche) | High (broad niche) | Medium |
| Difficulty sustaining voice | Low | Low | High |

A reasonable default leaning, without finalizing: **narrow niche + explicit opinions** (closer to A or C) tends to make both "editorial judgment" and "consistent persona" easier to demonstrate convincingly in a 48-hour, mostly-unsupervised window, because there's a smaller, well-defined space of "on-brand" content to stay inside of. Broader personas (B) are more demo-friendly narratively but riskier for consistency scoring.

---

## 4. Topic Discovery Strategy

| Source | Pros | Cons | Best for |
|---|---|---|---|
| News APIs (e.g. general news aggregators) | High volume, broad coverage, structured metadata | Often paywalled/rate-limited, noisy, lots of low-substance content | Connector persona |
| RSS feeds (blogs, publications) | Free, stable, easy to poll on a schedule, low rate-limit risk | Requires curating a good feed list; inconsistent structure across sources | Any persona, low-risk backbone |
| GitHub (trending repos, releases) | Concrete, verifiable, timestamped, good for "technical substance" filter | Not "news" in the traditional sense; needs interpretation to become a post topic | Skeptical Practitioner |
| arXiv | Extremely high substance, verifiable, timestamped | Dense, requires summarization skill, low signal-to-noise for a general audience | Skeptical Practitioner |
| HuggingFace (model/dataset releases) | Concrete artifacts, easy to describe "why it matters" | Very frequent releases — duplicate/near-duplicate risk is high | Connector, with strong filtering |
| Reddit | Captures real discourse/sentiment, good for "what's being talked about" | Noisy, unreliable signal quality, harder to justify as an authoritative source | Contrarian Analyst (as color, not primary source) |
| Official AI company blogs | High authority, low noise | Low volume — may not sustain 48 hours alone | Backbone source, pair with RSS |

**Recommended pattern**: don't rely on a single source type. Use 2–3 sources with different failure characteristics (e.g., one high-authority-but-low-volume source like official blogs, plus one high-volume-but-noisy source like RSS aggregation) so that if one goes quiet or rate-limits you, the loop still has candidates. Discovery should always produce a *candidate list*, never a single forced pick — that list is what the editorial engine filters.

---

## 5. Editorial Decision Engine

### Publish vs. reject as a scoring problem

Frame each candidate topic as accumulating a score across independent axes, then apply a threshold — this makes rejection *explainable*, which directly serves the "transparency" requirement.

| Axis | Question it answers | Example signal |
|---|---|---|
| Novelty | Have we (or the broader conversation) already said this? | Similarity to memory of past posts; similarity to very recent widely-covered stories |
| Relevance | Does this fit the persona's declared niche? | Keyword/topic-domain match against persona config |
| Importance | Does this matter beyond a niche audience-of-one? | Source authority, corroboration across multiple sources |
| Freshness | Is this actually current, or stale/recycled? | Recency of the underlying event vs. now |
| Audience fit | Would the persona's stated audience care? | Consistency with topics the persona has previously engaged |

### Design considerations

- **Threshold, not ranking-only.** A pure "publish the best candidate every tick" approach guarantees publishing even on a bad day, which undermines editorial judgment. A minimum bar that can go unmet is what makes rejection *real* rather than cosmetic.
- **Reject-over-reasons should be structured**, not just a scalar score — e.g., "below novelty threshold: 85% similar to post from 6 hours ago" is far more demonstrable to a judge than "score: 4.2/10."
- **Comparative rationale requires keeping the *runner-up*.** If the rationale must say "chosen over alternatives," the engine needs to retain what the alternatives *were*, not just discard them after picking a winner.
- **Avoid a single LLM call doing discovery-scoring-writing all at once.** Collapsing decision and generation into one step makes it very hard to prove (to yourself, or a judge) that rejection is a real, separate step rather than the model just deciding what to write about unprompted.

---

## 6. Memory Strategy

| Approach | Pros | Cons | Fit |
|---|---|---|---|
| JSON file | Zero setup, human-readable, easy to debug in a hackathon | No concurrency safety, no query capability, awkward at scale | Prototyping only |
| SQLite | Simple, durable, transactional, no external service, still simple enough for a 48h agent | Single-writer constraints under heavy concurrency (unlikely to matter here) | Strong default for this project's scale |
| PostgreSQL | Real concurrency, durable, production-grade | Operational overhead (hosting, connection management) disproportionate to actual scale needed | Overkill unless you already have infra for it |
| Vector database / embeddings | Best semantic duplicate detection ("about the same thing" not just "same words") | Added infra + dependency; needs an embedding model/API | Worth it specifically for near-duplicate detection, not for general storage |

### What memory needs to actually do

- **Continuity**: retrieve recent posts (and their stated opinions) so new posts can reference or stay consistent with prior stances.
- **Duplicate detection**: two layers — exact/near-exact string matching (cheap, catches obvious repeats) plus semantic similarity (embeddings, catches "same story, different words").
- **Topic similarity over time**: track topic categories/tags per post so the engine can notice "we've covered adversarial attacks 4 times this window, time to diversify" — this is a *pattern*, not just a duplicate check.
- **Editorial consistency**: store the persona's stated opinions/stances as structured facts (not just raw text) so future rationale generation can check "does this new take contradict an earlier one?"
- **History for rationale**: "why it matters now" and "why over alternatives" both need access to recent history, not just the current candidate.

**Recommended default**: SQLite for structured storage of posts/rejections/persona-state, plus lightweight embedding-based similarity (even a small local/free embedding call) specifically for near-duplicate detection. This gets most of the value of a vector database without taking on a separate service to host and monitor during a time-boxed hackathon.

---

## 7. Publishing Strategy

- **Cadence**: define a target range (e.g., "roughly every N hours," not a fixed exact interval) — a perfectly regular interval can itself look mechanical/unconvincing; light randomness within bounds reads as more "editorial" than a cron-perfect cadence.
- **Cooldowns**: enforce a minimum gap between publishes regardless of how many candidates clear the bar, to prevent bursts when a source surfaces several qualifying topics simultaneously.
- **Avoiding spam**: cap maximum posts per time window independent of candidate volume — editorial restraint should be visible even on a busy news day.
- **Avoiding bursts**: if multiple ticks in a row produce qualifying candidates, deliberately stagger rather than publishing all of them back-to-back — ties back to the cooldown mechanism.
- **Handling empty news days**: this is the scenario most submissions don't plan for. Options, not mutually exclusive:
  - Lower novelty/importance thresholds gradually the longer the drought continues (with this reasoning reflected in the rationale, e.g., "publishing on a quieter story than usual because nothing met the standard bar in the last N hours").
  - Revisit a previously-seen-but-rejected topic if enough time has passed and it's still relevant.
  - Simply publish nothing and let the "considered and rejected" trail (if you build one) speak for the agent's activity during that window.

---

## 8. Rationale Generation

A good rationale is **specific and falsifiable** — a judge should be able to check it against the actual sources and actual post history and find it holds up. Each rationale should functionally answer:

- **Topic selection**: what specifically about this topic met the bar (tie back to the scoring axes from Section 5, in persona voice, not as a literal score dump).
- **Timing ("why now")**: what changed recently that makes this the right moment — not a generic "AI is evolving fast" statement.
- **Why over alternatives**: name (even briefly) what else was considered and why it lost out — this is only possible if the decision engine retained runner-up candidates (Section 5).
- **Source attribution**: which sources were actually used, ideally with enough specificity (title/publisher, not just a URL) that a judge can verify independently.

Weak rationale example (avoid): *"This is an important development in AI that our readers will find interesting."*
Strong rationale shape (aim for): a sentence naming the specific event/artifact, a sentence on why the timing matters relative to recent context, a sentence on what was passed over and why, plus explicit source references.

---

## 9. Failure Scenarios

| Failure | Handling strategy |
|---|---|
| No internet / source unreachable | Timeout + retry with backoff; if all sources fail this tick, log as an empty/failed tick and sleep — never crash the loop |
| Bad API response (malformed/unexpected) | Defensive parsing with schema validation; treat as "no candidates this tick," not a fatal error |
| Duplicate topic | Caught by memory/dedup layer before generation is even attempted — reject at the decision stage |
| Broken scheduler | Scheduler state and next-run time should be persisted, not purely in-process, so a restart can resume rather than silently going dark for the rest of 48 hours |
| LLM timeout | Hard timeout + fallback: skip this tick rather than hang the whole loop indefinitely |
| Rate limits (LLM or source APIs) | Respect backoff signals; degrade to a longer polling interval temporarily rather than hammering and failing repeatedly |
| Database corruption | Regular lightweight backups/snapshots of the store; on read failure, fail safe (serve last known-good feed) rather than crashing the feed endpoint |
| Empty feed at first poll | This is expected and fine early on — but the agent should not still be empty at, say, hour 10; treat "too long with zero posts" as its own alert condition during your own testing |
| Repeated posts (dedup failure) | Defense in depth: both a pre-generation duplicate check *and* a pre-storage final check, since generation could theoretically produce something close to an existing post even after a topic-level filter |
| Clock drift | Always generate timestamps server-side in UTC at the moment of storage, never trust client-provided or pre-computed times; consider periodic sanity checks against a reliable time source if running on infra prone to drift |

The unifying principle: **the feed endpoint should never go down, and the scheduler should never permanently stop, no matter what fails upstream.** Isolate failures to "this tick produced nothing" rather than "the process is now dead."

---

## 10. Testing Plan

| Test type | What to cover |
|---|---|
| Unit tests | Scoring function behavior at threshold boundaries; dedup similarity function on known near-duplicate pairs; timestamp formatting; persona-config validation on init |
| Integration tests | Full tick cycle (discovery → decision → generation → storage) against mocked sources; feed endpoint returns correct ordering/shape after multiple ticks |
| Manual tests | Run the loop for an extended local window and actually read the posts for voice consistency, not just check they exist |
| API validation | Init with valid/invalid persona payloads; feed with valid/invalid/missing `agentId`; response shape matches the contract exactly (field names, ISO UTC format, newest-first ordering) |
| Scheduler validation | Kill and restart the process mid-run; confirm it resumes rather than double-publishing or going dark |
| Memory validation | Feed the same topic in twice (exact and near-duplicate phrasing) and confirm rejection both times |
| Duplicate detection tests | Explicit test set of paraphrased near-duplicates, not just exact string repeats, to validate the semantic layer specifically |

Treat "run for 48 simulated hours with mocked time" as a first-class test, not just a hope — this is the scenario the whole project is graded on, so it deserves a dedicated test rather than only ad hoc manual runs.

---

## 11. Deployment Plan

- **Deployment choice**: prioritize a platform that supports a genuinely long-running background process (not just request-triggered serverless functions, which are a poor fit for an autonomous scheduler that must act without incoming requests).
- **Scheduler hosting**: the scheduler and the API server can live in the same process for simplicity at this scale, provided the platform guarantees the process stays alive between requests — if the platform can idle/sleep the process when there's no traffic, that directly breaks "publishing over time" and needs to be checked explicitly, not assumed.
- **Environment variables**: keep all API keys, source credentials, and tunable thresholds (cooldown length, score threshold) out of code — this also makes it easy to demo different behavior without redeploying.
- **Background workers**: if the platform does separate the API and worker concerns, ensure both read/write the same durable store, not separate in-memory state.
- **Logging**: log every tick's outcome (candidates considered, decision made, reason) — this log is also your best raw material for the demo and for debugging during the 48-hour window.
- **Monitoring**: a minimal heartbeat (last successful tick time) that you personally can check during the evaluation window is worth building even though it's not part of the graded API — you want to know if it dies before the judges find out.
- **Production concerns**: idempotency on init (what happens if it's somehow called twice — should not be possible per the contract, but defend against it), and graceful handling of the process being redeployed mid-evaluation (state must survive that).

---

## 12. Demo Strategy

**Narrative arc**: don't lead with architecture. Lead with the constraint that makes this hard — *"the evaluator only talks to us once, then walks away for 48 hours"* — and then show the system living up to that constraint.

Suggested demonstration order:

1. **Show the init call** happening once, live, and emphasize you won't touch it again.
2. **Show the tick log/history** (even from a prior real run) spanning many hours — this is your strongest evidence of "publishing over time," stronger than the live feed alone since a live demo can't wait 48 hours.
3. **Show a rejection** — pull up a specific candidate topic that was considered and rejected, with the reason. This is the single most differentiating thing you can show, since most competing submissions likely can't produce this at all.
4. **Show two posts on a related theme** and point out how the second one references or stays consistent with the first — demonstrates memory *and* persona consistency simultaneously.
5. **Show a rationale field** and walk through it against the actual source — prove it's not generic.
6. **Only then** show the architecture diagram, briefly, framed as "here's how we made steps 1–5 possible," not as the centerpiece.

Autonomy is best showcased through **historical evidence** (logs/timestamps spanning real hours) rather than live interaction, since live interaction can't compress 48 hours into a 5-minute demo slot.

---

## 13. README Plan (outline only)

1. Project name / one-line pitch (persona name + niche)
2. The constraint this project is designed around (init-once, autonomous-after)
3. Architecture overview (link to or embed the diagram)
4. Persona description
5. How topic discovery works (sources used and why)
6. How editorial decisions are made (the scoring axes, in brief)
7. How memory/continuity works
8. Publishing cadence philosophy
9. Example post + rationale (real one, from an actual run)
10. Example rejection (real one, from an actual run)
11. Failure handling summary (brief table, not exhaustive prose)
12. How to run it / environment variables required
13. Known limitations / what we'd do with more time
14. Link to `PROMPTS.md` / AI usage log

---

## 14. AI Usage Log Strategy (`PROMPTS.md`)

- **Update cadence**: append after each meaningful development session, not once at the end — a log with timestamps spread across your actual working sessions is itself evidence of authentic process, mirroring the same "over time" principle the project is graded on.
- **What to record**: prompts that produced actual design decisions or code (architecture choices, scoring logic, persona voice iteration, debugging sessions) — not every trivial exchange.
- **Organization**: group chronologically by session/phase (e.g., "Day 1 — architecture," "Day 1 — persona design," "Day 2 — editorial engine," "Day 2 — testing/debugging"), so a reader can follow the project's actual development arc.
- **Demonstrating authenticity**: include prompts that show iteration and correction (a design that was tried, found lacking, and revised), not just clean one-shot successes — real development has messy middles, and a log that's *too* clean can itself read as suspicious.
- **Alignment with implemented features**: every major feature in the README should have a traceable trail in the log; conversely, avoid logging prompts about features that were discussed but never actually built, since a mismatch is an easy thing for a judge to catch.
- **Avoiding the "imported project" look**: vary prompt phrasing naturally across the log (real iterative work doesn't produce uniformly polished prompts), and make sure the log's timeline is consistent with your actual commit history/timestamps.

---

## 15. Development Workflow (Day 1 → Submission)

| Phase | Focus | Should NOT be postponed | Can be postponed |
|---|---|---|---|
| Day 1, early | Persona decision (pick one from Section 3), core architecture skeleton, storage schema | Persona lock-in, storage schema | Fancy source diversity |
| Day 1, mid | Topic discovery from one reliable source, basic scheduler loop that actually runs on a timer | Getting *any* end-to-end tick working | Additional sources |
| Day 1, late | Editorial scoring engine with a real threshold, rationale generation tied to persona | Real rejection logic (not cosmetic) | Semantic/embedding dedup (string-match dedup is an acceptable placeholder short-term) |
| Day 2, early | Memory/dedup hardening, failure handling (Section 9), start a long unattended test run | Getting a multi-hour unattended run going *before* the deadline crunch, so you have real logs for the demo | Extra stretch features |
| Day 2, mid | Deploy to real hosting, verify the process survives idle time, verify feed endpoint contract exactly matches spec | Contract exactness (field names, timestamp format, ordering) | Visual polish |
| Day 2, late | README, PROMPTS.md, demo script/rehearsal, final long-run log review | Demo rehearsal, README, submission logistics | Anything not required by the spec |

**Never leave for the last hour**: verifying the API contract shape matches exactly (field names, timestamp format, ordering), and confirming the process actually survives being idle/restarted — both are silent failure modes that won't show up until the judges are already polling.

**Can be safely postponed**: additional topic sources beyond one reliable one, semantic (embedding-based) dedup beyond a string-similarity placeholder, and any stretch feature from Section 16.

---

## 16. Stretch Features (only if core is solid)

| Feature | Impact | Difficulty | Time required | Rank |
|---|---|---|---|---|
| Semantic (embedding-based) duplicate detection | High — directly strengthens "memory" and "editorial judgment" scoring | Medium | Medium | 1 |
| Visible rejection log/endpoint for judges to inspect | High — directly strengthens "transparency" | Low | Low | 2 |
| Persona self-consistency checker (new draft checked against stored opinions before publish) | Medium-High — strengthens persona + memory together | Medium | Medium | 3 |
| Multiple topic sources with source-diversity balancing | Medium — improves resilience against a quiet news source | Medium | Medium | 4 |
| Adaptive threshold on drought (Section 7) | Medium — strengthens "handling empty news days" story | Low | Low | 5 |
| Lightweight admin/heartbeat dashboard for your own monitoring | Low direct score impact, high personal peace-of-mind during the 48h window | Low | Low | 6 |
| Multi-persona / multi-agent support | Low — not required by the spec, risks diluting focus | High | High | 7 |

Prioritize items 1–3 if there's spare time after the core is genuinely solid; item 7 is not worth pursuing given the actual grading criteria.

---

## Closing Note on Trade-offs

The recurring tension across this whole blueprint is **breadth vs. defensibility**: it will always be tempting to add more sources, more personas, more features. But every requirement the judges actually listed (autonomy, judgment, persona, memory, publishing-over-time, transparency, engineering quality) is better served by making a *narrow* system *provably* survive 48 hours than by making a *broad* system that might impress in a live demo but can't be verified across the actual evaluation window. Build the smallest thing that satisfies every item in Section 1's scoring table, then harden it, before reaching for Section 16.
