# Sprint 6 — Field Operations

## Objective

Build ElectIQ Field: observer assignments, polling-station check-in,
field reporting (opening/turnout/counting/closing/general), turnout
snapshots, and incident reporting with a review workflow — plus a
genuine (if scope-limited) offline capture-and-sync mechanism.

## Scope

- `Observer`, `ObserverAssignment`, `FieldReport`, `TurnoutSnapshot`,
  `Incident`, `IncidentEvidence` schema + migration
- Assignment-based authorization (not administrative-unit UserScope) for
  check-in and reporting — an observer acts only on stations they're
  specifically assigned to
- New permissions: `field.manage`, `field.checkin`, `field.report`,
  `incidents.review`
- Client-side offline queue for field reports (`src/lib/field/offline-queue.ts`)
- Field Operations dashboard (observer's own assignments + admin
  assignment management) and Incidents list/detail with review workflow

## Design notes

**Assignment-based scoping, not UserScope.** Every other role in this app
is authorized via the administrative-unit `UserScope` mechanism
(`src/lib/rbac.ts`). Observers use a sharper, different mechanism —
`loadOwnAssignment()` checks whether *this specific user* has an
`ObserverAssignment` for *this specific polling station* — because an
observer's whole job is one station, not a region. This is a deliberate
second authorization pattern, not an inconsistency.

**Offline queue is real but scoped.** Section 21 describes "capture
locally → encrypt → queue → connectivity restored → synchronize → server
validates → acknowledge." What's implemented: a localStorage-backed queue
that survives a page reload and genuine connectivity loss, an
idempotency key (`clientReportId`) enforced by a database unique
constraint so a retried sync can never double-insert, and auto-flush on
the browser's `online` event. What's *not* implemented: encryption of
the queued payload at rest, and a full service-worker/IndexedDB PWA that
would survive the tab being closed while offline. Both are called out
explicitly in Known Limitations, not silently dropped.

## Database changes

`prisma/migrations/20260914000000_sprint6_field_operations/` — 5 new
enums, 6 new tables, 10 new `AuditAction` values.

## Routes

| Route | Protection |
|---|---|
| `/command-center/field` | Observers see their own assignments; `field.manage` sees the admin assignment view; a user with neither sees a plain denial |
| `/command-center/incidents` | `incidents.read` to view, `incidents.create` to report |
| `/command-center/incidents/[id]` | `incidents.read`; acknowledge/resolve/dismiss gated by `incidents.review` + the incident's geographic scope (or unscoped for a non-station-specific incident) |

## Tests

3 new tests (42 total in the suite):
- `loadOwnAssignment` correctly returns null when an assignment belongs
  to a different user, and null for a user with no Observer profile at
  all — the two failure modes that matter for this authorization pattern
- `getWardUnitIdForIncident` resolves the correct ward for a
  station-specific incident and `null` for a national-level one

The `submitFieldReport` server action itself is called programmatically
from a client component (needed for the type-dependent turnout field),
the same pattern as Sprint 2's CSV import — not curl-testable the same
way as a plain `<form action>`. Verified instead: (1) a script exercising
the exact same database operations the action performs, confirming a
`FieldReport` and its paired `TurnoutSnapshot` are created correctly and
that resubmitting the same `clientReportId` is a true no-op rather than a
duplicate; (2) TypeScript compiles the action cleanly; (3) its
authorization helper (`loadOwnAssignment`) has direct test coverage above.

## Acceptance verification — live, over real HTTP

1. **Full assignment lifecycle**: observer accepted their seeded
   assignment (`ASSIGNED → ACCEPTED`), checked in with GPS
   (`ACCEPTED → CHECKED_IN`, coordinates stored), audit trail confirmed
   in order.
2. **Field report + turnout snapshot creation** verified via direct
   database-operation replay (see Tests above) — a `FieldReport` and a
   linked `TurnoutSnapshot` were both created, and idempotent retry was
   confirmed to produce zero duplicates.
3. **Full incident lifecycle over real HTTP**: reported an incident as
   the observer, the constituency officer (same ward) saw exactly
   Acknowledge/Resolve/Dismiss while the observer's own view showed
   none, then acknowledged and resolved with notes — audit trail
   confirmed in order: `INCIDENT_CREATED` → `INCIDENT_ACKNOWLEDGED` →
   `INCIDENT_RESOLVED`.
4. **Geographic scope violation, incidents**: an incident tied to a
   different region's polling station showed zero review actions to the
   REG1-CON1-scoped officer, and a forced direct acknowledge attempt was
   rejected server-side (500, status unchanged).
5. **Assignment-ownership violation, check-in**: a user with no
   Observer profile for a given assignment (the admin, testing against
   the seeded observer's own assignment) had their forced check-in
   attempt rejected server-side.

## Known limitations

- The 500-vs-403 error page gap carried from Sprints 2–5 is unchanged.
- Offline queue: no at-rest encryption, no service-worker/IndexedDB — see
  "Design notes" above for exactly what is and isn't implemented.
- No photo/document capture UI for field reports themselves (only for
  incidents, via `IncidentEvidence`) — Section 6 lists "Photos,
  Documents" as field-report attachments too; this sprint scoped
  evidence capture to incidents only.
- `submitFieldReport`'s HTTP path itself isn't curl-tested end-to-end
  (see Tests above for what is).

## Next sprint dependencies

Sprint 7 (ElectIQ Copilot) needs, and has: a genuinely rich dataset
spanning results, integrity alerts, field reports, and incidents to
build ResultsTool/IncidentTool/FieldTool/IntegrityTool against — real
data to query, not a schema with nothing in it.
