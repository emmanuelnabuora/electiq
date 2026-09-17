"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { authorize } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { ActionError } from "@/lib/actions/errors";

async function requireUserManagement() {
  const session = await requireSession();
  const allowed = await authorize(session.user.id, "users", "manage");
  if (!allowed) throw new ActionError("You don't have permission to manage roles.");
  return session;
}

export async function listRolesWithPermissions() {
  await requireUserManagement();
  return db.role.findMany({
    orderBy: { name: "asc" },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { userRoles: true } },
    },
  });
}

export async function listAllPermissions() {
  await requireUserManagement();
  return db.permission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] });
}

export async function getRoleDetail(roleId: string) {
  await requireUserManagement();
  const role = await db.role.findUniqueOrThrow({
    where: { id: roleId },
    include: { permissions: { include: { permission: true } } },
  });
  const permissions = await db.permission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] });
  return { role, allPermissions: permissions };
}

/**
 * True if setting the given role's permissions to permissionIds would
 * leave NO active user, via any role, able to manage users/roles. This
 * check is deliberately independent of session/auth so it can be tested
 * directly, without needing a real request context.
 */
export async function wouldLeaveNoUserManager(roleId: string, permissionIds: string[]): Promise<boolean> {
  const grantsUserManagement = await db.permission.findFirst({
    where: { id: { in: permissionIds }, resource: "users", action: "manage" },
  });
  if (grantsUserManagement) return false;

  const otherHolders = await db.user.count({
    where: {
      isActive: true,
      roles: {
        some: {
          roleId: { not: roleId },
          role: { permissions: { some: { permission: { resource: "users", action: "manage" } } } },
        },
      },
    },
  });
  return otherHolders === 0;
}

/**
 * Toggles which permissions a role grants. This is the highest-blast-radius
 * action in the whole admin area -- it changes what EVERY user holding that
 * role can do, immediately (src/lib/rbac.ts reads this live, no caching).
 * The one hard guardrail: this can never leave the system with zero users
 * able to manage users/roles at all, since that would be an unrecoverable
 * lockout with no UI path back in.
 */
export async function updateRolePermissions(formData: FormData) {
  const session = await requireUserManagement();
  const roleId = String(formData.get("roleId") ?? "");
  const permissionIds = formData.getAll("permissionIds").map(String);

  const role = await db.role.findUniqueOrThrow({ where: { id: roleId } });

  if (await wouldLeaveNoUserManager(roleId, permissionIds)) {
    throw new ActionError(
      "This would leave no active user able to manage users or roles. Grant users.manage to another role first."
    );
  }

  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    db.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) }),
  ]);

  await recordAudit({
    action: "ROLE_PERMISSIONS_UPDATED",
    actorId: session.user.id,
    reason: `Role ${role.name} permissions set to ${permissionIds.length} permission(s)`,
  });

  revalidatePath("/users/roles");
  revalidatePath(`/users/roles/${roleId}`);
  revalidatePath("/users/permissions");
}
