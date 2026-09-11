# Sprint 9 — Scenario Intelligence

## Objective

Build the Election Scenario Lab: turnout, remaining-report, regional
swing, and runoff scenario modeling, with every output visually and
textually marked "MODEL ESTIMATE — NOT OFFICIAL RESULT" and persisted
with model version, assumptions, execution time, and a confidence/
uncertainty note (Section 9's exact storage requirements).

## Scope

- `ScenarioRun` schema + migration
- `src/lib/scenarios/remaining-report.ts` — projects a final total from
  currently-reported stations' turnout rate and vote shares
- `src/lib/scenarios/turnout-scenario.ts` — models a uniform turnout
  shift, holding vote share constant
- `src/lib/scenarios/swing-scenario.ts` — applies a uniform vote-share
  swing to one party, drawn proportionally from the others, plus a
  constituency-impact analysis (which constituencies would change which
  party leads them)
- `src/lib/scenarios/runoff-scenario.ts` — models a two-candidate runoff
  when no one has a majority, redistributing eliminated candidates' votes
  proportionally to the top two
- `/command-center/scenarios` — the Scenario Lab UI + a persisted
  scenario history table

## Design note: "seat scenarios" without a seat-based race

The master spec calls for "seat scenarios" and "seat/runoff scenarios
where applicable." This schema's only fully-populated multi-constituency
race is President, which isn't literally seat-based. Rather than skip
the requirement or fake per-constituency parliamentary seats that don't
exist in the seed data, the Swing Adjustment scenario reports how many
constituencies would change which party currently leads them under the
modeled swing — a genuine, computed geographic-impact analysis that
serves the same purpose ("how does this change translate geographically")
without pretending a seat count exists where it doesn't.

## Bugs found and fixed while building this

Testing against real data caught the same class of bug Sprint 8 found in
a different function — worth naming as a pattern by now: **candidate
votes sum to valid votes, not votes cast**, because rejected ballots have
no candidate attribution. Both `remaining-report.ts` and
`turnout-scenario.ts` were computing candidate vote shares against
`votesCast` instead of `validVotes`, so shares summed to roughly 95%
instead of 100% — short by exactly the rejected-ballot rate (~4.6% in the
real seeded data). Caught by a test asserting shares sum to 100%, fixed
in both modules by deriving a `validVoteRatio` and applying it
consistently, while keeping the turnout/participation figures (which
correctly include rejected ballots) separate from the share-calculation
base.

## Tests

11 new tests (70 total in the suite), all against real seeded data:
- Remaining Report: projected total ≥ reported total, shares sum to
  ~100% (the test that caught the bug above), and a non-existent position
  returns an empty result rather than throwing
- Turnout Adjustment: increasing/decreasing turnout moves projected votes
  in the right direction, adjustment clamps to 0–100%, share is held
  constant under scaling, and shares sum to ~100%
- Swing Adjustment: the target party's share increases, total share stays
  ~100%, and constituency counts never exceed the actual number of
  constituencies
- Runoff: either no runoff is required (leader has a majority) or the
  modeled runoff's two shares sum to ~100% with the leader still ahead;
  a position with no candidates returns a non-runoff result rather than
  throwing

## Acceptance verification — live, and via direct computation replay

- `/command-center/scenarios` rendered correctly for the Analyst role
  (all four scenario types listed, empty history table) and correctly
  denied a role without `results.read` — confirmed by inspecting the
  actual HTML for the denial message, not just the HTTP status.
- `runScenario` is called programmatically from a client component
  (needed for scenario-type-dependent form fields, the same pattern as
  Sprint 6's field reports) and so isn't curl-testable the same way as a
  plain `<form action>`. Verified instead by replaying its exact
  computation and persistence logic directly: a real +5-point UFP swing
  computed a genuine constituency flip (UFP's projected constituency
  count went from 2 to 3, gaining "Central Region Constituency 2"), and
  the resulting `ScenarioRun` row persisted and re-fetched correctly with
  its model version, assumptions, and confidence note intact — then
  confirmed it appeared in the page's scenario history table.

## Known limitations

- **The direct-replay verification above bypassed `recordAudit()`**,
  since it called the underlying scenario functions and a manual
  `db.scenarioRun.create()` rather than the real `runScenario` action
  (which isn't reachable via the plain-form curl protocol). The action's
  audit call is a single line matching a pattern proven correct via real
  HTTP in every other sprint, but I want to say plainly that this
  specific line wasn't exercised by an HTTP-level test here, rather than
  imply it was.
- The 500-vs-403 error page gap from earlier sprints is unchanged.
- Scenarios only support the "President" position; no UI control to
  model Member of Parliament or Regional Governor scenarios yet (those
  positions have no candidates seeded regardless — see Sprint 2's known
  limitations).
- No scenario deletion or re-run comparison UI — history is
  append-only and read-only display for now.

## Next sprint dependencies

Sprint 10 (Public Election Portal) needs, and has: the same
"never invent, always caveat" discipline established across Sprints 8–9
to apply to public-facing content, and PUBLISHED-only result data
(already the sole source Section 12's aggregation rules ever recommend
for anything official) to build the public-facing views from.
