import type { Agent, TopicDecision, TopicRecord } from "../models/index.js";
import type { Clock } from "../util/clock.js";
import { generateId } from "../util/ids.js";
import type {
  AgentLifecycle,
  AgentMemory,
  ContentGenerator,
  EditorialDecisionEngine,
  TopicDiscovery,
} from "./index.js";
import type { TickResult } from "./lifecycle.js";

/**
 * The autonomous lifecycle orchestrator.
 *
 * Runs one full cycle for an agent: discovery → editorial decision → (if
 * approved) content generation → memory/duplicate check → persist.
 *
 * In Phase 2A the downstream components are no-op stubs, so a cycle completes
 * without publishing anything. This class is the seam where real discovery,
 * editorial, generation, and memory plug in during later phases.
 */
export class AutonomousLifecycle implements AgentLifecycle {
  constructor(
    private readonly discovery: TopicDiscovery,
    private readonly editorial: EditorialDecisionEngine,
    private readonly generator: ContentGenerator,
    private readonly memory: AgentMemory,
    private readonly clock: Clock,
  ) {}

  /** Run one discovery → decision → generation → store cycle for an agent. */
  async tick(agent: Agent): Promise<TickResult> {
    const tickedAt = this.clock.now().toISOString();

    // 1. Discover candidate topics.
    const candidates = await this.discovery.discover(agent.id);

    // 2. Evaluate candidates (editorial decision).
    const verdicts = await this.editorial.evaluate(agent, candidates);

    // 3. Pick the first approved candidate, if any.
    const approved = verdicts.find((v) => v.decision === "publish");
    if (!approved) {
      return {
        agentId: agent.id,
        tickedAt,
        considered: candidates,
        decision: "reject" as TopicDecision,
      };
    }

    // 4. Memory / duplicate check before generating.
    const isDuplicate = await this.memory.isDuplicate(agent.id, approved.candidate);
    if (isDuplicate) {
      return {
        agentId: agent.id,
        tickedAt,
        considered: candidates,
        decision: "reject" as TopicDecision,
      };
    }

    // 5. Generate content (Phase 2A: no-op generator is never reached because
    //    the no-op editorial engine never approves a candidate).
    const draft = await this.generator.generate(agent, approved.candidate);

    // 6. Persist the post (Phase 2A: not yet wired to a post repository).
    const topicRecord: TopicRecord = {
      id: generateId("t"),
      agentId: agent.id,
      title: approved.candidate.title,
      summary: approved.candidate.summary,
      sourceUrl: approved.candidate.sourceUrl,
      sourceName: approved.candidate.sourceName,
      discoveredAt: approved.candidate.discoveredAt,
      decidedAt: tickedAt,
      decision: "publish",
      reasoning: approved.reasoning,
    };

    return {
      agentId: agent.id,
      tickedAt,
      considered: candidates,
      decision: "publish",
      topic: topicRecord,
      // `draft` is intentionally unused in Phase 2A; it will be persisted in a later phase.
    };
  }
}