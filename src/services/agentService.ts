import type { Agent, AgentStatus, Persona } from "../models/index.js";
import type { AgentRepository } from "../repositories/index.js";
import { generateAgentId, nowIso } from "../util/ids.js";

export interface InitAgentInput {
  persona: Persona;
}

export interface InitAgentResult {
  agentId: string;
}

/**
 * Core service for agent lifecycle operations.
 *
 * In the foundation phase this handles initialization and feed retrieval.
 * The autonomous loop (scheduler → discovery → editorial → generation → memory)
 * is wired in later phases; this service is the seam where it will attach.
 */
export class AgentService {
  constructor(private readonly agents: AgentRepository) {}

  /** Create a new agent and return its ID. */
  initAgent(input: InitAgentInput): InitAgentResult {
    const agent: Agent = {
      id: generateAgentId(),
      persona: {
        name: input.persona.name.trim(),
        domain: input.persona.domain.trim(),
      },
      status: "active",
      config: {},
      createdAt: nowIso(),
    };
    this.agents.create(agent);
    return { agentId: agent.id };
  }

  /** Look up an agent by ID. */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.findById(agentId);
  }

  /** Update an agent's lifecycle status. */
  setStatus(agentId: string, status: AgentStatus): void {
    this.agents.updateStatus(agentId, status);
  }
}