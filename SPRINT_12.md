# Sprint 12 — Enterprise Deployment

## Objective

CI/CD pipeline, containerization, infrastructure-as-code, and a
production readiness review — and, as promised in Sprint 11's "Next
sprint dependencies," finally resolving the disclosed critical Next.js
vulnerabilities rather than leaving them open indefinitely.

## The headline item: the Next.js security upgrade, done properly

Sprint 11 disclosed 2 critical and 6 high-severity `npm audit` findings
in Next.js 14.2.35, deliberately not fixed at the time given the
breaking-change risk of a major-version migration. This sprint did it.

**A correction found along the way**: Sprint 11's research pointed to
15.5.21 as the patched version. Re-checking before applying it here
found a *second, more recent* August 2026 Next.js security release
(two critical unauthenticated-RCE advisories) that superseded that
number — the actually-correct patched version is **15.5.24**. Caught by
re-running `npm audit` after the first upgrade attempt rather than
assuming the job was done once a plausible-looking version was
installed.

**The migration itself** touched 13 files:
- 4 dynamic `[id]` pages and 2 dynamic API routes — `params` became
  `Promise<{...}>` in Next.js 15, requiring `await params` everywhere
- 7 pages using the `searchParams` prop — same change, same fix pattern
- A second, unrelated breaking change discovered mid-migration: Next 15
  no longer allows `next/dynamic(..., { ssr: false })` inside a Server
  Component. This broke both map pages (the internal election map and
  the public map), fixed by extracting the dynamic import into a small
  dedicated Client Component wrapper for each
  (`src/components/map/election-map-loader.tsx`,
  `src/components/public/public-map-loader.tsx`)

**Verified, not just migrated**: clean typecheck, all 92 tests pass
unchanged, a clean production build across all 27 routes, and a live
smoke test — logged in, then hit a `searchParams`-driven page, a dynamic
`[id]` page, the multi-`searchParams` Analytics page, the public portal,
and the MFA/Security page, all over real HTTP, all `200`.

**Confirmed via `npm audit`**: the critical Next.js RCE findings are
gone. What remains is scoped and lower-priority — see Known Limitations.

## Other scope — implemented

- **CI/CD pipeline** (`.github/workflows/ci.yml`): a real, syntactically
  validated GitHub Actions workflow running the exact same commands a
  contributor runs locally — typecheck, migrate, seed, test, build,
  `npm audit` (informational), SBOM generation — against a real
  `postgis/postgis:16-3.4` service container, not a mocked database.
- **Dockerfile fixes**: the existing multi-stage Dockerfile didn't run
  migrations before starting the app. Added `docker-entrypoint.sh`,
  which runs `prisma migrate deploy` (the non-interactive,
  production-safe migration command) before `exec`-ing the actual start
  command, and fails the container rather than serving traffic against
  a schema it doesn't match if that fails.
- **`.dockerignore`**: didn't exist. Without it, a local `.env` with real
  secrets could end up baked into an image layer during `docker build`.
- **`docker-compose.yml` fixes**: was missing `EVIDENCE_ENCRYPTION_KEY`
  (required since Sprint 11 — evidence and MFA secrets can't be
  encrypted without it) and `ANTHROPIC_API_KEY` entirely.
- **Infrastructure-as-code** (`infra/terraform/main.tf`): a minimal AWS
  skeleton (RDS with encryption at rest, ECS Fargate, Secrets Manager
  entries, an ECS cluster/service) — syntax-validated with a Python HCL
  parser, since this environment has no Terraform CLI or AWS credentials
  to run `terraform validate`/`plan` against a real provider. Explicitly
  a starting point: VPC/subnet/security-group specifics are left as
  `TODO`s rather than guessed defaults presented as tested.

## Deployment strategy (documented, not implemented)

Blue-green or canary deployment requires a real multi-environment
platform (a load balancer that can shift traffic between two live
target groups, or a platform like ECS/Kubernetes with native canary
support) that doesn't exist in this environment to build or test
against. Documented recommendation for this application specifically:

- **Blue-green** is the safer default for an election platform:
  provision a full parallel environment, run the CI pipeline's exact
  migrate/seed/test sequence against it, smoke-test it, then cut over
  DNS/load-balancer target group atomically. `prisma migrate deploy`'s
  idempotency (Docker section above) makes this safe to run against the
  new environment before cutover.
- **Avoid canary/gradual rollout for schema-changing deploys** on this
  app specifically: because `ResultSubmission` and `AuditLog` have
  strict append-only/versioning invariants (Sprints 3, 5, 11), splitting
  traffic between two schema versions mid-migration risks exactly the
  kind of data inconsistency those invariants exist to prevent. Canary
  is reasonable for pure application-logic changes with no migration.
- **Never deploy during active polling-day counting** without a
  maintenance-window plan — this is a process recommendation, not
  something enforceable in code, but worth stating given what this
  application does.

## Tests

No new application-logic tests this sprint (the work here is
build/deploy tooling, not new runtime code) — the verification that
matters is that all 92 existing tests still pass unchanged after the
Next.js migration, which is a stronger signal than a handful of new
tests would be: it confirms the migration changed nothing about actual
application behavior. Syntax of every new deploy artifact was validated
directly: the CI YAML parses correctly, the Terraform HCL parses
correctly, the shell entrypoint script passes `sh -n`.

## Production readiness review

Consolidating what's genuinely ready versus what remains, across all 12
sprints:

**Ready:**
- Full election lifecycle: configuration to submission to verification
  to approval to publication (Sprints 1-3), with immutable versioning
- RBAC + geographic scoping enforced server-side everywhere, verified
  live at every sprint boundary
- Integrity monitoring, field operations, public portal, and Copilot are
  all real, tested, and geography/permission-aware
- MFA, encryption at rest, tamper-evident audit logging, rate limiting
- CI pipeline, containerization, and a documented deployment strategy

**Not ready — tracked, not hidden:**
- SSO/OIDC (Sprint 11) — additive work, not started
- WAF, DDoS architecture, KMS, network-layer intrusion detection
  (Sprint 11) — infrastructure/platform decisions, not application code
- Real backup/disaster-recovery automation (Sprint 11) — no managed
  production database exists in this environment to build one against
- Rate limiters (login, public API) are in-memory/single-instance — a
  multi-instance production deployment needs a shared store
- The remaining `npm audit` findings in dev tooling (vitest, prisma CLI)
  and the unused `sharp`/AVIF optimization path — lower priority, fixes
  available only via risky major-version bumps not attempted here
- The Terraform skeleton has never been applied against a real cloud
  account
- No SAST/DAST tooling wired into CI yet

## Next steps for a real production launch

In priority order: (1) provision real infrastructure from the Terraform
skeleton, adjusting the TODOs for an actual VPC; (2) add SSO/OIDC if
required by the deploying organization's identity provider; (3) put a
managed WAF (Cloudflare, AWS WAF) in front of both the authenticated and
public surfaces; (4) replace the in-memory rate limiters with a
Redis-backed one before running more than one app instance; (5) resolve
the remaining lower-priority npm audit findings; (6) run a real DAST
pass (e.g. OWASP ZAP) against a staging deployment before the first
election it handles.
