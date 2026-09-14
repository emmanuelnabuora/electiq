import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { wouldLeaveNoUserManager } from "@/lib/actions/roles";

describe("wouldLeaveNoUserManager (Section: highest-blast-radius admin action)", () => {
  it("flags removing users.manage from the only role that grants it", async () => {
    const superAdmin = await db.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
    const allPerms = await db.permission.findMany();
    const usersManage = allPerms.find((p) => p.resource === "users" && p.action === "manage")!;

    const holders = await db.role.findMany({
      where: { permissions: { some: { permissionId: usersManage.id } } },
    });
    expect(holders.map((r) => r.name)).toEqual(["SUPER_ADMIN"]);

    const withoutUsersManage = allPerms.filter((p) => p.id !== usersManage.id).map((p) => p.id);
    const result = await wouldLeaveNoUserManager(superAdmin.id, withoutUsersManage);
    expect(result).toBe(true);
  });

  it("allows removing users.manage from a role that never had it", async () => {
    const analyst = await db.role.findUniqueOrThrow({ where: { name: "ANALYST" } });
    const allPerms = await db.permission.findMany();
    const withoutUsersManage = allPerms
      .filter((p) => !(p.resource === "users" && p.action === "manage"))
      .map((p) => p.id);

    const result = await wouldLeaveNoUserManager(analyst.id, withoutUsersManage);
    expect(result).toBe(false);
  });

  it("allows removing users.manage from one role when another role still grants it", async () => {
    const superAdmin = await db.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
    const commissioner = await db.role.findUniqueOrThrow({ where: { name: "ELECTION_COMMISSIONER" } });
    const usersManage = await db.permission.findFirstOrThrow({ where: { resource: "users", action: "manage" } });

    const added = await db.rolePermission.create({ data: { roleId: commissioner.id, permissionId: usersManage.id } });
    try {
      const allPerms = await db.permission.findMany();
      const withoutUsersManage = allPerms.filter((p) => p.id !== usersManage.id).map((p) => p.id);
      const result = await wouldLeaveNoUserManager(superAdmin.id, withoutUsersManage);
      expect(result).toBe(false);
    } finally {
      await db.rolePermission.delete({ where: { id: added.id } });
    }

    const stillOnlySuperAdmin = await db.role.findMany({
      where: { permissions: { some: { permissionId: usersManage.id } } },
    });
    expect(stillOnlySuperAdmin.map((r) => r.name)).toEqual(["SUPER_ADMIN"]);
  });
});
