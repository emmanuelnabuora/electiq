# Sprint 11 — Enterprise Security

## Objective

Harden ElectIQ against Section 11's checklist: MFA, session/device
monitoring, encryption at rest, immutable audit storage, rate limiting,
secret management, and vulnerability/dependency scanning — implementing
genuinely, in application code, everything that belongs there, and
documenting honestly (not faking) the parts that are properly
infrastructure or deployment-layer decisions.

## What's real application code vs. documented infrastructure

Section 11's list spans two very different kinds of work. MFA, session
tracking, encryption at rest, audit immutability, and rate limiting are
genuinely implementable and testable in this codebase — built this
sprint, with tests proving each one. WAF, DDoS architecture, KMS, and
intrusion detection are platform/infrastructure concerns (a CDN, a cloud
provider's key management service, a network-layer IDS) that a Next.js
application cannot meaningfully implement itself — building a fake one
would be worse than not building it, since it would create false
confidence. Those are documented below as deployment-layer
recommendations, not implemented as code.

## Scope — implemented

- **MFA**: RFC 6238 TOTP via `otplib` (the same standard every
  authenticator app uses), with QR-code enrollment, bcrypt-hashed
  one-time backup codes, and a login-time challenge
  (`src/lib/security/mfa.ts`, `src/lib/actions/mfa.ts`)
- **Session/device monitoring**: every login now records IP and user
  agent to a new `UserSession` table, surfaced on `/command-center/security`
- **Encryption at rest**: `ResultDocument` and `IncidentEvidence` content,
  and MFA TOTP secrets, are encrypted with AES-256-GCM
  (`src/lib/security/crypto.ts`) — Node's built-in `crypto` module, not a
  custom scheme (Section 11's own rule: "never invent proprietary
  cryptography")
- **Immutable audit storage**: every `AuditLog` row now carries a SHA-256
  hash of its own content plus the previous row's hash, forming a
  tamper-evident chain (`src/lib/audit.ts`,
  `src/lib/security/audit-chain.ts`)
- **Rate limiting**: a dedicated IP-based limiter on the login endpoint
  (20 attempts/15 min), distinct from Sprint 10's public-API limiter and
  from per-account lockout
- **Secret management**: `src/lib/security/env-check.ts` validates
  required secrets are present and well-formed, surfaced to
  `audit.read`-permitted roles on the Security page
- **Dependency scanning + SBOM**: real, executed artifacts — `npm audit`
  findings (below) and a genuine CycloneDX 1.6 SBOM (`sbom.json`, 363
  components), generated via `npm run sbom`

## A real, disclosed vulnerability finding — not fixed this sprint, and here's why

`npm audit` found 2 critical and 6 high-severity vulnerabilities, nearly
all in Next.js 14.2.35 (request smuggling, cache poisoning, and image
optimizer DoS classes of issue). Checked directly: there is no further
14.x patch release — the last stable 14.x line stopped at 14.2.35, and
current advisories only cite 15.5.21+ or 16.2.11+ as fixed. That upgrade
carries a genuinely significant breaking change (Next.js 15 made
`params`/`searchParams` async in every dynamic route and page), which
would touch nearly every dynamic page built across all 10 prior sprints.

**Decision**: not attempted this sprint. A framework major-version
migration touching dozens of files needs its own dedicated
regression-testing pass, not a rushed change bolted onto an
already-large security sprint — the risk of shipping something silently
broken outweighs leaving a disclosed-but-documented risk open one more
sprint. This is a real, open, tracked item — see Known Limitations — not
something resolved by writing this paragraph.

## Database changes

`prisma/migrations/20260918000000_sprint11_security/` — 4 new
`AuditAction` values, 3 new columns on `users` (MFA fields), 2 new
columns on `audit_logs` (hash chain), 1 new table (`user_sessions`).

## Tests

15 new tests (92 total in the suite):
- Encryption: buffer/text round-trip, ciphertext doesn't leak plaintext,
  a corrupted auth tag fails to decrypt, buffer-hash matches an
  independent computation
- MFA: a genuinely-generated TOTP code verifies, a garbage code doesn't,
  the URI is well-formed, backup codes each verify exactly once and
  identify their own index
- Audit chain: a freshly-written chain verifies valid; a test that
  deliberately corrupts a historical row's content, confirms the chain
  correctly reports it as broken, then restores the row and reverifies a
  clean chain — see the note below on why that repair step matters
- Login rate limiter: allows the configured number of attempts, blocks
  the next one
- Secret validation: flags a missing/malformed encryption key, doesn't
  flag a correctly-configured one

### A bug in my own test, caught by watching what it did to the real app

The first version of the tamper-detection test corrupted a real
`audit_logs` row to prove detection works, asserted correctly, and
stopped — never restoring the row. That left the actual database's audit
chain permanently "broken" from the test's own side effect, which then
surfaced on the live Security page as a false tamper alert on a
completely healthy application. Caught by checking the live page after
running tests, not by the test itself (it passed either way). Fixed by
adding a restore-and-reverify step to the test, and manually repairing
the already-corrupted row in this session's database.

## Acceptance verification — live, over real HTTP

1. **Full MFA lifecycle**: enabled MFA on a real demo account, then
   exercised the actual login endpoint three times — no code
   (`MFA_REQUIRED`), wrong code (`MFA_INVALID`), and a freshly-generated
   correct TOTP code (success) — confirming a real session was issued
   and a `UserSession` row was created only after the valid code.
   Audit trail confirmed in the exact right order:
   `MFA_CHALLENGE_FAILED` → `MFA_CHALLENGE_SUCCEEDED` → `LOGIN`.
2. **Login rate limiting, live**: 22 rapid login attempts from one
   spoofed IP against the running server — the first 20 processed
   normally (rejected as invalid credentials), the 21st and 22nd
   correctly returned `RATE_LIMITED`, and both were audited with
   `reason: "Rate limit exceeded"`.
3. **Audit chain, live**: after the full test suite and manual repair,
   `verifyAuditChain()` against the real database reports `valid: true`
   across 194 checked records (149 written before this feature existed
   and correctly excluded from the chain, not counted as broken).
4. **SBOM**: a real `sbom.json` was generated and validated as CycloneDX
   1.6 with 363 components — not a description of what an SBOM would
   contain.

## Known limitations

- **The Next.js 14 vulnerabilities above are unresolved.** This is the
  most important item in this list, not a footnote. Upgrading to 15.5.21+
  requires migrating every dynamic route's `params`/`searchParams` to
  async access — tracked as required follow-up work, not optional
  polish.
- Rate limiters (login and public API) remain in-memory/single-instance
  — see Sprint 10's note, same caveat applies here.
- **WAF, DDoS architecture, KMS, and network-level intrusion detection
  are not implemented in this codebase** — they are infrastructure/
  platform decisions (e.g., a CDN's WAF, a cloud KMS for the evidence
  encryption key rather than a raw environment variable, a
  network-layer IDS) that belong at the deployment layer, and a
  from-scratch implementation of any of them in application code would
  be a worse outcome than documenting the gap honestly.
- **Backup and disaster recovery** are not implemented as automated code
  — there is no managed production database to back up in this
  environment. A real deployment needs documented RPO/RTO targets and
  automated backup verification; this sprint states that requirement
  rather than fabricating a backup script with nothing real to restore.
- **SSO/OIDC** are not implemented — the current auth system is
  credentials-only (email/password + MFA). Adding an OIDC provider is
  additive (NextAuth already supports OIDC providers) but wasn't built
  this sprint.
- **Post-quantum cryptography readiness**: this app's cryptographic
  surface is bcrypt (password hashing — not vulnerable to Shor's
  algorithm the way RSA/ECC key exchange is), AES-256-GCM (symmetric;
  considered PQ-resistant at 256-bit key length under current guidance),
  and HMAC-SHA256 (session JWT signing, also symmetric). There is no
  asymmetric public-key cryptography in this application today, so there
  is no immediate PQC migration surface — the main future watch item
  would be if TLS termination infrastructure (outside this app) adopts
  asymmetric key exchange that needs a PQC-hybrid upgrade path, which is
  the hosting/CDN layer's responsibility, not this codebase's.
- **SAST/DAST**: no SAST tool is wired into CI in this repository (no CI
  pipeline exists yet at all); `npm audit` and the SBOM generation above
  are genuinely run, but a proper SAST pass (e.g., Semgrep) and DAST
  readiness (e.g., OWASP ZAP against a running instance) are documented
  as needed, not performed.

## Next sprint dependencies

Sprint 12 (Enterprise Deployment) needs, and has: a concrete, prioritized
list of what "harden before production" actually requires — the Next.js
upgrade, SSO/OIDC, WAF/KMS infrastructure decisions, and CI/CD pipeline
setup (which is also where SAST scanning naturally belongs) all flow
directly from this sprint's Known Limitations.
