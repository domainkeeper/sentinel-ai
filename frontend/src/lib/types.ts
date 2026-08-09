/* ------------------------------------------------------------------ */
/* Sentinel AI — API types (mirror of the backend contract).          */
/* The frontend holds no business logic; it renders what the backend  */
/* already persists. New polling will keep this thin (B9).            */
/* ------------------------------------------------------------------ */

export interface Post {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
}

export interface FeedResponse {
  posts: Post[];
}

export interface InitRequest {
  persona: {
    name: string;
    domain: string;
  };
}

export interface InitResponse {
  agentId: string;
}

export interface AgentStatus {
  agentId: string;
  processUp: boolean;
  lastCycleAt: string | null;
  lastPublicationAt: string | null;
  nextCycleAt: string | null;
}

export interface StatusResponse {
  status: AgentStatus;
}

export type EditorialDecision =
  | 'discovered'
  | 'reject'
  | 'publish';

export interface EditorialTopic {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  discoveredAt: string;
  sourcePublishedAt: string | null;
  decidedAt: string | null;
  decision: EditorialDecision;
  reasoning: Record<string, unknown> | null;
}