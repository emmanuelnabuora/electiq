import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/security/crypto";
import type { AuditAction, Prisma } from "@/generated/prisma/client";

/**
 * Central audit service. Every security-relevant or election-relevant
 * action must be written through this function rather than via ad-hoc
 * db.auditLog.create calls, so the shape of an audit record stays
 * consistent across the whole application (Section 14).
 *
 * Section 11's "Immutable audit storage": each row's `contentHash` is a
 * SHA-256 of its own fields plus the previous row's hash, forming a
 * tamper-evident chain — altering or deleting a historical row breaks
 * every hash computed after it, which src/lib/security/audit-chain.ts can
 * detect. This is tamper-*evidence*, not tamper-*prevention* — it's still
 * an ordinary application table, not WORM/write-once storage, and a
 * concurrent write racing this read-then-write could in principle create
 * a fork in the chain. Both are stated plainly in SPRINT_11.md rather
 * than implied away.
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
  const createdAt = new Date();

  const previous = await db.auditLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { contentHash: true },
  });
  const previousHash = previous?.contentHash ?? null;

  const contentHash = sha256Hex(
    JSON.stringify({
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      previousState: params.previousState ?? null,
      newState: params.newState ?? null,
      reason: params.reason ?? null,
      createdAt: createdAt.toISOString(),
      previousHash,
    })
  );

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
      createdAt,
      contentHash,
      previousHash,
    },
  });
}
