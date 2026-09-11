import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/security/crypto";

export type ChainVerificationResult = {
  totalChecked: number;
  brokenAt: string[];
  unchained: number;
  valid: boolean;
};

/**
 * Walks the audit log in chronological order and recomputes each row's
 * hash from its own fields plus the previous row's stored hash, comparing
 * against what's actually stored. A mismatch means that row (or something
 * between it and the previous one) was altered after being written —
 * this is what makes "immutable audit storage" (Section 11) a checkable
 * claim rather than an assertion. Rows written before this feature
 * existed have no hash at all and are counted separately, not treated as
 * broken links.
 */
export async function verifyAuditChain(limit = 5000): Promise<ChainVerificationResult> {
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      previousState: true,
      newState: true,
      reason: true,
      createdAt: true,
      contentHash: true,
      previousHash: true,
    },
  });

  const brokenAt: string[] = [];
  let unchained = 0;
  let expectedPreviousHash: string | null = null;

  for (const row of rows) {
    if (!row.contentHash) {
      unchained++;
      continue;
    }

    if (row.previousHash !== expectedPreviousHash) {
      brokenAt.push(row.id);
    }

    const recomputed = sha256Hex(
      JSON.stringify({
        actorId: row.actorId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        previousState: row.previousState,
        newState: row.newState,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
        previousHash: row.previousHash,
      })
    );

    if (recomputed !== row.contentHash) {
      if (!brokenAt.includes(row.id)) brokenAt.push(row.id);
    }

    expectedPreviousHash = row.contentHash;
  }

  return {
    totalChecked: rows.length,
    brokenAt,
    unchained,
    valid: brokenAt.length === 0,
  };
}
