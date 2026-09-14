"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { authorize } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { ActionError } from "@/lib/actions/errors";

async function requireUserManagement() {
  const session = await requireSession();
  const allowed = await authorize(session.user.id, "users", "manage");
  if (!allowed) throw new ActionError("You don't have permission to manage users.");
  return session;
}

export async function listUsersWithRoles() {
  await requireUserManagement();
  return db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      mfaEnabled: true,
      lockedUntil: true,
      lastLoginAt: true,
      roles: { select: { role: { select: { id: true, name: true } } } },
      scopes: { select: { isNational: true, scopeUnit: { select: { name: true } } } },
    },
  });
}

export async function listAllRoles() {
  await requireUserManagement();
  return db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, description: true } });
}

export async function createUser(formData: FormData) {
  const session = await requireUserManagement();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleIds = formData.getAll("roleIds").map(String);
  const isNational = formData.get("isNational") === "on";

  if (!name || !email || !password) throw new ActionError("Name, email, and password are required.");
  if (password.length < 12) throw new ActionError("Password must be at least 12 characters.");
  if (roleIds.length === 0) throw new ActionError("Select at least one role for the new user.");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new ActionError("A user with that email already exists.");

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      roles: { create: roleIds.map((roleId) => ({ roleId })) },
      scopes: isNational ? { create: [{ isNational: true }] } : undefined,
    },
  });

  await recordAudit({
    action: "USER_CREATED",
    actorId: session.user.id,
    reason: `Created user ${email} with ${roleIds.length} role(s)`,
  });

  revalidatePath("/command-center/users");
  return { id: user.id };
}

export async function setUserActive(formData: FormData) {
  const session = await requireUserManagement();
  const userId = String(formData.get("userId") ?? "");
  const active = formData.get("active") === "true";

  if (userId === session.user.id && !active) {
    throw new ActionError("You can't deactivate your own account.");
  }

  await db.user.update({ where: { id: userId }, data: { isActive: active } });
  await recordAudit({
    action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    actorId: session.user.id,
    reason: `User ${userId} set to ${active ? "active" : "inactive"}`,
  });

  revalidatePath("/command-center/users");
}

export async function unlockUser(formData: FormData) {
  const session = await requireUserManagement();
  const userId = String(formData.get("userId") ?? "");

  await db.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null } });
  await recordAudit({
    action: "USER_UNLOCKED",
    actorId: session.user.id,
    reason: `Cleared lockout for user ${userId}`,
  });

  revalidatePath("/command-center/users");
}

export async function updateUserRoles(formData: FormData) {
  const session = await requireUserManagement();
  const userId = String(formData.get("userId") ?? "");
  const roleIds = formData.getAll("roleIds").map(String);

  if (roleIds.length === 0) throw new ActionError("A user must have at least one role.");

  if (userId === session.user.id) {
    const stillHasUserManagement = await roleSetGrants(roleIds, "users", "manage");
    if (!stillHasUserManagement) {
      throw new ActionError("You can't remove your own ability to manage users.");
    }
  }

  await db.$transaction([
    db.userRole.deleteMany({ where: { userId } }),
    db.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) }),
  ]);

  await recordAudit({
    action: "ROLE_ASSIGNED",
    actorId: session.user.id,
    reason: `User ${userId} roles set to [${roleIds.join(", ")}]`,
  });

  revalidatePath("/command-center/users");
}

async function roleSetGrants(roleIds: string[], resource: string, action: string): Promise<boolean> {
  const count = await db.rolePermission.count({
    where: {
      roleId: { in: roleIds },
      permission: { resource, action },
    },
  });
  return count > 0;
}
