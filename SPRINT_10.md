# Sprint 10 — Public Election Portal

## Objective

Build an independent public experience — reachable with zero
authentication — that only ever exposes officially PUBLISHED results,
never unverified data, internal alerts, private incidents, observer
identities, audit logs, or restricted evidence (Section 31), backed by a
rate-limited public API (Section 10).

## Scope

- `src/lib/public/queries.ts` — the only sanctioned data-access layer for
  the public portal; every function hard-codes `status: "PUBLISHED"`
  with no parameter that could widen it
- `src/lib/public/rate-limit.ts` — in-memory sliding-window limiter (30
  requests/minute per client)
- `/public/*` — 7 pages matching Section 10's exact nav: Results,
  Candidates, Regions, Turnout, Map, Updates, Election Data
- `/api/public/*` — 4 rate-limited JSON endpoints backing the same data
- A discoverability link from the login page to the public portal

## Design discipline: a separate query layer, on purpose

`src/lib/public/queries.ts` is deliberately a different, narrower set of
functions than `src/lib/results/*`, which power the internal Command
Center and intentionally include unverified/in-progress data for
operational visibility. Mixing the two up — e.g. having a public page
accidentally import an internal "current" aggregate function — is
exactly the mistake Section 31 warns about ("never depend on frontend
hiding"). Every public page and API route in this sprint imports only
from `src/lib/public/`, never from `src/lib/results/` or `src/lib/gis.ts`
directly.

## A real bug found from the build output itself, not a test

`next build` initially marked all 7 public pages as `○` (statically
prerendered at build time). For a portal whose entire purpose is showing
live-updating published results, that would have meant every visitor
saw whatever data existed at the last deployment, frozen, until the next
build — a serious correctness problem that no functional test would
have caught, since the pages would still "work," just with stale data.
Caught by reading the build output carefully rather than assuming a
passing build means correct behavior. Fixed by adding `export const
dynamic = "force-dynamic"` to every public page. This also surfaced a
naming collision in the Map page, which already imported `dynamic` from
`next/dynamic` for its client-only Leaflet loader — resolved by aliasing
that import to `nextDynamic`.

## Tests

7 new tests (77 total in the suite), all against real seeded + inserted
data:
- An `AWAITING_REVIEW` submission with a deliberately absurd 999,999-vote
  count contributes exactly zero to public candidate standings
- A `PUBLISHED` submission's votes are correctly included
- A `VERIFIED` (not yet published) submission never counts toward a
  region's public vote/reporting totals
- Every station code returned by the public updates feed corresponds to
  an actually-`PUBLISHED` submission
- `getPublicElection` exposes only safe configuration fields (no internal
  IDs like `countryId`)
- The rate limiter allows exactly 30 requests per window and blocks the
  31st; independent clients are tracked separately

## Acceptance verification — live, over real HTTP, with zero authentication

- Every one of the 7 public pages returned `200` with no session cookie
  at all — confirmed by omitting `-b cookies.txt` entirely from every
  request — while `/command-center` still correctly redirected (`307`)
  in the same session.
- The public Results page's rendered vote count (14,606 for the leading
  candidate) matched a direct `status='PUBLISHED'`-only database query
  exactly, byte for byte.
- The live rate limiter was exercised against the actual running API, not
  just its unit tests: 30 requests succeeded, the 31st and 32nd both
  returned `429`, and both success and `429` responses correctly carried
  `X-RateLimit-Remaining`/`X-RateLimit-Reset` headers.

## Known limitations

- **The rate limiter is in-memory and single-instance.** A real
  multi-instance deployment (multiple server processes/containers behind
  a load balancer) would need a shared store (Redis) since each instance
  would otherwise track independent counters, effectively multiplying
  the real limit by the instance count. Stated in the rate-limiter's own
  code comment, not just here.
- The 500-vs-403 error page gap from earlier sprints doesn't apply to the
  public API (it returns proper JSON status codes throughout), but
  internal server errors on public pages themselves would still hit
  Next.js's generic error page rather than a branded public-facing one.
- The public Map only shows region-level turnout, not the polling-center
  markers the internal admin map has — a deliberate scope reduction, not
  an oversight, to keep the public data surface minimal.
- "Election Data" and "Candidates" pages show only the headline
  President race's context; Member of Parliament and Regional Governor
  positions render with zero candidates, matching the same underlying
  seed-data gap noted since Sprint 2.

## Next sprint dependencies

Sprint 11 (Enterprise Security) needs, and has: a working authentication
system to harden (MFA/SSO/OIDC), and now also a public, unauthenticated
surface area that any WAF/rate-limiting/DDoS hardening work must
explicitly account for as a distinct, lower-trust boundary from the
authenticated Command Center.
