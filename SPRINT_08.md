# Sprint 8 — Advanced Analytics

## Objective

Build historical election comparison, turnout/candidate-performance
trends, regional swing, margin/competitiveness analysis, and statistical
distributions — with every comparative view treated as descriptive, never
causal (Section 8: "never imply causation from correlation without
supporting evidence").

## Design decision: historical elections reuse the live schema

Rather than a separate `HistoricalElection`/`HistoricalResult` snapshot
model, a past election is modeled as an ordinary `Election` row with
`status: ARCHIVED` and fully `PUBLISHED` `ResultSubmission` data. This
means every existing analytics/results function
(`getCandidateStandings`, `getGeographicBreakdown`, etc.) works on
historical data for free — comparison, swing, and competitiveness all
reuse Sprint 3/4's real query layer rather than a parallel one. I started
building the separate-model version before recognizing this, then rolled
it back once the better pattern was clear — no half-finished trace of it
remains in the schema.

## Scope

- `src/lib/analytics/election-comparison.ts` — turnout and party
  vote-share comparison between any two elections
- `src/lib/analytics/regional-swing.ts` — per-region/constituency vote
  share swing for one party between two elections
- `src/lib/analytics/competitiveness.ts` — leader/runner-up margin per
  unit, classified into SAFE/LIKELY/COMPETITIVE/TOSS_UP bands
- `src/lib/analytics/distributions.ts` — turnout and rejected-ballot-rate
  distributions (min/median/mean/max plus histogram buckets)
- Deterministic seed generation (`prisma/seed.ts`): a fully-published 2021
  historical election plus backfilled 2026 results, using a seeded PRNG
  (not `Math.random()`) so re-running the seed produces identical data
  rather than different results each time — with per-region "lean"
  vectors so swing and competitiveness analysis have genuine patterns to
  find, not noise
- `/command-center/analytics` — comparison dashboard

## Bugs found and fixed while building this

Real historical data exposed two genuine, pre-existing bugs immediately
on first test run — exactly the value of testing against real data:

1. **"Current election" picked by `createdAt`, not by date.** Ten
   different call sites (Command Center, Results pages, Field/Incidents
   pages, all 4 Copilot tools that touch elections, and the Topbar's
   election selector) picked "the current election" via `orderBy: {
   createdAt: "desc" }`. The moment the 2021 historical election was
   seeded *after* 2026, every one of them started treating 2021 as
   current. Fixed with a shared `src/lib/elections/current.ts` helper
   (prefers the most recent non-archived election by actual
   `electionDate`) and equivalent inline fixes at call sites with their
   own `include`/`searchParams` override logic. Caught by
   `tests/copilot-tools.test.ts`'s `ReportTool` test failing after this
   sprint's seed changes, and confirmed live: the Command Center's page
   title correctly showed 2026 while the topbar's election dropdown
   still defaulted to 2021 until the Topbar's own query got the same fix.
2. **Distribution histogram off-by-one.** `computeStats`'s bucket-edge
   arrays had one extra trailing value beyond what the bucketing logic
   needed, so the top bucket's upper bound was a real number instead of
   the intended `Infinity` — silently dropping every station above 90%
   turnout or 10% rejection rate from the histogram entirely. Caught by
   a test asserting bucket counts sum to the total reporting count.

## Tests

7 new tests (59 total in the suite), all against the real seeded 2021/2026
election pair:
- Election comparison: party shares sum to ~100% in each election, and
  every delta equals B minus A exactly
- Comparing a position that doesn't exist in either election returns a
  zeroed structure rather than throwing
- Regional swing: swing equals shareB minus shareA for every region
- Competitiveness: margins sorted closest-first, and every row's band
  matches its own classification thresholds
- Both distributions: bucket counts sum exactly to the reporting count
  (this is the test that caught the off-by-one bug), and a
  never-reported position returns an empty, non-throwing result

## Acceptance verification — live, over real HTTP

- `/command-center/analytics` (as the Analyst role) rendered a real
  comparison between the two real elections: turnout comparison, party
  performance deltas, a regional swing table, a competitiveness table
  with real SAFE/LIKELY/COMPETITIVE classifications, and both
  distribution histograms — confirmed present in the actual rendered
  HTML, not just returned by the underlying functions.
- After the "current election" fix, re-verified the Command Center's
  page title, the Topbar's election selector default, and the Analytics
  page all agree that 2026 is current and 2021 is historical.

## Known limitations

- The 500-vs-403 error page gap from earlier sprints is unchanged.
- Swing/comparison currently only supports the "President" position by
  name; a UI control to pick a different position isn't built yet.
- Competitiveness and swing queries use raw SQL joins similar to
  `geographic-breakdown.ts` — correct and tested, but a third near-
  identical query pattern that could be consolidated into one shared
  helper in a later cleanup pass.

## Next sprint dependencies

Sprint 9 (Scenario Intelligence) needs, and has: real historical swing
and turnout data to calibrate scenario assumptions against, and the
"descriptive, not predictive" framing this sprint established — Section
9 requires every model output to say "MODEL ESTIMATE — NOT OFFICIAL
RESULT," the same posture Sprint 8's analytics already take toward
comparison data.
