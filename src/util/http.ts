/**
 * Minimal HTTP helpers for live topic sources.
 *
 * The only external request type discovery needs is a GET that returns a
 * text body (an RSS/XML document). Every request gets a finite timeout so a
 * misbehaving or unreachable source can never hang the autonomous scheduler.
 */

const DEFAULT_HEADERS: Record<string, string> = {
  accept: "application/rss+xml, application/xml, text/xml, text/plain;q=0.8, */*;q=0.5",
  "user-agent": "SentinelAI/0.1 (autonomous topic discovery)",
};

export interface FetchTextOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Fetch a URL and return its body as text, enforcing a finite timeout.
 *
 * Throws on: network failure, DNS failure, timeout, non-2xx HTTP status.
 * Callers treat a throw as "this source failed this tick".
 */
export async function fetchText(
  url: string,
  options: FetchTextOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { ...DEFAULT_HEADERS, ...options.headers },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}