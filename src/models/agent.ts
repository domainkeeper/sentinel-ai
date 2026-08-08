/** The runtime persona configuration supplied by the evaluator via POST /api/agent/init. */
export interface Persona {
  /** Display name of the persona (e.g. "Ada"). */
  name: string;
  /** Domain / niche the persona writes about (e.g. "AI Security"). */
  domain: string;
}

/** A persisted agent record created at initialization. */
export interface Agent {
  /** Unique identifier returned to the evaluator. */
  id: string;
  persona: Persona;
  /** ISO 8601 UTC timestamp of creation. */
  createdAt: string;
  /** Current lifecycle state. */
  status: AgentStatus;
  /** Free-form JSON configuration snapshot for the agent. */
  config: Record<string, unknown>;
}

export type AgentStatus = "active" | "paused" | "error";