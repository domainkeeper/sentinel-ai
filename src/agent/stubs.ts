import type { Agent, TopicCandidate, TopicDecision } from "../models/index.js";
import type {
  AgentMemory,
  ContentGenerator,
  DraftContent,
  EditorialDecisionEngine,
  EditorialVerdict,
  TopicDiscovery,
} from "./index.js";

/**
 * Phase 2A placeholder implementations of the downstream lifecycle interfaces.
 *
 * These are no-op stubs: they let the autonomous lifecycle and scheduler run
 * end-to-end without live topic discovery, editorial scoring, LLM generation,
 * or memory. They do NOT fabricate posts or fake AI content. Later phases
 * replace these with real implementations.
 */

/** No-op discovery: returns no candidate topics. */
export class NoopTopicDiscovery implements TopicDiscovery {
  async discover(_agentId: string): Promise<TopicCandidate[]> {
    return [];
  }
}

/** No-op editorial engine: rejects everything (no candidates to evaluate). */
export class NoopEditorialEngine implements EditorialDecisionEngine {
  async evaluate(_agent: Agent, candidates: TopicCandidate[]): Promise<EditorialVerdict[]> {
    return candidates.map((candidate) => ({
      candidate,
      decision: "reject" as TopicDecision,
      reasoning: { reason: "no-op editorial engine (Phase 2A)" },
    }));
  }
}

/** No-op generator: never called in Phase 2A (nothing is published). */
export class NoopContentGenerator implements ContentGenerator {
  async generate(_agent: Agent, _topic: TopicCandidate): Promise<DraftContent> {
    throw new Error("NoopContentGenerator is not implemented (Phase 2A)");
  }
}

/** No-op memory: no posts, never a duplicate. */
export class NoopAgentMemory implements AgentMemory {
  async recentPosts(_agentId: string, _limit?: number) {
    return [];
  }

  async isDuplicate(_agentId: string, _candidate: TopicCandidate): Promise<boolean> {
    return false;
  }
}