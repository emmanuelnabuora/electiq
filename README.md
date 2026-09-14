# ElectIQ

AI-powered election intelligence, observation, integrity, and analytics platform.
This repository currently implements **Sprint 1 — Platform Foundation** of the
12-sprint roadmap described in the master build prompt.

## Product overview

ElectIQ is a politically neutral, secure, auditable, multi-country election
intelligence platform. Sprint 1 establishes the foundation everything else is
built on: authentication, server-side RBAC with geographic scoping, the
multi-country geography/election data model, the audit architecture, and the
Command Center application shell.

Nothing in this sprint fabricates election data in the UI — every number
shown in the Command Center is a live database query. Features that don't
exist yet (Results Engine, Integrity Alerts, Copilot, etc.) are shown in the
sidebar tagged with the sprint that implements them, rather than as dead
links or fake buttons.

## Architecture

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js server components, server actions, and route handlers
- **Database**: PostgreSQL, accessed through Prisma ORM 7 (see "About the
  Prisma setup" below)
- **Auth**: NextAuth (Auth.js) v4, credentials provider, JWT sessions
- **Authorization**: custom RBAC + geographic-scope resolver
  (`src/lib/rbac.ts`) — enforced server-side only, never via UI hiding
- **Audit**: a single `recordAudit()` service (`src/lib/audit.ts`) that every
  security-relevant action writes through

## Repository structure

```
prisma/
  schema.prisma          Data model (Sprint 1 + Sprint 2)
  seed.ts                RBAC catalog + Election Management System synthetic data + GIS boundaries
  migrations/             Hand-authored + Prisma-verified SQL migrations
src/
  app/
    login/                Login page
    command-center/        Protected app shell + Command Center V1
      elections/            Elections list, wizard, detail page
      polling-stations/      Polling stations list + CSV import
      election-map/           Interactive GIS map
    api/auth/[...nextauth]/ NextAuth route handler
    api/health/             DB health check
  components/
    ui/                    Button, Card, Input, Label, Badge primitives
    nav/                   Sidebar, sign-out button
    command-center/         KPI card
    elections/              Election Setup Wizard (client)
    import/                 CSV import upload/preview/confirm flow (client)
    map/                    Leaflet election map (client)
  lib/
    db.ts                  Prisma client singleton (driver-adapter based)
    auth.ts                NextAuth config: credentials, lockout, audit
    rbac.ts                Permission + geographic scope resolution
    audit.ts               Central audit log writer
    session.ts             Server-side session helpers
    gis.ts                 PostGIS raw-SQL read/write helpers
    actions/                Server actions: elections, geography, import, gis
    import/                 CSV parsing + validation (polling stations)
  generated/prisma/         Generated Prisma Client (run `npm run prisma:generate`)
tests/
  rbac.test.ts             Permission + geographic-scope-violation tests
  import.test.ts           CSV import validation tests
  audit.test.ts            Audit generation tests
```

## Setup

```bash
npm install
docker compose up -d db      # or point DATABASE_URL at your own Postgres
npx prisma migrate dev       # applies prisma/migrations/ (includes PostGIS extension)
npm run seed                 # RBAC catalog + Election Management System synthetic data + GIS boundaries
npm run dev
```

Visit `http://localhost:3000`, sign in with any demo account below, and
you'll land on the Command Center. Postgres needs the PostGIS extension
available (the `postgis` Docker image variant, or `postgresql-*-postgis-3`
if managing your own instance) — the migration runs `CREATE EXTENSION IF
NOT EXISTS postgis`, but the extension's files must exist on the server.

Generate an `EVIDENCE_ENCRYPTION_KEY` before first run (required — see
Environment variables below):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`npm run sbom` regenerates `sbom.json` (a real CycloneDX Software Bill of
Materials); `npm run audit` runs `npm audit` for a real dependency
vulnerability scan. See `SPRINT_11.md` for the current disclosed findings.

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Base URL of the app (`http://localhost:3000` in dev) |
| `NEXTAUTH_SECRET` | Random secret for session signing — generate with `openssl rand -base64 32` |

## Database & migrations

The schema lives in `prisma/schema.prisma`. Three migrations, each authored
by hand and then **verified by actually applying it to a running
PostgreSQL 16 + PostGIS 3.4 instance** (column-by-column diffing, and for
the GIS columns, real `ST_AsText`/`ST_AsGeoJSON` round-trip checks) because
this development sandbox could not reach Prisma's binary CDN (see "About
the Prisma setup"):

- `20260910000000_init` — Sprint 1 foundation schema
- `20260911000000_sprint2_geo_import` — PostGIS extension + geometry
  columns + bulk import tracking tables + new audit actions
- `20260911010000_import_raw_rows` — adds `ImportJob.rawRows` (a small
  follow-up once the import flow's design settled on persisting parsed rows
  between preview and confirm)

Once you run `npx prisma migrate dev` in an environment with normal
internet access, Prisma will read these migrations and treat the database
as up to date — you do not need to redo anything.

## Seed data — Election Management System

`npm run seed` creates a fictional synthetic environment:

- **Country**: Election Management System
- **Election**: Election Management System General Election 2026 (Oct 12, 2026), status `CONFIGURED`
- **Geography**: 3 Regions → 2 Constituencies each → 2 Wards each → 2 Polling
  Centers each → 2 Polling Stations each (48 stations total, ~72,600
  registered voters), laid out on a grid with real PostGIS boundary polygons
  for every region/constituency/ward and a real point location for every
  polling center. This is a structurally faithful but reduced-scale seed;
  the master spec's full ~800-station target is what the bulk-import
  pipeline (built this sprint) is for, not something to hand-write here.
- **Positions**: President, Member of Parliament, Regional Governor
- **Presidential candidates**: Amara Kito (UFP), Daniel Bako (NPA), Nuru Esani
  (KRM), Lena Moro (CPC) — all fictional parties and candidates
- **11 demo users**, one per role, password `ElectIQ2026!` for all of them:

  | Email | Role | Scope |
  |---|---|---|
  | admin@electiq.example | SUPER_ADMIN | National |
  | commissioner@electiq.example | ELECTION_COMMISSIONER | National |
  | nro@electiq.example | NATIONAL_RETURNING_OFFICER | National |
  | regional.officer@electiq.example | REGIONAL_OFFICER | Regional |
  | constituency.officer@electiq.example | CONSTITUENCY_OFFICER | Constituency |
  | polling.officer@electiq.example | POLLING_OFFICER | Constituency |
  | observer@electiq.example | OBSERVER | Constituency |
  | analyst@electiq.example | ANALYST | National |
  | media@electiq.example | MEDIA_USER | National |
  | auditor@electiq.example | AUDITOR | National |
  | party.agent@electiq.example | PARTY_AGENT | Constituency |

  Rotate this password before deploying anywhere beyond local development.

## Authentication

Credentials-based login via NextAuth, JWT sessions (8 hour expiry), bcrypt
password hashing (12 rounds), account lockout after 5 failed attempts for 15
minutes, and every login attempt — success, failure, or lockout — written to
the audit log. `src/middleware.ts` gates protected routes server-side, and
every protected page additionally calls `requireSession()` before rendering
anything, so there is no path to protected data that only checks auth in the
browser.

## RBAC

Permissions are `(resource, action)` pairs (see `prisma/seed.ts` for the
full catalog across all 11 roles from the spec). Geographic scope is
separate: a `UserScope` row is either national or points at an
`AdministrativeUnit`, and `resolveUserScope()` walks every descendant of that
unit so e.g. a regional officer's scope automatically includes every
constituency and ward under their region. `authorize(userId, resource,
action, unitId?)` combines both checks and is what every protected page and
route handler should call — never infer permissions from the session's role
list directly.

Sprint 1 enforces `elections.read` (Command Center KPIs) and `audit.read`
(the audit log widget) end to end. Sprint 2 adds enforcement for
`elections.create`/`elections.update` (the wizard and all election/position/
party/candidate management) and introduces `geography.manage` (manual
polling-station entry and CSV bulk import) — all with passing tests
including a geographic-scope violation (`tests/rbac.test.ts`). The rest of
the permission catalog (`results.*`, `incidents.*`, `users.manage`) is
seeded now so Sprint 3+ can wire up enforcement without an RBAC redesign.

## Election configuration (Sprint 2)

- **Election Setup Wizard** (`/command-center/elections/new`): a 3-step
  client wizard (Basic Info → Positions → Review) that creates an election
  in `DRAFT` status via the `createElection` server action.
- **Election detail page**: add positions, parties, and candidates inline;
  change election status (`DRAFT → CONFIGURED → ACTIVE → CLOSED →
  ARCHIVED`). Candidates and parties are managed here rather than on
  separate top-level pages — the sidebar's "Candidates" and "Parties" links
  point here too, since in practice they're always edited in the context of
  a specific election.
- Every create/update/delete goes through a server action that calls
  `requirePermission()` then `recordAudit()` — never a bare Prisma call from
  a page or client component.

## GIS (Sprint 2)

PostGIS 3.4 is enabled on the database. Two columns store real geometry
rather than GeoJSON text, so they can be indexed and queried spatially:

- `AdministrativeUnit.boundary` — `geometry(MultiPolygon, 4326)`, GiST index
- `PollingCenter.location` — `geography(Point, 4326)`, GiST index

Prisma's client can't hydrate these `Unsupported(...)` columns directly —
all reads and writes go through `src/lib/gis.ts` using `$queryRaw` /
`$executeRaw`. The seed script lays the Election Management System's regions,
constituencies, and wards out on a simple non-overlapping grid (real
PostGIS polygons, synthetic coordinates) since no real survey boundary data
exists for a fictional country.

**Election Map** (`/command-center/election-map`) is built with **Leaflet +
OpenStreetMap tiles instead of Mapbox GL JS**. This is a deliberate
substitution, not a shortcut: Mapbox requires a paid API token, and Leaflet
with OSM tiles is a genuinely production-viable "equivalent GIS framework"
(the master spec's own wording) with no account or billing setup required
to run this project. Swapping to Mapbox later is a styling/tile-provider
change, not an architecture change — `src/components/map/election-map.tsx`
is the only file that would need to change. The map shows a choropleth of
registered voters by region, click-to-drill-down into constituencies and
then wards, and polling center markers.

## Bulk import (Sprint 2)

`/command-center/polling-stations/import` implements the full Section 21
workflow: **Upload → Parse → Validate → Preview → Error Report → Confirm →
Import → Audit**. Nothing is written to polling infrastructure until the
person reviews the preview (every row, valid or not, with the exact reason
for any error) and explicitly confirms. Invalid rows are never silently
dropped or "fixed" — they're skipped and recorded permanently as
`ImportError` rows tied to the `ImportJob`.

Required CSV columns: `region_code, constituency_code, ward_code,
polling_center_code, polling_center_name, polling_station_code,
polling_station_name, registered_voters` (`latitude`/`longitude` optional).
Region/constituency/ward codes must already exist — this adds polling
infrastructure to existing geography, it does not create new administrative
units from a spreadsheet.



- Passwords hashed with bcrypt (12 rounds), never logged or returned
- HTTP-only, signed session cookies (NextAuth default)
- Account lockout after repeated failed logins
- No permission decision is ever made in a client component
- `.env` is git-ignored; `.env.example` documents required variables with no
  real secrets

## Results Engine (Sprint 3)

`/command-center/results` is the workspace: filterable by status, scoped
by the signed-in user's geography, with reporting/verified/published KPIs
computed live. Submitting a result (`/command-center/results/submit`)
validates against 5 deterministic rules and creates an immutable version —
corrections never edit a row in place, they create a new one and mark the
prior version `CORRECTED`. Every transition (submit → verify/flag/dispute
→ approve → publish) is permission- and geography-checked and audited.
Evidence documents get a computed SHA-256 and are stored in Postgres
behind `src/lib/evidence.ts`, a narrow interface a real S3-compatible swap
would use.

## Live Command Center (Sprint 4)

`GET /api/command-center` is a dedicated, permission-gated snapshot
endpoint returning candidate standings, regional/constituency breakdowns,
and a reporting trend — all computed fresh from the database on every
request, nothing cached or simulated. The Command Center page polls it
every 20 seconds via `src/components/command-center/live-results-panel.tsx`
and renders it with Recharts. These figures are explicitly labeled
provisional/unverified in the UI, since they include everything reported
so far, not only published results — see `SPRINT_04.md` for why that's a
deliberate reading of the neutrality requirement, not an oversight.

## Election Integrity (Sprint 5)

`/command-center/integrity` lists alerts from all 10 rules in the master
spec, geographically scoped like everything else. Every valid result
submission is automatically scanned (`src/lib/integrity/scan.ts`) —
there's no separate "run integrity check" step. An alert is always
phrased as "requires verification" or "unusual statistical pattern,"
never a fraud determination, per Section 2. Reviewers with
`integrity.review` (scoped to their geography) can claim, resolve, or
dismiss an alert; every transition is audited.

## Field Operations (Sprint 6)

`/command-center/field` shows observers their own assignments (accept →
check in → submit reports) and gives `field.manage` roles an assignment
console. Authorization here is assignment-based, not the administrative-
unit scoping used elsewhere — an observer only ever acts on the specific
station(s) they're assigned to, checked via `loadOwnAssignment()`.
`/command-center/incidents` handles incident reporting and review
(acknowledge/resolve/dismiss), geographically scoped like results and
integrity alerts. Field reports use a real (if scope-limited — see
`SPRINT_06.md`) offline queue: `src/lib/field/offline-queue.ts` persists
unsent reports in localStorage with an idempotency key, auto-syncing
when connectivity returns.

## ElectIQ Copilot (Sprint 7)

`/command-center/copilot` is a permission-aware chat interface backed by
8 structured tools (`src/lib/copilot/tools/`) — the model never gets raw
database access, every tool re-checks RBAC and geographic scope itself.
Responses always follow ANSWER / KEY FINDINGS / DATA SOURCES /
LIMITATIONS / RECOMMENDED REVIEW, and live result figures are explicitly
marked provisional, never presented as certified. The LLM integration
(`src/lib/copilot/gateway.ts` + `providers/anthropic.ts`) is
provider-independent by design, but hasn't made a real call to
`api.anthropic.com` in this build environment — set `ANTHROPIC_API_KEY`
to enable it; see `SPRINT_07.md` for exactly what was and wasn't
verified.

## Environment variables (Copilot)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables the Copilot. Without it, the Copilot honestly reports it isn't configured rather than fabricating a response. |

## Advanced Analytics (Sprint 8)

`/command-center/analytics` compares two elections — turnout, party vote
share, regional swing, and race-competitiveness margins — plus turnout
and rejected-ballot statistical distributions for the current election.
A historical election is modeled as an ordinary `Election` row with
`status: ARCHIVED` and fully published results, not a separate schema,
so it reuses every existing results/analytics query for free. Every
comparative view is explicitly framed as descriptive, never causal (see
`SPRINT_08.md`) — a swing or a close margin describes what happened, not
why.

## Scenario Intelligence (Sprint 9)

`/command-center/scenarios` — the Scenario Lab — models 4 scenario
types (Remaining Report, Turnout Adjustment, Regional Swing, Runoff)
against the current election's real data. Every output is labeled
"MODEL ESTIMATE — NOT OFFICIAL RESULT" and persisted as a `ScenarioRun`
row with its model version, input assumptions, execution time, and a
plain-language confidence/uncertainty note — see `SPRINT_09.md` for the
exact wording each scenario type uses and why. The Swing Adjustment
scenario also reports which constituencies would change which party
leads them, standing in for "seat scenarios" since this schema's only
fully-populated race (President) isn't literally seat-based.

## Public Election Portal (Sprint 10)

`/public` (no login required) shows only officially PUBLISHED results —
Results, Candidates, Regions, Turnout, Map, Updates, and Election Data,
matching Section 10's nav exactly. Every read goes through
`src/lib/public/queries.ts`, a deliberately separate and narrower query
layer from the internal `src/lib/results/*` functions — none of its
functions accept a status filter parameter, because `PUBLISHED` is
hard-coded into every query rather than passed in. `/api/public/*`
exposes the same data as rate-limited JSON (30 requests/minute per
client; see `SPRINT_10.md` for why this is in-memory and
single-instance, not Redis-backed). Never exposed here: submitter/
verifier/approver identities, audit logs, integrity alerts, incidents, or
evidence documents.

## Enterprise Security (Sprint 11)

`/command-center/security` — MFA setup (RFC 6238 TOTP via `otplib`, with
backup codes), recent-session monitoring, and (for `audit.read` roles) a
live audit-chain integrity check and secret-configuration warnings.
Result documents, incident evidence, and MFA secrets are encrypted at
rest with AES-256-GCM (`src/lib/security/crypto.ts` — Node's standard
`crypto` module, never a custom scheme). Every audit log row is now part
of a SHA-256 hash chain that detects tampering after the fact
(tamper-*evidence*, not tamper-*prevention* — see `SPRINT_11.md`). The
login endpoint has its own IP-based rate limiter, separate from
per-account lockout and from the public API's limiter.

**Read `SPRINT_11.md` before deploying this anywhere real** — it
discloses 2 critical and 6 high-severity `npm audit` findings in
Next.js 14 that require a major-version migration not yet performed.

## Enterprise Deployment (Sprint 12)

`.github/workflows/ci.yml` runs typecheck, migrate, seed, test, build,
a dependency audit, and SBOM generation against a real
`postgis/postgis:16-3.4` service container on every push. `Dockerfile` +
`docker-entrypoint.sh` build a production image that runs
`prisma migrate deploy` before starting (safe to re-run, fails closed
rather than serving traffic against a mismatched schema).
`docker-compose.yml` runs the full stack locally. `infra/terraform/`
holds a minimal, syntax-validated AWS skeleton (RDS, ECS Fargate,
Secrets Manager) — a starting point, never applied against a real
account. See `SPRINT_12.md` for the deployment strategy recommendation
(blue-green preferred; avoid canary across schema migrations for this
app specifically) and the full production readiness review.

## Testing

```bash
npm run seed   # tests run against the seeded database
npm test
```

`tests/rbac.test.ts`, `tests/import.test.ts`, `tests/audit.test.ts`,
`tests/results-validation.test.ts`, `tests/results-aggregation.test.ts`,
`tests/command-center.test.ts`, `tests/integrity.test.ts`,
`tests/field.test.ts`, `tests/copilot-tools.test.ts`,
`tests/analytics.test.ts`, `tests/scenarios.test.ts`,
`tests/public-portal.test.ts`, and `tests/security.test.ts` are
integration tests against a real seeded Postgres database (not mocks),
because the thing worth testing here is whether the actual Prisma
queries, validation logic, and rule evaluations behave correctly against
real data — a mock would not have caught a mistake in any of them, and
in fact multiple real bugs (a stale "current election" query pattern, a
histogram off-by-one, a vote-share denominator error repeated across two
scenario modules, public pages being statically prerendered instead of
reflecting live data, and a tamper-detection test that left the real
audit chain broken via its own untidied side effect) were only found
because these tests and this build's own output were checked against
real data. All 92 pass against a live database as of Sprint 11.

## Docker

```bash
docker compose up -d
```

Builds the app image, starts Postgres, and serves the app on port 3000. Set
real values for `NEXTAUTH_SECRET` before using this beyond local development.

## About the Prisma setup

This project uses **Prisma ORM 7's Rust-free client** (`engineType =
"client"` with the `@prisma/adapter-pg` driver adapter) rather than the
legacy Rust-binary engine. This is a deliberate choice, not a workaround: it
means the app itself never needs to download or run a native query-engine
binary at runtime, which is both faster to cold-start and more portable.

Separately: **the sandbox this project was built in blocks network access to
`binaries.prisma.sh`**, which the Prisma CLI still needs once, at `generate`
time, to parse the schema — regardless of `engineType`. Every other
capability of this project (the app, the driver-adapter runtime, migrations
applied as raw SQL) works with a normal, unrestricted `DATABASE_URL` and no
special configuration. If you hit the same CDN restriction in your own CI
environment, the workaround used here was to point `PRISMA_SCHEMA_ENGINE_BINARY`
at a no-op stand-in binary for `prisma generate` only (not for `migrate dev`,
which does need the real engine) — but on any normal machine or CI runner
with outbound internet access, you will never need this and should just run
`npx prisma generate` and `npx prisma migrate dev` as documented above.

## Known limitations

Sprint 1 items (still true):

- No results workflow, incidents, AI Copilot, or public portal yet — all
  correctly shown as locked/upcoming in the Command Center and sidebar.
- User-management UI (creating/editing users and role assignments) does not
  exist yet; users are seeded directly. Planned for Sprint 11 per the
  roadmap's Administration section.

Sprint 2 items:

- An unauthorized attempt to invoke a server action (e.g. a role without
  `elections.update` submitting the add-party form directly, bypassing the
  UI) is correctly rejected — the write never happens — but currently
  surfaces as a generic HTTP 500 rather than a polished 403 page, since the
  `ForbiddenError` thrown by `requirePermission()` isn't yet caught and
  translated into a friendly error response. The security boundary holds;
  only the error presentation needs polish, ideally in Sprint 3 alongside
  the results workflow's own error handling (Section 29).
- The Election Setup Wizard assumes a single country is the common case
  (Election Management System) but does support selecting among multiple; there's
  no separate country-management screen yet, so seeding remains the way to
  add a country.
- Geography seed is reduced-scale (48 polling stations, 3 regions) relative
  to the spec's ~800-station target; the hierarchy, PostGIS boundaries, and
  constraints are real, the volume is not. The bulk-import pipeline built
  this sprint is exactly what scales this up — it's just that nobody has
  fed it an 800-row file yet.
- The election map uses Leaflet + OpenStreetMap tiles instead of Mapbox GL
  JS (see "GIS" above) — a deliberate, documented substitution to avoid
  requiring a paid API token, not an unannounced scope cut.
- Candidates and Parties are managed from the election detail page rather
  than dedicated top-level list pages; the sidebar links to both point
  there.

## Project status — Sprint 12 of 12 complete

The master spec's 12-sprint build is complete. See `SPRINT_01.md`
through `SPRINT_12.md` for each sprint's detailed objective, scope, and
verification record. **`SPRINT_12.md`'s "Production readiness review"
section is the single best entry point** for understanding what's
genuinely ready to deploy versus what remains — read it before deploying
this anywhere real.

The Next.js vulnerability disclosed in Sprint 11 is now resolved: this
app runs Next.js 15.5.24, the actually-correct patched version (Sprint
11's original research pointed to 15.5.21, superseded by a second
security release before this sprint applied it — see `SPRINT_12.md`).
