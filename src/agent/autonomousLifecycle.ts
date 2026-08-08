import type { Agent, Post, TopicCandidate, TopicDecision, TopicRecord } from "../models/index.js";
import type { Clock } from "../util/clock.js";
import { generateId } from "../util/ids.js";
import type { PostRepository, TopicRepository } from "../repositories/index.js";
import type {
  AgentLifecycle,
  AgentMemory,
  ContentGenerator,
  TopicDiscovery,
} from "./index.js";
import type { EditorialDecisionEngine, EditorialVerdict } from "./editorial.js";
import type { TickResult } from "./lifecycle.js";
import type { PublishingPolicy } from "./publishingPolicy.js";

/**
 * The autonomous lifecycle orchestrator (Phase 3A).
 *
 * Runs one full cycle for an agent:
 * Discovery → Persist Discovered → Editorial Decision → Memory Pre-Check → Publishing Policy → Generate → Final Memory Check → Publish & Persist → Remember.
 */
export class AutonomousLifecycle implements AgentLifecycle {
  constructor(
    private readonly discovery: TopicDiscovery,
    private readonly editorial: EditorialDecisionEngine,
    private readonly generator: ContentGenerator,
    private readonly memory: AgentMemory,
    private readonly publishingPolicy: PublishingPolicy,
    private readonly clock: Clock,
    private readonly topics: TopicRepository,
    private readonly posts: PostRepository,
    private readonly log: (message: string) => void = () => {},
  ) {}

  /** Run one complete autonomous cycle for an agent. */
  async tick(agent: Agent): Promise<TickResult> {
    const tickedAt = this.clock.now().toISOString();

    // 1. Discover candidate topics from live sources.
    const candidates = await this.discovery.discover(agent.id);

    // 2. Persist discovered candidates to the rejection/decision trail (`discovered` state).
    this.persistDiscovered(agent.id, candidates);

    // 3. Evaluate candidates (editorial decision).
    const verdicts = await this.editorial.evaluate(agent, candidates);

    // 3b. Persist editorial decisions for the audit trail.
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

    // 5. Memory Pre-Check (before expensive LLM generation).
    const isTopicDuplicate = await this.memory.isDuplicate(agent.id, approved.candidate);
    if (isTopicDuplicate) {
      this.log(`[memory] pre-check rejected candidate for agent ${agent.id}: topic is a duplicate/near-duplicate`);
      return {
        agentId: agent.id,
        tickedAt,
        considered: candidates,
        decision: "reject" as TopicDecision,
      };
    }

    // 6. Publishing Policy Check (cooldown & sliding window frequency cap).
    const policyDecision = this.publishingPolicy.evaluate(agent.id);
    if (!policyDecision.allowed) {
      this.log(`[publishing-policy] publishing blocked for agent ${agent.id}: ${policyDecision.reason}`);
      return {
        agentId: agent.id,
        tickedAt,
        considered: candidates,
        decision: "reject" as TopicDecision,
      };
    }

    // 7. Content Generation.
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

    // 8. Final Memory Check (check generated text against recent memory/duplicates).
    // Construct a pseudo-candidate representing the generated post for duplicate verification.
    const postCandidate: TopicCandidate = {
      title: approved.candidate.title,
      summary: draft.text,
      sourceUrl: approved.candidate.sourceUrl,
      sourceName: approved.candidate.sourceName,
      discoveredAt: approved.candidate.discoveredAt,
      publishedAt: approved.candidate.publishedAt,
    };
    const isPostDuplicate = await this.memory.isDuplicate(agent.id, postCandidate);
    if (isPostDuplicate) {
      this.log(`[memory] final check blocked post for agent ${agent.id}: generated content is repetitive`);
      return {
        agentId: agent.id,
        tickedAt,
        considered: candidates,
        decision: "reject" as TopicDecision,
      };
    }

    // 9. Create and persist the final published post.
    const postId = generateId("p");
    const post: Post = {
      id: postId,
      agentId: agent.id,
      createdAt: tickedAt,
      text: draft.text,
      rationale: draft.rationale,
      sources: draft.sources,
    };

    try {
      this.posts.create(post);
      this.log(`[publishing] persisted post ${postId} for agent ${agent.id}`);
    } catch (err) {
      this.log(`[publishing] error persisting post for ${agent.id}: ${err instanceof Error ? err.message : String(err)}`);
      return {
        agentId: agent.id,
        tickedAt,
        considered: candidates,
        decision: "reject" as TopicDecision,
      };
    }

    // 10. Build published topic record for audit trail.
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
        postId,
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

  /** Persist discovered candidates as `discovered`. */
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
