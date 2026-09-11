import { db } from "@/lib/db";
import { authorize } from "@/lib/rbac";
import type { ToolDefinition, ToolResult } from "@/lib/copilot/types";
import type { Prisma } from "@/generated/prisma/client";

async function execute(userId: string, input: Record<string, unknown>): Promise<ToolResult> {
  const allowed = await authorize(userId, "audit", "read");
  if (!allowed) {
    return { data: null, sources: [], deniedReason: "This role does not have audit.read permission." };
  }

  const where: Prisma.AuditLogWhereInput = {};
  if (input.action) where.action = String(input.action).toUpperCase() as never;

  const limit = Math.min(Number(input.limit) || 20, 100);
  const logs = await db.auditLog.findMany({
    where,
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    data: logs.map((l) => ({
      action: l.action,
      actor: l.actor?.name ?? l.reason ?? "System",
      entityType: l.entityType,
      createdAt: l.createdAt,
    })),
    sources: [`AuditLog rows (audit.read is a national-level permission — not geographically scoped)`],
  };
}

export const auditTool: ToolDefinition = {
  name: "AuditTool",
  description: "Query recent system audit log entries, optionally filtered by action type.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", description: "e.g. RESULT_PUBLISHED, LOGIN_FAILED" },
      limit: { type: "number", description: "Defaults to 20, max 100." },
    },
  },
  execute,
};
