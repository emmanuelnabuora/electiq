import { db } from "@/lib/db";

/**
 * RBAC + geographic scope resolution.
 *
 * Section 8 of the master spec is explicit: "Never enforce permissions
 * through UI hiding alone. Authorization must be server-side." Every
 * function here is meant to be called from server components, route
 * handlers, or server actions — never trusted from the client.
 *
 * Permission model: (resource, action, geographic scope). A role grants
 * a set of (resource, action) permissions; a user's UserScope rows
 * determine WHERE those permissions apply (nationally, or within a
 * specific AdministrativeUnit subtree).
 */

export type ResolvedScope = {
  isNational: boolean;
  unitIds: string[]; // the user's scope unit(s) plus all descendant unit ids
};

/** Loads every permission string ("resource.action") granted to a user via their roles. */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  const permissions = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      permissions.add(`${rp.permission.resource}.${rp.permission.action}`);
    }
  }
  return permissions;
}

/** True if the user holds at least one role granting resource.action, regardless of geography. */
export async function hasPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.has(`${resource}.${action}`);
}

/**
 * Resolves the full set of AdministrativeUnit ids a user may act within,
 * by walking down from each of their UserScope units to every descendant.
 * A national scope short-circuits this (isNational: true, no unit walk needed).
 */
export async function resolveUserScope(userId: string): Promise<ResolvedScope> {
  const scopes = await db.userScope.findMany({ where: { userId } });

  if (scopes.some((s) => s.isNational)) {
    return { isNational: true, unitIds: [] };
  }

  const rootIds = scopes.map((s) => s.scopeUnitId).filter((id): id is string => !!id);
  if (rootIds.length === 0) return { isNational: false, unitIds: [] };

  // Breadth-first walk down the administrative-unit tree.
  const allUnits = await db.administrativeUnit.findMany({
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const u of allUnits) {
    if (!u.parentId) continue;
    const list = childrenByParent.get(u.parentId) ?? [];
    list.push(u.id);
    childrenByParent.set(u.parentId, list);
  }

  const visited = new Set<string>(rootIds);
  const queue = [...rootIds];
  while (queue.length) {
    const current = queue.shift()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (!visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    }
  }

  return { isNational: false, unitIds: [...visited] };
}

/**
 * Combined check: does the user have (resource, action) AND, if a specific
 * administrative unit is supplied, does that unit fall within their scope?
 * Pass unitId = undefined for actions that are not geography-bound.
 */
export async function authorize(
  userId: string,
  resource: string,
  action: string,
  unitId?: string
): Promise<boolean> {
  const allowed = await hasPermission(userId, resource, action);
  if (!allowed) return false;
  if (!unitId) return true;

  const scope = await resolveUserScope(userId);
  if (scope.isNational) return true;
  return scope.unitIds.includes(unitId);
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError instead of returning a boolean — convenient in route handlers/server actions. */
export async function requirePermission(
  userId: string,
  resource: string,
  action: string,
  unitId?: string
): Promise<void> {
  const ok = await authorize(userId, resource, action, unitId);
  if (!ok) {
    throw new ForbiddenError(`Missing permission ${resource}.${action}`);
  }
}
