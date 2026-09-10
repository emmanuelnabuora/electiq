import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { hasPermission, resolveUserScope, authorize } from "@/lib/rbac";

// These are integration tests: they run against the real seeded database
// (see prisma/seed.ts) rather than mocks, because the behavior under test —
// permission resolution and geographic scope walking — is exactly the logic
// Section 8 of the master spec requires to be enforced server-side, and a
// mock would not catch a mistake in the actual Prisma queries.
//
// Run `npm run seed` against DATABASE_URL before `npm test`.

async function userIdByEmail(email: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return user.id;
}

describe("RBAC permission resolution", () => {
  it("SUPER_ADMIN holds every seeded permission", async () => {
    const id = await userIdByEmail("admin@electiq.example");
    expect(await hasPermission(id, "elections", "read")).toBe(true);
    expect(await hasPermission(id, "audit", "read")).toBe(true);
    expect(await hasPermission(id, "users", "manage")).toBe(true);
  });

  it("POLLING_OFFICER can submit results but cannot read the audit log", async () => {
    const id = await userIdByEmail("polling.officer@electiq.example");
    expect(await hasPermission(id, "results", "submit")).toBe(true);
    expect(await hasPermission(id, "audit", "read")).toBe(false);
  });

  it("MEDIA_USER is read-only on elections and has no results access", async () => {
    const id = await userIdByEmail("media@electiq.example");
    expect(await hasPermission(id, "elections", "read")).toBe(true);
    expect(await hasPermission(id, "results", "submit")).toBe(false);
    expect(await hasPermission(id, "results", "verify")).toBe(false);
  });

  it("ELECTION_COMMISSIONER can manage geography (Sprint 2) but POLLING_OFFICER cannot", async () => {
    const commissionerId = await userIdByEmail("commissioner@electiq.example");
    const pollingOfficerId = await userIdByEmail("polling.officer@electiq.example");
    expect(await hasPermission(commissionerId, "geography", "manage")).toBe(true);
    expect(await hasPermission(pollingOfficerId, "geography", "manage")).toBe(false);
  });
});

describe("Geographic scope resolution", () => {
  it("a nationally-scoped user resolves isNational: true with no unit walk needed", async () => {
    const id = await userIdByEmail("commissioner@electiq.example");
    const scope = await resolveUserScope(id);
    expect(scope.isNational).toBe(true);
  });

  it("a constituency-scoped user's resolved units include that constituency's wards", async () => {
    const id = await userIdByEmail("constituency.officer@electiq.example");
    const scopeRow = await db.userScope.findFirstOrThrow({ where: { userId: id } });
    const scope = await resolveUserScope(id);

    expect(scope.isNational).toBe(false);
    expect(scope.unitIds).toContain(scopeRow.scopeUnitId);

    const wardsUnderConstituency = await db.administrativeUnit.findMany({
      where: { parentId: scopeRow.scopeUnitId! },
    });
    expect(wardsUnderConstituency.length).toBeGreaterThan(0);
    for (const ward of wardsUnderConstituency) {
      expect(scope.unitIds).toContain(ward.id);
    }
  });

  it("authorize() rejects a unit outside a constituency-scoped user's subtree (geographic scope violation)", async () => {
    const id = await userIdByEmail("constituency.officer@electiq.example");
    const ownScope = await db.userScope.findFirstOrThrow({ where: { userId: id } });

    // Find a constituency that is NOT this user's own — a different region entirely.
    const foreignConstituency = await db.administrativeUnit.findFirstOrThrow({
      where: {
        id: { not: ownScope.scopeUnitId! },
        level: { depth: 1 }, // Constituency depth
      },
    });

    const allowedOwn = await authorize(id, "results", "verify", ownScope.scopeUnitId!);
    const allowedForeign = await authorize(id, "results", "verify", foreignConstituency.id);

    expect(allowedOwn).toBe(true);
    expect(allowedForeign).toBe(false);
  });

  it("authorize() denies an action the role was never granted, regardless of geography", async () => {
    const id = await userIdByEmail("observer@electiq.example");
    const scope = await db.userScope.findFirstOrThrow({ where: { userId: id } });
    // OBSERVER has no results.verify permission at all.
    expect(await authorize(id, "results", "verify", scope.scopeUnitId ?? undefined)).toBe(false);
  });
});
