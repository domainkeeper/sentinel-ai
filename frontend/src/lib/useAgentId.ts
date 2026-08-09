import { useSearchParams } from 'react-router-dom';

/**
 * The frontend is read-only: it is pointed at an existing, already-initialized
 * agent via a URL query param (`?agentId=<id>`). It never initializes, triggers
 * generation, or mutates agent state. This hook simply reads that id.
 */
export function useAgentId(): string | null {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('agentId');
  return id && id.trim().length > 0 ? id.trim() : null;
}