import type { NextRequest } from "next/server";

/** Best-effort client identifier for rate limiting — the first entry in X-Forwarded-For (set by most reverse proxies/load balancers), falling back to a constant so at least a global limit still applies if no proxy header is present (e.g. direct local access). */
export function getClientKey(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown-client";
}
