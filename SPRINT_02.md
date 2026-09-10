# Sprint 2 — Election Data Foundation & GIS

## Objective

Build the Election Setup Wizard and full election configuration workflow,
real PostGIS geographic infrastructure, and a validated bulk-import pipeline
for polling infrastructure — extending Sprint 1's foundation without
redesigning any of it (RBAC, audit, and the geography schema are unchanged
in shape, only extended).

## Scope

- Election Setup Wizard (3-step client wizard) + election detail page
  (positions, parties, candidates management)
- PostGIS 3.4 enabled; real `geometry`/`geography` columns for
  administrative boundaries and polling center locations, with GiST indexes
- Interactive election map: choropleth by registered voters, click-to-drill
  from region → constituency → ward, polling center markers
- Bulk import: CSV upload → parse → validate → preview → confirm → import →
  audit, for polling stations
- Polling stations list page (paginated, searchable) + manual single-record
  entry form
- New `geography.manage` permission; extended `AuditAction` enum
- Three migrations (see README's "Database & migrations")

## Implemented features

- `src/lib/gis.ts`: `setUnitBoundary`, `setPollingCenterLocation`,
  `getUnitsWithBoundaries` (with drill-down via `parentId`),
  `getPollingCenterPoints`, `rectangleRing` (synthetic boundary generator
  for seeding)
- `src/lib/import/polling-stations.ts`: CSV parsing (Papaparse),
  full-hierarchy validation, duplicate detection, commit logic
- `src/lib/actions/{elections,geography,import,gis}.ts`: server actions,
  every one going through `requirePermission()` then `recordAudit()`
- `ImportJob`/`ImportError` models; `AdministrativeUnit.boundary`,
  `PollingCenter.location`
- Election Setup Wizard, election detail page, polling stations list +
  import UI, election map — see README for routes
- Sidebar updated: Elections, Candidates, Parties, Polling Stations,
  Election Map are now real links (Candidates/Parties point to the election
  detail page, where they're actually managed)

## Database changes

Three migrations (see `prisma/migrations/`): `20260911000000_sprint2_geo_import`
(PostGIS extension, boundary/location columns + GiST indexes, `ImportJob`/
`ImportError` tables, new `AuditAction` values) and
`20260911010000_import_raw_rows` (adds `ImportJob.rawRows`).

## Routes

| Route | Protection |
|---|---|
| `/command-center/elections` | `elections.read` |
| `/command-center/elections/new` | `elections.create` |
| `/command-center/elections/[id]` | `elections.read`; mutation forms gated by `elections.update` |
| `/command-center/polling-stations` | `elections.read`; manual-add form gated by `geography.manage` |
| `/command-center/polling-stations/import` | `geography.manage` |
| `/command-center/election-map` | `elections.read` |

## Security changes

- New permission `geography.manage`, granted to `SUPER_ADMIN` and
  `ELECTION_COMMISSIONER` only
- Every new server action calls `requirePermission()` before touching the
  database and `recordAudit()` after — verified live over real HTTP (see
  "Acceptance verification" below), not just at the type level
- **Known gap, not silently left out**: an unauthorized server-action
  invocation is correctly rejected (the write never happens) but currently
  surfaces as a generic HTTP 500 rather than a clean 403. Documented in the
  README's "Known limitations."

## Tests

`tests/import.test.ts` (7 tests, new) and one addition to
`tests/rbac.test.ts` (geography.manage grant check) — 17 tests total across
the suite, all against the real seeded database:

- CSV rows resolving to a real ward in the seeded geography validate as OK
- A region/constituency/ward combination that doesn't exist is flagged, not
  silently skipped
- A polling station code that already exists in the database is flagged
- A non-numeric `registered_voters` value is flagged rather than coerced
- Duplicate polling station codes within the same file are flagged
- A row with every column blank is flagged, not silently dropped
- `ELECTION_COMMISSIONER` can manage geography; `POLLING_OFFICER` cannot

Full command: `npm run seed && npm test` → all 17 pass.

## Acceptance verification — live, over real HTTP

Beyond typecheck/build/unit tests, the following was run against a live
`next start` production server, real PostgreSQL, and real PostGIS — the
same standard as Sprint 1's acceptance gate:

1. **Read paths render real data**: logged in as `commissioner@electiq.example`,
   fetched `/command-center/elections` (shows the seeded election,
   `CONFIGURED` status), the election detail page (3 positions including
   correct per-position candidate counts, 4 parties, all 4 seeded
   presidential candidates with their party abbreviations), and
   `/command-center/polling-stations` (`48 total`, correct pagination
   "Page 1 of 3", accurate Ward/Constituency/Region hierarchy per row).
2. **Write path succeeds for an authorized role**: submitted the "add
   party" form as the commissioner via the real HTML form-fallback POST
   protocol (extracted the actual `$ACTION_ID_...` field Next.js rendered,
   not a mocked call) — "Green Future Alliance" (GFA) appeared in the
   database, and a `PARTY_CREATED` audit row was written with the correct
   `newState`.
3. **Write path succeeds for the manual polling-station form, including a
   real PostGIS write**: submitted the form as the commissioner;
   `ST_AsText(location::geometry)` on the resulting `PollingCenter` returned
   `POINT(35.7 -1.2)` — the exact coordinates submitted — and a
   `POLLING_STATION_CREATED` audit row was written.
4. **The same write path is rejected for an unauthorized role**: the
   identical "add party" POST, submitted as `observer@electiq.example`
   (no `elections.update`), did not create the party (`count = 0` in the
   database afterward) — the request failed server-side before ever
   reaching the write.
5. **UI never offers what the role can't do**: the observer's rendered
   election detail page contained zero `$ACTION_ID` mutation forms.
   `polling.officer@electiq.example` (no `geography.manage`) saw no manual
   -add form and no "Import CSV" button on the polling stations page, and
   direct navigation to `/command-center/polling-stations/import` rendered
   the permission-denied message rather than the upload UI.
6. **GIS aggregation is correct**: `getUnitsWithBoundaries(0)` returns
   exactly 3 regions summing to 72,600 registered voters and 48 polling
   stations — matching the seed's own totals exactly — with valid GeoJSON
   for every region.

## Known limitations

See the README's "Known limitations" section — in short: the 500-vs-403
error page gap on unauthorized action attempts (security holds, error
presentation doesn't), Leaflet/OSM used instead of Mapbox GL JS (documented
substitution), reduced-scale geography seed, and candidates/parties managed
from the election detail page rather than separate top-level pages.

## Next sprint dependencies

Sprint 3 (Results Engine) needs from this sprint, and has it: real
`PollingStation` records to submit results against, the `geography.manage`/
`elections.*` permission pattern to extend with `results.*` enforcement,
and the audit service ready to log the full result-submission workflow
(the `AuditAction` enum already has room to grow the same way it did this
sprint).
