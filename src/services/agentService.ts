import type { Agent, AgentStatus, Persona } from "../models/index.js";
import type { AgentRepository } from "../repositories/index.js";
import type { Scheduler } from "../agent/index.js";
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
 * Initialization creates the agent record and registers it with the
 * autonomous scheduler, which starts its lifecycle on a cadence. Init does
 * NOT generate posts or block on autonomous work — it returns immediately.
 */
export class AgentService {
  constructor(
    private readonly agents: AgentRepository,
    private readonly scheduler: Scheduler,
  ) {}

  /** Create a new agent, register its lifecycle, and return its ID. */
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
    this.scheduler.registerAgent(agent);
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