import { randomUUID } from "node:crypto";

/** Generate a short, URL-safe unique identifier (e.g. "p7", "a1b2c3"). */
export function generateId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/** Generate a unique agent ID (e.g. "a1b2c3d4"). */
export function generateAgentId(): string {
  return randomUUID().slice(0, 8);
}

/** Current time as an ISO 8601 UTC string. */
export function nowIso(): string {
  return new Date().toISOString();
}