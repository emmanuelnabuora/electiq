# Sprint 4 — Live Command Center

## Objective

Connect the Results Engine to a genuinely live operational dashboard:
candidate standings, regional/constituency breakdowns, and a reporting
trend — all computed from real database queries, with near-real-time
auto-refresh, extending Sprint 1–3 without redesigning any of it.

## Scope

- `GET /api/command-center` — a dedicated, permission-gated snapshot
  endpoint the dashboard polls (Section 4/18)
- Candidate standings (live, provisional vote share per candidate)
- Regional and constituency breakdowns (reporting %, turnout %, votes cast)
- Reporting trend — a genuine time series from real `submittedAt`
  timestamps, not simulated data
- Client-side auto-refresh (20s poll interval) on the Command Center page
- Recharts for the bar/line charts (Section 4 names Recharts explicitly)

## Implemented features

- `src/lib/results/candidate-standings.ts`: live vote totals + share % per
  candidate from current (non-corrected, non-failed) submissions
- `src/lib/results/geographic-breakdown.ts`: per-region/per-constituency
  reporting completion and turnout, computed with a single recursive-join
  SQL query rather than N+1 lookups
- `src/lib/results/reporting-trend.ts`: cumulative stations-reporting and
  votes-cast over time, built from actual submission timestamps
- `src/components/command-center/live-results-panel.tsx`: client component
  polling the API and rendering candidate bar chart, reporting trend line
  chart, and regional/constituency tables
- Command Center page now renders this panel beneath the existing
  KPIs/election configuration card

## Design notes

**Live figures are explicitly labeled provisional.** Candidate standings
and regional/constituency breakdowns are computed from all current
submissions — not only `PUBLISHED` ones — because an operational Command
Center needs to show what's coming in as it arrives, the way real
election-night coverage shows unofficial tallies before certification.
The panel's header text says exactly that ("Unverified until each result
is individually approved and published"), and the workspace-level
`Verified`/`Published` counts (Sprint 3) remain the place to see
certified progress. This is a deliberate reading of Section 2's
neutrality requirement, not an oversight — nothing here is presented as
an official result.

**Turnout is computed over reporting stations only.** Dividing votes cast
by every registered voter in a region — most of which haven't reported
yet on election night — would conflate "turnout is low" with "most
stations haven't reported," which are different facts. See the doc
comment in `geographic-breakdown.ts`.

## Tests

4 new tests (31 total in the suite), all against real seeded + inserted
data:
- Candidate standings sum correctly across multiple submissions and vote
  shares sum to ~100%
- Geographic breakdown never reports more reporting stations than total
  stations, and per-region totals sum to the actual station count
- Constituency-level and region-level breakdowns agree on total station
  count
- Reporting trend is monotonically non-decreasing and chronologically
  ordered

## Acceptance verification — live, over real HTTP

- `GET /api/command-center` while unauthenticated → `401`
- Authenticated request returned a snapshot that reconciled exactly
  against two real result submissions from Sprint 3's testing: votes cast
  (2,030) = valid votes (1,950) + rejected ballots (80); candidate vote
  totals summed to exactly 1,950 (matching valid votes, not votes cast,
  since rejected ballots have no candidate attribution); vote shares
  summed to 100%; regional turnout (80%) matched votes cast ÷ registered
  voters for the one reporting station in that region.
- The Command Center page correctly includes the live panel (visible as
  its initial "Loading live results…" state in the server-rendered HTML,
  before the client-side fetch populates it — this widget is
  client-rendered by design, for the same reason the CSV import preview
  in Sprint 2 was: it needs to poll and re-render without a full page
  reload).

## Known limitations

- No headless-browser test of the fully-hydrated, chart-rendered dashboard
  — verified via the API's exact data plus a real browser would render it
  identically from the same fetch, but that render itself wasn't
  screenshotted or DOM-inspected post-hydration.
- The 20-second poll interval is simple client-side polling, not
  WebSockets/SSE — adequate for "near-real-time" per the spec's own
  wording, but not literally push-based.
- No Critical Incidents or Integrity Alerts widgets yet (Sprints 5–6);
  their tiles remain locked on the Command Center KPI row.

## Next sprint dependencies

Sprint 5 (Election Integrity) needs, and has: real result submission and
verification data to run rule-based checks against (e.g.
`HIGH_REJECTED_BALLOT_RATE` can already be computed from
`rejectedBallots`/`votesCast` on existing rows), and the audit service
pattern to log integrity alert lifecycle events the same way results
lifecycle events are logged now.
