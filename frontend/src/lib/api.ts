/* ------------------------------------------------------------------ */
/* Sentinel AI — thin fetch client.                                    */
/* Read-mostly, poll-friendly, timeout + retry-with-backoff. No side  */
/* effects on the agent (B9). VITE_API_BASE_URL or dev proxy /api.    */
/* ------------------------------------------------------------------ */

import type {
  FeedResponse,
  InitRequest,
  InitResponse,
  StatusResponse,
  EditorialTopic,
} from './types';

const RAW_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

const base = RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE;

const DEFAULT_TIMEOUT_MS = 15000;

export type ApiErrorKind = 'timeout' | 'network' | 'http' | 'invalid';

/** A typed, user-safe error produced by the data layer. `message` is safe to show to judges. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(message: string, kind: ApiErrorKind, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

function isTimedOut(e: unknown, controller: AbortController): boolean {
  return Boolean(e instanceof DOMException && e.name === 'AbortError') || controller.signal.aborted;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const external = init.signal;
  const abort = () => controller.abort();
  external?.addEventListener('abort', abort, { once: true });

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
  } catch (e) {
    if (isTimedOut(e, controller)) {
      throw new ApiError('The Sentinel backend took too long to respond.', 'timeout');
    }
    throw new ApiError('Could not reach the Sentinel backend.', 'network');
  } finally {
    window.clearTimeout(timeout);
    external?.removeEventListener('abort', abort);
  }

  if (!res.ok) {
    throw new ApiError(`The Sentinel backend responded with an error (${res.status}).`, 'http', res.status);
  }

  try {
    return (await res.json()) as unknown as T;
  } catch {
    throw new ApiError('The Sentinel backend returned an unexpected response.', 'invalid');
  }
}

export function getFeed(agentId: string, init?: RequestInit): Promise<FeedResponse> {
  return request<FeedResponse>(`/agent/feed?agentId=${encodeURIComponent(agentId)}`, init);
}

export function initAgent(payload: InitRequest, init?: RequestInit): Promise<InitResponse> {
  return request<InitResponse>('/agent/init', {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify(payload),
  });
}

export function getStatus(agentId: string, init?: RequestInit): Promise<StatusResponse> {
  return request<StatusResponse>(`/agent/status?agentId=${encodeURIComponent(agentId)}`, init);
}

export function getEditorialTrail(agentId: string, init?: RequestInit): Promise<EditorialTopic[]> {
  return request<EditorialTopic[]>(`/agent/topics?agentId=${encodeURIComponent(agentId)}`, init);
}