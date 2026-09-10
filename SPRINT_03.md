# Sprint 3 — Results Engine

## Objective

Build the polling-station result submission workflow: deterministic
validation, immutable versioning, human verification, approval,
publication, and evidence attachment — extending Sprint 1/2's RBAC,
audit, and geography foundations without redesigning any of them.

## Design input

The schema shape and validation rules for this sprint were adapted from a
separately-generated reference codebase the user provided (claiming
Sprints 1–7), specifically its `ResultSubmission`/`CandidateResult`/
`ResultVerification` model design and its 5 validation rules. Everything
was rewritten from scratch in this project's own patterns (Prisma 7,
`requirePermission()` + `recordAudit()`, full TypeScript strictness,
geographic scope enforcement) rather than copied — the reference code
itself failed typecheck with 60+ errors and its own docs admitted an
unverified build, so it served as a design reference, not a code source.

## Scope

- `ResultSubmission`, `CandidateResult`, `ResultVerification`,
  `ResultDocument` schema + migration
- Deterministic validation (`src/lib/results/validation.ts`)
- Immutable version chain: corrections create a new row, never edit one
- Workflow: submit → (validate) → awaiting review → verify/flag/dispute →
  approve → publish, each transition audited
- Evidence Vault for result documents: real SHA-256, stored in Postgres
  behind a swappable interface (`src/lib/evidence.ts`)
- Results workspace, submission form, and detail page, all geography- and
  permission-scoped
- Command Center KPIs (Votes Cast, Turnout, Verified Results) now real

## Database changes

`prisma/migrations/20260912000000_sprint3_results_engine/` — 2 new enums
(`ResultStatus`, `VerificationDecision`), 4 new tables, 8 new
`AuditAction` values. Applied and verified against live PostgreSQL.

## Routes

| Route | Protection |
|---|---|
| `/command-center/results` | `results.read`; geography-scoped list |
| `/command-center/results/submit` | `results.submit`; polling station choices geography-scoped |
| `/command-center/results/[id]` | `results.read`; verify/approve/publish actions individually gated by permission + geographic scope |
| `/api/results/documents/[id]` | `results.read` |

## Security changes

- Every workflow transition checks `requirePermission(userId, "results", action, wardUnitId)` — permission AND geography, not either alone
- Evidence identity is always a computed SHA-256, never a client-supplied filename
- **Known gap carried from Sprint 2, still true here**: an unauthorized or out-of-scope action attempt is correctly rejected (verified live below) but surfaces as HTTP 500 rather than a clean 403

## Tests

17 new/updated tests (27 total in the suite):
- `tests/results-validation.test.ts` (7): all 5 spec rules, plus non-integer and negative-count rejection
- `tests/results-aggregation.test.ts` (3): CORRECTED and VALIDATION_FAILED rows correctly excluded from live reporting/votes-cast counts
- `tests/rbac.test.ts`: geographic scope resolution for polling stations

## Acceptance verification — live, over real HTTP

The full chain was run against a live `next start` server and real
PostgreSQL, extracting the actual `$ACTION_ID` fields Next.js rendered
(not simulated):

1. **Submit** (polling officer, constituency-scoped): submitted a real
   result for a station within their scope — created as version 1,
   `AWAITING_REVIEW`, candidate votes stored correctly, `RESULT_SUBMITTED`
   audited. The submitting officer's own view of the page correctly shows
   zero action forms (they can't also verify their own submission).
2. **Verify** (constituency officer, same scope): the Verify/Flag/Dispute
   form was the only one rendered; submitting "Verify" moved status to
   `VERIFIED`, wrote a `ResultVerification` row, and audited
   `RESULT_VERIFIED`.
3. **Approve** (national returning officer): the page now rendered
   exactly one action — Approve. Submitting it moved status to
   `APPROVED` and audited `RESULT_APPROVED`.
4. **Publish** (election commissioner): the page rendered exactly one
   action — Publish. Submitting it moved status to `PUBLISHED`, and the
   **Command Center's real KPI immediately reflected the published vote
   count** (1,150 votes cast).
5. **Full audit trail**, in order: `RESULT_SUBMITTED` →
   `RESULT_VERIFIED` → `RESULT_APPROVED` → `RESULT_PUBLISHED`.
6. **Geographic scope violation**: a second result was submitted for a
   station in a different region. The constituency officer's rendered
   page correctly showed no verify action at all, and a forced direct
   POST attempting to verify it anyway was rejected server-side — the
   submission's status remained unchanged in the database.

## Known limitations

- Evidence storage is Postgres `bytea`, not S3 — matches the interface a
  real object-storage swap would use, but isn't one yet (Section 4).
- The 500-vs-403 error page gap from Sprint 2 is unchanged.
- Turnout/reporting metrics are computed against a single reference
  position (President) to avoid double-counting a voter's single visit
  across down-ballot races — documented in `src/lib/results/aggregation.ts`.
- No integrity monitoring yet (Sprint 5) — a wildly out-of-range result
  currently only fails the 5 deterministic rules, nothing flags unusual-
  but-technically-valid patterns.

## Next sprint dependencies

Sprint 4 (Live Command Center) needs, and has: real `ResultSubmission`
data across every status to build the fuller dashboard (candidate
standings, regional breakdowns, reporting trend) against — no schema
changes anticipated, just new read queries.
