import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, API_KEY_MAX_REQUESTS_PER_WINDOW } from "@/lib/public/rate-limit";
import { getClientKey } from "@/lib/public/client-key";
import { db } from "@/lib/db";
import { hashApiKey } from "@/lib/security/api-keys";

/**
 * Wraps a public API handler with the rate limiter from Section 10.
 * Returns a 429 with standard rate-limit headers if the caller is over
 * the limit; otherwise runs the handler and attaches the same headers to
 * a successful response so callers can see their remaining quota.
 *
 * Sprint 13: an X-API-Key header, if present and valid (exists, not
 * revoked), gets a materially higher per-key limit instead of the
 * anonymous per-IP one, and updates the key's lastUsedAt. An invalid or
 * revoked key is NOT an error by itself -- the request just falls back
 * to the ordinary anonymous IP limit, since presenting a bad key isn't a
 * reason to refuse a request every anonymous caller is already allowed
 * to make.
 */
export async function withRateLimit(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const presentedKey = req.headers.get("x-api-key");
  let rateLimitKey = `ip:${getClientKey(req)}`;
  let maxRequests: number | undefined;

  if (presentedKey) {
    const keyHash = hashApiKey(presentedKey);
    const record = await db.apiKey.findUnique({ where: { keyHash } });
    if (record && !record.revokedAt) {
      rateLimitKey = `key:${record.id}`;
      maxRequests = API_KEY_MAX_REQUESTS_PER_WINDOW;
      db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }
  }

  const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, maxRequests);

  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(resetAt),
        },
      }
    );
  }

  const response = await handler();
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(resetAt));
  return response;
}
