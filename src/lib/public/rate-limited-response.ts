import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/public/rate-limit";
import { getClientKey } from "@/lib/public/client-key";

/**
 * Wraps a public API handler with the rate limiter from Section 10.
 * Returns a 429 with standard rate-limit headers if the caller is over
 * the limit; otherwise runs the handler and attaches the same headers to
 * a successful response so callers can see their remaining quota.
 */
export async function withRateLimit(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const clientKey = getClientKey(req);
  const { allowed, remaining, resetAt } = checkRateLimit(clientKey);

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
