import { db } from "@/lib/db";
import type { AuditAction, Prisma } from "@/generated/prisma/client";

/**
 * Central audit service. Every security-relevant or election-relevant
 * action must be written through this function rather than via ad-hoc
 * db.auditLog.create calls, so the shape of an audit record stays
 * consistent across the whole application (Section 14 of the spec).
 */
export async function recordAudit(params: {
  actorId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  ipAddress?: string | null;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
  reason?: string;
}) {
  return db.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      ipAddress: params.ipAddress ?? null,
      previousState: params.previousState,
      newState: params.newState,
      reason: params.reason,
    },
  });
}
