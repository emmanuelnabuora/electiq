/**
 * Section 11: "Rate limiting," applied here to the login endpoint
 * specifically — distinct from the per-user account lockout in
 * src/lib/auth.ts (5 failed attempts on ONE account) and from the public
 * API limiter in src/lib/public/rate-limit.ts. This one is IP-based and
 * exists to slow down credential-stuffing / username-enumeration attempts
 * spread across MANY different accounts from a single source, which
 * per-account lockout alone doesn't address. Same in-memory,
 * single-instance caveat as the public API limiter — see its own comment
 * for why a real multi-instance deployment needs a shared store.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60_000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 20;

export function checkLoginRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const existing = buckets.get(clientKey);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    buckets.set(clientKey, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return false;
  }

  existing.count++;
  return true;
}
