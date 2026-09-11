# Sprint 5 — Election Integrity

## Objective

Build rule-based integrity monitoring: all 10 rules from the master spec,
each a genuine statistical/procedural check against real data, feeding a
human-review workflow — never an automated fraud determination (Section 2).

## Scope

- `IntegrityAlert` schema + migration
- All 10 integrity rules (`src/lib/integrity/scan.ts`), run automatically
  after every successful result submission
- Alert review workflow: OPEN → UNDER_REVIEW (claimed) → RESOLVED/DISMISSED
- New permissions `integrity.read` / `integrity.review`, geographically
  scoped like every other permission in this app
- Integrity alerts list (filterable, scoped) and detail page (evidence,
  linked result, review actions)
- Command Center's Integrity Alerts KPI is now real

## Implemented rules

| Rule | What it checks | Why it's not redundant with submission validation |
|---|---|---|
| `TURNOUT_GT_REGISTERED` | votes cast > registered voters | Defense in depth — submission validation already prevents this; this rule exists so a bug in that validation doesn't go unnoticed |
| `VOTES_GT_VALID` | valid + rejected ≠ votes cast | Same — defense in depth |
| `CANDIDATE_TOTAL_MISMATCH` | candidate vote sum ≠ valid votes | Same — defense in depth |
| `DUPLICATE_RESULT` | two different submitters filed for the same station+position within 10 minutes | Not caught by validation — both submissions can individually be valid |
| `MISSING_RESULT_DOCUMENT` | a VERIFIED/APPROVED/PUBLISHED result has no evidence attached | Procedural gap, not a data error |
| `GPS_MISMATCH` | device location >2km from the polling center's registered point | Real haversine distance calculation |
| `HIGH_REJECTED_BALLOT_RATE` | rejected ballots >5% of votes cast (escalates to HIGH severity above 15%) | Statistically unusual but individually valid |
| `UNUSUAL_TURNOUT_VARIANCE` | station turnout differs from its constituency's average (≥2 other reporting stations) by >25 points | Outlier detection, not a hard rule |
| `MULTIPLE_SUBMISSIONS` | more than 3 versions submitted for one (position, station) | Instability signal |
| `LATE_CORRECTION` | a correction replaces a version that was already APPROVED or PUBLISHED | Spec explicitly calls this out as notable |

Every alert is created with neutral language: "requires verification" or
"unusual statistical pattern," never an accusation. Duplicate alerts for
the same still-open condition are suppressed (checked in
`createAlertIfNotExists` before every insert).

## Database changes

`prisma/migrations/20260913000000_sprint5_integrity/` — 3 new enums
(`IntegrityRule`, `IntegritySeverity`, `IntegrityAlertStatus`), 1 new
table, 4 new `AuditAction` values.

## Routes

| Route | Protection |
|---|---|
| `/command-center/integrity` | `integrity.read`; results filtered to the user's geographic scope |
| `/command-center/integrity/[id]` | `integrity.read`; claim/resolve/dismiss gated by `integrity.review` + the alert's underlying entity geography |

## Tests

8 new tests (39 total in the suite):
- Pure-function tests for haversine distance, rejected ballot rate, and
  turnout percentage
- Live scan test: a submission with a 22% rejection rate produces a
  correctly-severity-escalated `HIGH_REJECTED_BALLOT_RATE` alert
- Running the scan twice on the same submission does not create a
  duplicate alert
- A verified result with no evidence document produces
  `MISSING_RESULT_DOCUMENT`
- `CONSTITUENCY_OFFICER` can review integrity alerts; `POLLING_OFFICER`
  cannot (RBAC catalog test)

## Acceptance verification — live, over real HTTP

1. **Automatic scanning**: submitted a real result (22.2% rejected-ballot
   rate) as the polling officer with no separate "run integrity scan"
   step — the alert appeared in the database immediately, created by the
   scan that runs inside `submitResult` itself.
2. **Permission boundary**: the submitting polling officer's own view of
   the alert (no `integrity.review`) rendered zero review actions.
3. **Full review lifecycle**: the constituency officer (has
   `integrity.review`, same ward scope) saw exactly the Claim/Resolve/
   Dismiss actions; claiming moved status to `UNDER_REVIEW` with an
   assignee; resolving with notes moved it to `RESOLVED` and recorded the
   notes. Full audit trail confirmed in order:
   `INTEGRITY_ALERT_CREATED` → `INTEGRITY_ALERT_ASSIGNED` →
   `INTEGRITY_ALERT_RESOLVED`.
4. **Geographic scope violation**: created a fresh alert on a station in
   a different region. The REG1-CON1-scoped constituency officer's
   rendered page showed **zero** review actions, a forced direct claim
   attempt was rejected server-side (alert status/assignee unchanged),
   and — new this sprint — **the alert was also absent from that
   officer's alerts list page entirely**, not just blocked at the detail
   page.

## Known limitations

- The 500-vs-403 error page gap from Sprints 2–4 is unchanged.
- `UNUSUAL_TURNOUT_VARIANCE`'s threshold (25 percentage points) and
  `HIGH_REJECTED_BALLOT_RATE`'s threshold (5%) are fixed constants in
  `src/lib/integrity/rules.ts`, not per-election configurable yet.
- No automated re-scan of existing submissions when thresholds change or
  when new peer data arrives — a rule only evaluates at the moment its
  triggering submission is created.

## Next sprint dependencies

Sprint 6 (Field Operations) needs, and has: the audit action naming
pattern to extend for field events, and — once observers are assigned to
polling stations — a natural place to attach `DUPLICATE_RESULT` and
`GPS_MISMATCH` context from field check-in data rather than only from the
result submission itself.
