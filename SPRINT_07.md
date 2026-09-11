# Sprint 7 — ElectIQ Copilot

## Objective

Build permission-aware AI election intelligence: 8 structured tools that
never bypass RBAC, a provider-independent LLM gateway, and a Copilot
that answers only from authorized data with mandatory ANSWER/KEY
FINDINGS/DATA SOURCES/LIMITATIONS/RECOMMENDED REVIEW structure — never
inventing figures, never treating an alert as a fraud finding.

## Scope

- `AIConversation` / `AIMessage` schema + migration
- All 8 tools from Section 7: `ResultsTool`, `TurnoutTool`,
  `IncidentTool`, `IntegrityTool`, `MapTool`, `AuditTool`, `ReportTool`,
  `ElectionSearchTool`
- Provider-independent LLM gateway (`src/lib/copilot/gateway.ts`) with a
  real `AnthropicProvider` implementation
- Tool-calling orchestration loop (`src/lib/copilot/service.ts`)
- New `copilot.use` permission, granted to roles that need situational
  awareness (not to Polling Officer/Observer/Media/Party Agent)
- Chat UI at `/command-center/copilot`

## Design notes

**Every tool re-checks permissions itself.** The model never gets raw
database access — each tool's `execute()` calls `authorize()` /
`resolveUserScope()` independently, exactly like every page and server
action elsewhere in this app. A permission failure is returned as data
(`deniedReason`) rather than thrown, so the Copilot can honestly tell the
person their role doesn't allow that view instead of silently working
around it or fabricating an answer.

**Live figures are marked provisional in every tool that touches
results**, matching the same rule the Sprint 4 Live Command Center
follows: `ResultsTool` and `ReportTool` both include an explicit note
that standings are computed from all current submissions, not only
published ones, so the model has what it needs to state that distinction
rather than presenting a live number as certified.

**Graceful degradation is the honest failure mode.** When
`ANTHROPIC_API_KEY` isn't set, the Copilot says exactly that — "the
language model is not configured... nothing below should be treated as a
real response" — and persists that as a real conversation, but does
**not** write a `COPILOT_QUERY` audit entry, since no genuine query to a
model occurred. This was verified live in this sandbox, which has no API
key configured.

## Database changes

`prisma/migrations/20260915000000_sprint7_copilot/` — 1 new enum
(`AIMessageRole`), 2 new tables, 1 new `AuditAction` value.

## Tests

10 new tests (52 total in the suite), all against real seeded data:
- `ResultsTool`, `IncidentTool`, `IntegrityTool`, `AuditTool` each deny a
  role lacking the relevant permission (`deniedReason` returned, no data)
- `ResultsTool` grants a role that does hold `results.read`
- `TurnoutTool` returns fewer rows to a constituency-scoped user than a
  national one, and exactly 1 (their own constituency) rather than 0 —
  this test caught a real assumption error on first run (a
  constituency-scoped user's RBAC scope walks down to wards, not up to
  the parent region, so a region-level query correctly returns nothing
  for them; fixed the test, not the tool, once that became clear)
- `ResultsTool` standings sum to ~100% vote share
- `ElectionSearchTool` finds a known seeded candidate, and handles an
  empty query without erroring
- `ReportTool` combines results, standings, and alert/incident counts
  into one structure

## Acceptance verification — live, over real HTTP and via a mock provider

1. **Graceful degradation, real HTTP**: `POST /api/copilot` in this
   (unconfigured) sandbox returned a conversation and message pair
   honestly stating the model isn't configured — confirmed both were
   persisted to `ai_conversations`/`ai_messages`, and confirmed **no**
   `COPILOT_QUERY` audit row was written, since the fallback path
   returns before ever reaching a model.
2. **Permission boundary**: `polling.officer@electiq.example` (no
   `copilot.use`) received a `403` from the API.
3. **The full tool-calling loop, proven with a mock provider that
   behaves exactly like a real Anthropic response would**: a fake
   `LLMProvider` requesting `ReportTool` on its first turn and answering
   on its second (Anthropic's actual two-turn tool-use protocol) drove
   the real `askCopilot()` service end-to-end — confirmed the tool was
   actually executed, its result was fed back into the next turn, both
   messages were persisted, and a `COPILOT_QUERY` audit entry was
   written. This validates the orchestration logic independent of
   whether the real Anthropic API is reachable.

## Known limitations

- **The real `AnthropicProvider` has not made an actual call to
  `api.anthropic.com`** — this sandbox has no `ANTHROPIC_API_KEY`, and
  fabricating a "successful" live test would violate the same honesty
  standard this whole project has held to. The wire-format translation
  (this app's abstract message type versus Anthropic's content-block
  format) is implemented carefully but unverified against the real
  API's exact response shape. Set `ANTHROPIC_API_KEY` in a real
  environment and this should work as designed — the tool layer and
  orchestration loop around it are the tested, real part.
- The 500-vs-403 error page gap from earlier sprints doesn't apply here
  (this route returns proper JSON status codes), but a real Anthropic
  API error surfaces as a generic 502 with the raw error message rather
  than a friendlier translation.
- No RAG / vector search (Section 4 lists this as available "when
  required" — not required yet, since the 8 structured tools cover every
  example query in Section 7 without needing unstructured retrieval).
- `MAX_TOOL_ROUNDS` is a fixed constant (4) — a genuinely complex
  multi-part question could hit this ceiling and get a "please ask
  something more specific" response rather than a full answer.

## Next sprint dependencies

Sprint 8 (Advanced Analytics) needs, and has: real historical-shaped data
(once more than one election exists) and the same tool-permission pattern
to extend for trend/comparison queries — no architecture change
anticipated, just new tools or new actions on existing ones.
