# ElectIQ — Release Readiness

Last verified: this document reflects a real, end-to-end verification
pass (fresh clone, migrations, seed, typecheck, tests, build, production
startup, live HTTP checks against real accounts) run immediately before
this document was written — not an assumption carried forward from
earlier work. See "Test/build status" below for exactly what was checked
and how.

## Current ElectIQ architecture

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS.
  Two coexisting design systems: a light theme (`eiq-*` tokens) for the
  redesigned internal screens, a separate light theme (`pub-*` tokens)
  for the public portal, and the original dark theme for internal
  features not yet part of the redesign.
- **Backend**: Next.js server components, server actions, route handlers.
- **Database**: PostgreSQL 16 + PostGIS 3.4 via Prisma ORM 7
  (driver-adapter based, not the traditional Rust query engine).
- **Auth**: NextAuth v4, credentials provider, JWT sessions, TOTP MFA.
- **Authorization**: `src/lib/rbac.ts` — permission checks are
  `(resource, action)` pairs plus a geographic-scope resolver that walks
  every descendant administrative unit of a user's assigned scope.
  Enforced server-side only; `src/middleware.ts` is a first-line-of-defense
  redirect layer, not the actual security boundary (every page also calls
  `requireSession()`/`authorize()` itself).
- **Audit**: `src/lib/audit.ts`, a tamper-evident SHA-256 hash-chained
  log every security-relevant action writes through.
- **Maps**: Leaflet + OpenStreetMap tiles (internal Election Map, Field
  Operations map, and the Public Portal's Kenya county map).
- **Real data**: Kenya's official IEBC 2022 general-election voter
  register is imported (47 counties, 292 constituencies, ~46,000 real
  polling stations, ~22.1M real registered voters) as its own country
  alongside a fictional demo country/election used for development and
  testing.

## Completed functionality

- Multi-country election/geography data model, RBAC with geographic
  scoping, audit logging (Sprint 1–2)
- Results submission → verification → approval → publication workflow,
  with immutable versioning (corrections never edit in place) (Sprint 3)
- Field operations: observer assignments, check-in, field reporting
  (Sprint 6)
- Incident management and integrity alerting, with deliberately neutral
  language throughout ("requires verification," never "fraud detected"
  without an authorized human determination) (Sprint 5–6)
- AI Copilot, scenario modeling, historical/regional analytics (Sprint
  7–9)
- Enterprise security: MFA, encryption at rest, session tracking,
  login rate limiting (Sprint 11)
- User/role/permission administration with a hard lockout guard
  (cannot leave the system with zero users able to manage users/roles),
  API key management with per-key rate limits (Sprint 13)
- Real Kenya voter-register import, cross-validated against IEBC's own
  printed totals
- Public results portal: real published-results-only data, county
  turnout visualization, reporting-progress tracking, real-time search
- Full internal UI redesign (Screens 1–7: Dashboard, Elections, Results,
  Field Operations, Incidents, Integrity, Users & Roles) plus an
  Internal UI Consolidation Phase that merged the dashboard root and
  removed now-genuinely-obsolete duplicate implementations

## Canonical routes

| Route | Screen | Notes |
|---|---|---|
| `/dashboard` | 1 | Canonical dashboard; `/` and `/command-center` both redirect here for an authenticated user |
| `/elections`, `/elections/[id]`, `/elections/new` | 2 | |
| `/results`, `/results/submissions`, `/results/submissions/[id]`, `/results/submissions/new` | 3 | `/results` is a KPI/candidate-standings overview; `/results/submissions*` is the verify/approve/publish workflow |
| `/field-operations`, `/field-operations/assignments` | 4 | Map overview + assignment management |
| `/incidents`, `/incidents/[id]`, `/incidents/new` | 5 | |
| `/integrity`, `/integrity/[id]` | 6 | |
| `/users`, `/users/roles`, `/users/roles/[id]`, `/users/permissions` | 7 | |
| `/api-management` | 7 | Separate top-level route, not nested under `/users` |
| `/public` | — | Unauthenticated public results portal |

All corresponding old `/command-center/*` routes are real `redirect()`
calls, verified live (see below), not dead links.

Not part of this redesign, remaining on the original dark theme at their
original location: `/command-center/polling-stations`,
`/command-center/turnout`, `/command-center/election-map`,
`/command-center/analytics`, `/command-center/copilot`,
`/command-center/scenarios`, `/command-center/audit-logs`,
`/command-center/reports`, `/command-center/security`.

## Security controls

- Password hashing: bcrypt, 12 rounds
- Session: HTTP-only signed cookies, 8-hour JWT expiry
- MFA: TOTP (RFC 6238)
- Login rate limiting + account lockout (5 failed attempts / 15 minutes)
- Public API rate limiting: 30 req/min anonymous, 300 req/min with a
  valid API key (SHA-256 hashed at rest, never stored in plaintext)
- Audit log: tamper-evident hash chain, verified via a dedicated
  Security page
- Public Portal security boundary: every public query hard-codes
  `PUBLISHED` as a literal status filter, never a passable parameter.
  Verified with a parameterized test covering all 9 non-`PUBLISHED`
  `ResultStatus` values individually, plus shape-assertion tests
  confirming the actual returned objects contain only their documented
  fields (so a careless future `include` can't silently leak a new
  field). Confirmed live over real HTTP as part of this verification
  pass: a real 5,000,000-vote unpublished submission had zero effect
  on the live public API.
- Internal API routes (`/api/incidents/evidence/[id]`,
  `/api/results/documents/[id]`, `/api/copilot`) confirmed to return 401
  with no authentication cookie present — verified live in this pass,
  not assumed.
- `.env` is git-ignored and confirmed not present anywhere in the full
  git history (all commits, not just current HEAD) — verified with a
  full-history search for known real credential strings in this pass.
- Every environment variable actually referenced anywhere in the
  codebase (`grep`-verified) is documented in `.env.example` — exact
  match, confirmed in this pass.

## Test/build status

All of the following were verified fresh, in this pass, immediately
before writing this document:

- **Fresh clone + install**: succeeds, with one documented ordering
  requirement — `.env` must exist (with `DATABASE_URL` set) before
  `npm install`, since `postinstall` runs `prisma generate`. README's
  Setup section now states this explicitly and in that order.
- **`prisma validate` / `prisma generate`**: both succeed.
- **Migrations + seed**: all 12 migrations apply cleanly in order to a
  genuinely fresh database (verified via direct SQL application, since
  this environment's own network restrictions block Prisma's
  schema-engine binary download — see the README's "known gotcha" note);
  `npm run seed` then succeeds against the result.
- **`npm run typecheck`**: passes, 0 errors.
- **`npm test`**: 106 tests pass across 14 files, including the 18-test
  Public Portal security suite.
- **`npm run build`**: succeeds, 0 errors, 0 warnings.
- **Production startup** (`npm run start`, `NODE_ENV=production`):
  succeeds; `/api/health` returns 200 with a connected database.
- **Auth lifecycle**: verified live — login creates a real session with
  correct user/role data, logout genuinely clears it (`{}` from
  `/api/auth/session` afterward), and a protected page correctly
  redirects back to `/login` post-logout.
- **RBAC + geographic scope**: verified live with real accounts, not
  just by reading the code — an `OBSERVER` account is correctly denied
  `/users` and `/api-management`; a `REGIONAL_OFFICER` account sees
  fewer Integrity Alerts (2) than a national `SUPER_ADMIN` account (4)
  for the same data, confirming the scope filter is genuinely narrowing
  results, not just cosmetically hiding UI elements.
- **No duplicate implementations**: every old `/command-center/*` route
  file for a migrated screen is confirmed to be a small (6–11 line)
  file containing only a `redirect()` call — checked directly, not
  assumed from the earlier redesign work.

### Dependency vulnerabilities (`npm audit`)

13 known vulnerabilities as of this writing (4 moderate, 8 high, 1
critical), investigated individually rather than reported as a raw
count:

- **1 critical — `vitest`**: a devDependency (confirmed via
  `package.json`), never included in the production build or runtime.
  Practical exposure: none in production; relevant only to local/CI test
  execution.
- **High — `postcss`, via `next`**: fix requires a Next.js major version
  bump (16.x, breaking). Deferred; tracked as a real upgrade to schedule,
  not ignored.
- **High — `sharp`, via `next`**: this is genuinely runtime-relevant now,
  since the Public Portal's hero image uses `next/image` (added after
  the redesign work). Practical exposure is low in this app specifically
  because the only image ever run through Next's image optimization is
  one static, developer-controlled asset (`kenya-election-hero.jpg`) —
  no user-uploaded or otherwise untrusted image is ever processed
  through this pipeline. This would need re-evaluating if a future
  feature adds user-uploaded image optimization.
- **High — `xlsx`**: no fix available upstream. Confirmed via `grep`
  that it is not imported anywhere in the application's own source
  code — it is an unused devDependency, likely a leftover from earlier
  data-processing work in this project's history. Safe to remove
  entirely; not done in this pass since it wasn't in scope, but flagged
  here as a straightforward, low-risk cleanup.

None of the above block a release; all are either dev-only, low practical
exposure given actual usage, or a scheduled future dependency bump.

## Known limitations

- **Two visual themes coexist by design**, not by oversight — see
  Architecture above. This is the intended state until a future phase
  chooses to migrate the remaining `/command-center/*` features too.
- **Several moved pages were not restyled internally**, only moved and
  reshelled: the results verify/approve/publish workflow, the field
  assignment/check-in workflow, the incident and integrity review
  workflows, `ElectionWizard`, and `RolePermissionEditor`. Each is a
  real, safety-critical or highest-blast-radius workflow; the judgment
  made throughout the redesign was that moving them safely was worth
  more than a cosmetic rewrite risked introducing a bug into working,
  tested logic. All were verified functionally correct after moving,
  just not visually restyled.
- **The Public Portal's Kenya county map has no real boundary data.**
  Confirmed directly (a database query found zero counties with
  boundary geometry) and confirmed no usable package or bundled asset
  exists as a substitute — one plausible-sounding npm package was
  downloaded and inspected, and turned out to contain only
  name/code hierarchy data with no actual geometry. The map component
  renders an honest "boundary data unavailable" state rather than
  fabricated shapes, and is built to render real polygons the moment
  real data exists.
- **The Public Portal's hero photo is a real, user-provided image**, not
  a placeholder — this was resolved after the redesign's initial build
  (which used a gradient placeholder specifically because no licensed
  photo was available at the time).
- **Rate limiters (public API, login) are in-memory, single-instance.**
  Fine for a single-server deployment; would need a shared store (Redis
  or similar) behind a multi-instance/serverless deployment where
  requests don't consistently land on the same process.
- **This sandbox's own network cannot reach `binaries.prisma.sh`**,
  which affects `prisma validate`/`generate`/`migrate *` here
  specifically (see README's Setup section for the workaround). This
  may or may not affect a given deployment target — verify network
  egress before relying on the Prisma CLI directly in a locked-down
  environment.
- **`xlsx` is an unused devDependency** with an unpatched high-severity
  advisory — safe, low-effort removal, not yet done (see Dependency
  vulnerabilities above).

## Remaining Public Portal work

- Real Kenya county boundary GeoJSON/TopoJSON, from a verified source
  (Kenya's own government open-data GIS portal, or a vetted
  humanitarian/OSM extract with a clear license) — the single largest
  remaining gap in the Public Portal.
- The "Downloads & Reports" panel currently serves real JSON, not
  formatted PDF reports (no PDF generation exists in this project at
  all yet) — a real, reasonable follow-up if PDF exports are wanted.
- Search currently covers county/constituency/ward/polling-station name
  matching; no fuzzy matching or typo tolerance.
- No language switcher functionality behind the header's language
  selector UI (visual only currently).
- The old, not-yet-restyled `/public/candidates`, `/public/regions`,
  `/public/turnout`, `/public/map`, `/public/updates`, `/public/election`
  sub-pages still work but are visually inconsistent with the new
  portal design and aren't linked from its navigation.

## Phase II UI modernization backlog

Everything at `/command-center/*` not covered by Screens 1–7:

- Polling Stations (list, CSV bulk import)
- Turnout tracking
- Election Map (internal GIS view)
- Analytics (regional swing, distributions, election comparison)
- ElectIQ Copilot
- Historical Analytics
- Scenario Lab
- Audit Logs browser
- Reports (results summary, turnout report exports)
- System Settings / Security page (MFA setup, audit chain verification)

Also: restyling the workflow pages moved-but-not-restyled during Screens
3, 4, 5, 6, 7 (see Known limitations above) if a fully consistent visual
system across every internal page becomes a priority.

## Deployment requirements

- PostgreSQL 16 with the PostGIS 3.4 extension available on the server
  (not just installable — the extension's files must already exist)
- Environment variables (see `.env.example`): `DATABASE_URL`,
  `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EVIDENCE_ENCRYPTION_KEY`,
  `ANTHROPIC_API_KEY` (Copilot), `NODE_ENV`
- Network egress to `binaries.prisma.sh` for any environment that will
  run the Prisma CLI directly (not required for the running app itself,
  only for `prisma generate`/`migrate`/`validate`)
- If deploying behind multiple instances or a serverless platform: the
  in-memory rate limiters (see Known limitations) will not share state
  across instances — acceptable for a single-instance deployment, a real
  gap otherwise
- Rotate all demo credentials (`ElectIQ2026!` for every seeded demo
  account) before any production or public-facing deployment
- A CI/CD pipeline exists (`.github/workflows/ci.yml`) running the same
  typecheck/test/build sequence verified in this document

## Recommended next production milestone

1. **Source and integrate real Kenya county boundary data** — the
   single highest-value remaining gap, since it's the one piece of the
   approved Public Portal design that's currently an honest placeholder
   rather than functional.
2. **Decide and execute on the `xlsx` removal and the `next` major
   version upgrade** (for the `postcss` advisory) as a small, contained
   maintenance pass — both are low-risk, well-understood fixes.
3. **Move rate limiting to a shared store** if/when this deploys behind
   more than one running instance.
4. Beyond that, Phase II UI modernization (see backlog above) is a
   scope-and-priority decision for whoever owns the roadmap next, not a
   release blocker — the app is functionally complete and secure with
   the dark-theme pages exactly as they are.
