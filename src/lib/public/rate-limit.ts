/**
 * Section 10: "Create public APIs with rate limits." This is a simple
 * sliding-window, in-memory limiter keyed by client IP. It works
 * correctly for a single running instance; a real multi-instance
 * deployment (multiple server processes/containers behind a load
 * balancer) would need a shared store (e.g. Redis) since each instance
 * would otherwise track its own independent counters. That's a
 * deliberate, documented scope decision for this sprint, not a hidden
 * gap — see README's Known Limitations.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

export function checkRateLimit(clientKey: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(clientKey);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    buckets.set(clientKey, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetAt: now + WINDOW_MS };
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetAt: existing.windowStart + WINDOW_MS };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - existing.count,
    resetAt: existing.windowStart + WINDOW_MS,
  };
}

/** Periodically drop stale buckets so this Map doesn't grow unbounded over a long-running process. */
export function pruneRateLimitBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) buckets.delete(key);
  }
}
