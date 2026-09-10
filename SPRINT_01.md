# Sprint 1 — Platform Foundation

## Objective

Establish the platform ElectIQ is built on: authentication, server-side RBAC
with geographic scoping, the multi-country geography/election data
foundation, the audit architecture, and the Command Center application
shell — with a real, working acceptance gate rather than a UI that merely
renders.

## Scope

- Next.js 14 + TypeScript + Tailwind application shell
- PostgreSQL + Prisma data model for identity, RBAC, multi-country
  geography, election foundation, and audit
- Credentials authentication (NextAuth) with lockout and full audit trail
- Server-side RBAC: `(resource, action)` permissions + geographic scope
  resolution via `AdministrativeUnit` tree walking
- Republic of Karibu synthetic election, geography, and 11 demo users (one
  per spec role)
- Command Center V1: real KPIs from the database, permission-gated audit
  widget, sidebar showing the full information architecture with unbuilt
  sections honestly marked by sprint number
- Docker, docker-compose, README, this document

## Implemented features

- `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `UserScope`
- `Country`, `AdministrativeLevel`, `AdministrativeUnit` (generic
  parent/child hierarchy — no country's structure is hardcoded)
- `PollingCenter`, `PollingStation`
- `Election`, `ElectionPosition`, `Party`, `Candidate`
- `AuditLog`
- `src/lib/rbac.ts`: `hasPermission`, `resolveUserScope`, `authorize`,
  `requirePermission`
- `src/lib/auth.ts`: NextAuth credentials provider, bcrypt hashing, lockout
  after 5 failed attempts / 15 minutes, audit logging on every outcome
- `src/lib/audit.ts`: central `recordAudit()` used by every write path
- `src/middleware.ts` + `requireSession()`: server-side route protection
- Login page, Command Center layout + page, sidebar, KPI cards
- `prisma/seed.ts`: 11-role permission catalog, Republic of Karibu geography
  (reduced scale — see README), election + parties + candidates, 11 demo
  users with correct role and scope assignment

## Database changes

Initial schema — see `prisma/schema.prisma` and
`prisma/migrations/20260910000000_init/migration.sql`. 16 tables, 3 enums.

## Routes

| Route | Protection |
|---|---|
| `/` | Redirects to `/command-center` or `/login` based on session |
| `/login` | Public |
| `/command-center` | `requireSession()` + per-widget `authorize()` checks |
| `/api/auth/[...nextauth]` | NextAuth handler |
| `/api/health` | Public — DB connectivity check |

## APIs

None beyond NextAuth's own callback routes and `/api/health` this sprint.
The `/api/v1/*` surface from Section 18 of the master spec begins in later
sprints once there is real election/results data to expose.

## Security changes

- bcrypt password hashing (12 rounds)
- Account lockout after 5 failed logins (15 minutes)
- Every login outcome (success, failure, lockout) audited
- All authorization server-side; no permission logic in client components
- Next.js pinned to 14.2.35 (patched against the December 2025 RSC
  DoS/source-exposure advisories, CVE-2025-55184 / CVE-2025-55183)

## Tests

`tests/rbac.test.ts` (7 tests) and `tests/audit.test.ts` (2 tests) — run
against a real seeded PostgreSQL database, not mocks:

- SUPER_ADMIN holds every seeded permission
- POLLING_OFFICER can submit results but cannot read the audit log
- MEDIA_USER is read-only with no results access
- A nationally-scoped user resolves `isNational: true`
- A constituency-scoped user's resolved units include that constituency's
  wards
- **Geographic scope violation**: `authorize()` allows verification within a
  constituency officer's own constituency and denies it for a different
  region's constituency
- `authorize()` denies an action the role was never granted, regardless of
  geography
- Audit rows are written with the correct shape for both system-level and
  actor-attributed events

All 9 pass. Full command: `npm run seed && npm test`.

## Acceptance gate — verified live

The Sprint 1 gate from the master spec is:

```
LOGIN → SESSION CREATED → ROLE RESOLVED → PERMISSION ENFORCED
     → COMMAND CENTER → ELECTION DATA → AUDIT EVENT
```

This was run against a real `next start` production build, real
PostgreSQL, and the actual NextAuth HTTP endpoints (not simulated):

1. **Unauthorized access fails server-side**: `GET /command-center` while
   unauthenticated → `307` redirect to `/login` (via `middleware.ts`,
   before any protected data is fetched).
2. **LOGIN**: wrong password for `commissioner@electiq.example` → `401`,
   and an `LOGIN_FAILED` row appears in `audit_logs` with `reason: Invalid
   password`.
3. **LOGIN → SESSION CREATED → ROLE RESOLVED**: correct password → `200`;
   `GET /api/auth/session` returns
   `{"user":{"name":"Wanjiru Kamau","roles":["ELECTION_COMMISSIONER"], ...}}`.
4. **PERMISSION ENFORCED**: logging in as `polling.officer@electiq.example`
   (no `audit.read`) instead of the commissioner produces a Command Center
   page **without** the "Recent Audit Events" section — the same page,
   rendered differently based on server-resolved permissions, not a
   client-side toggle.
5. **COMMAND CENTER → ELECTION DATA**: both users reach `/command-center`
   with `200` and see `CONFIGURED` (the election's real status) and the
   real `Registered Voters` KPI computed from `PollingStation` rows.
6. **AUDIT EVENT**: `audit_logs` after both logins shows two `LOGIN` rows
   with correct timestamps alongside the earlier `LOGIN_FAILED`.

## Known limitations

See the README's "Known limitations" section — in short: no CRUD UI yet for
elections/candidates/parties (seed-only), only two permissions are enforced
by an actual page this sprint, geography seed is reduced-scale, and no
results/GIS/incidents/AI features exist yet (all correctly marked upcoming
in the UI rather than faked).

One environment-specific note: the sandbox this was built in blocks
`binaries.prisma.sh`, so `npx prisma generate` needed a one-time local
workaround to run here (documented in the README's "About the Prisma setup"
section). This does not affect normal development machines or CI runners
with unrestricted outbound internet access.

## Next sprint dependencies

Sprint 2 (Election Data Foundation & GIS) needs from this sprint, and has
it: the `Election`/`Party`/`Candidate`/geography schema to build CRUD and
bulk-import against, the RBAC permission catalog (`elections.create`,
`elections.update`) already seeded and ready to enforce, and the audit
service ready to log `ELECTION_CREATED` / `ELECTION_UPDATED` events (already
present in the `AuditAction` enum).
