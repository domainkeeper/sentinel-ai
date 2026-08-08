import type { Agent, TopicCandidate, TopicDecision, TopicRecord } from "../models/index.js";
import type { Clock } from "../util/clock.js";
import { generateId } from "../util/ids.js";
import type { TopicRepository } from "../repositories/index.js";
import type {
  AgentLifecycle,
  AgentMemory,
  ContentGenerator,
  TopicDiscovery,
} from "./index.js";
import type { EditorialDecisionEngine, EditorialVerdict } from "./editorial.js";
import type { TickResult } from "./lifecycle.js";

/**
 * The autonomous lifecycle orchestrator.
 *
 * Runs one full cycle for an agent: discovery → (persist discovered
 * candidates) → editorial decision → (if approved) content generation →
 * memory → publish.
 *
 * Phase 2B:
 * - Discovery is a REAL live-source implementation.
 * - Discovered candidates are persisted to the `topics` trail in a `discovered`
 *   state (distinct from `publish`/`reject`) — discovery ≠ decision.
 * - Editorial, generation, and memory remain no-op stubs, so a cycle completes
 *   without publishing anything. That is expected and correct for this phase.
 */
export class AutonomousLifecycle implements AgentLifecycle {
  constructor(
    private readonly discovery: TopicDiscovery,
    private readonly editorial: EditorialDecisionEngine,
    private readonly generator: ContentGenerator,
    private readonly memory: AgentMemory,
    private readonly clock: Clock,
    private readonly topics: TopicRepository,
    private readonly log: (message: string) => void = () => {},
  ) {}

  /** Run one discovery → decision → generation → store cycle for an agent. */
  async tick(agent: Agent): Promise<TickResult> {
    const tickedAt = this.clock.now().toISOString();

    // 1. Discover candidate topics from live sources.
    const candidates = await this.discovery.discover(agent.id);

    // 2. Persist discovered candidates to the rejection/decision trail, in the
    //    `discovered` state (before any editorial decision). A repeated source
    //    item stored on a prior cycle is skipped, preventing duplicate rows.
    this.persistDiscovered(agent.id, candidates);

    // 3. Evaluate candidates (editorial decision).
    const verdicts = await this.editorial.evaluate(agent, candidates);

    // 3b. Persist editorial decisions (reject or approve) for the audit trail.
    this.persistDecisions(agent.id, verdicts, tickedAt);

    // 4. Pick the first approved candidate, if any.
    const approved = verdicts.find((v) => v.decision === "publish");
    if (!approved) {
      return {
        agentId: agent.id,
        tickedAt,
        considered: candidates,
        decision: "reject" as TopicDecision,
      };
    }

    // 5. Memory / duplicate check before generating.
    const isDuplicate = await this.memory.isDuplicate(agent.id, approved.candidate);
    if (isDuplicate) {
      return {
        agentId: agent.id,
        tickedAt,
        considered: candidates,
        decision: "reject" as TopicDecision,
      };
    }

    // 6. Generate content using the real generator (Phase 2D).
    let draft;
    try {
      draft = await this.generator.generate(agent, approved.candidate, approved, verdicts);
    } catch (err) {
      this.log(`[generator] error generating content for ${agent.id}: ${err instanceof Error ? err.message : String(err)}`);
      return {
        agentId: agent.id,
        tickedAt,
        considered: candidates,
        decision: "reject" as TopicDecision,
      };
    }

    // 7. Build the published topic record (post publication / persistence is a later phase).
    const topicRecord: TopicRecord = {
      id: generateId("t"),
      agentId: agent.id,
      title: approved.candidate.title,
      summary: approved.candidate.summary,
      sourceUrl: approved.candidate.sourceUrl,
      sourceName: approved.candidate.sourceName,
      discoveredAt: approved.candidate.discoveredAt,
      publishedAt: approved.candidate.publishedAt,
      decidedAt: tickedAt,
      decision: "publish",
      reasoning: {
        ...approved.reasoning,
        generatedText: draft.text,
        generatedRationale: draft.rationale,
        sources: draft.sources,
      },
    };

    return {
      agentId: agent.id,
      tickedAt,
      considered: candidates,
      decision: "publish",
      topic: topicRecord,
    };
  }

  /** Persist editorial decisions into the topics table. */
  private persistDecisions(agentId: string, verdicts: EditorialVerdict[], decidedAt: string): void {
    for (const verdict of verdicts) {
      if (this.topics.existsBySourceUrl(agentId, verdict.candidate.sourceUrl)) {
        this.topics.updateDecision(
          agentId,
          verdict.candidate.sourceUrl,
          verdict.decision,
          decidedAt,
          verdict.reasoning,
        );
        this.log(`[editorial] updated decision for ${agentId} (${verdict.candidate.sourceUrl}): ${verdict.decision}`);
      }
    }
  }

  /** Persist discovered candidates as `discovered` so they are not mis-stated as publish/reject. */
  private persistDiscovered(agentId: string, candidates: TopicCandidate[]): void {
    for (const candidate of candidates) {
      if (this.topics.existsBySourceUrl(agentId, candidate.sourceUrl)) {
        this.log(`[discovery] skipped already-persisted source for ${agentId}: ${candidate.sourceUrl}`);
        continue;
      }
      const record: TopicRecord = {
        id: generateId("t"),
        agentId,
        title: candidate.title,
        summary: candidate.summary,
        sourceUrl: candidate.sourceUrl,
        sourceName: candidate.sourceName,
        discoveredAt: candidate.discoveredAt,
        publishedAt: candidate.publishedAt,
        decidedAt: undefined,
        decision: "discovered",
        reasoning: {},
      };
      this.topics.create(record);
      this.log(`[discovery] persisted discovered candidate ${record.id} (${agentId})`);
    }
  }
}