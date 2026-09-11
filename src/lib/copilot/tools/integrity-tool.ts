import { db } from "@/lib/db";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { getWardUnitIdForAlert } from "@/lib/integrity/scope";
import type { ToolDefinition, ToolResult } from "@/lib/copilot/types";
import type { Prisma } from "@/generated/prisma/client";

async function execute(userId: string, input: Record<string, unknown>): Promise<ToolResult> {
  const allowed = await authorize(userId, "integrity", "read");
  if (!allowed) {
    return { data: null, sources: [], deniedReason: "This role does not have integrity.read permission." };
  }

  const where: Prisma.IntegrityAlertWhereInput = {};
  if (input.severity) where.severity = String(input.severity).toUpperCase() as never;
  if (input.status) where.status = String(input.status).toUpperCase() as never;

  const alerts = await db.integrityAlert.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const scope = await resolveUserScope(userId);
  const scoped = scope.isNational
    ? alerts
    : (
        await Promise.all(
          alerts.map(async (a) => {
            const wardUnitId = await getWardUnitIdForAlert(a.entityType, a.entityId);
            return wardUnitId && scope.unitIds.includes(wardUnitId) ? a : null;
          })
        )
      ).filter((a): a is NonNullable<typeof a> => a !== null);

  return {
    data: scoped.map((a) => ({
      rule: a.rule,
      severity: a.severity,
      status: a.status,
      explanation: a.explanation,
      createdAt: a.createdAt,
    })),
    sources: [
      `IntegrityAlert rows${scope.isNational ? "" : ", within your assigned geography,"} matching the given filters. An alert flags a pattern requiring verification — it is never a confirmed finding of wrongdoing.`,
    ],
  };
}

export const integrityTool: ToolDefinition = {
  name: "IntegrityTool",
  description:
    "Query election integrity alerts (statistical/procedural anomalies flagged for human review), optionally filtered by severity or status. Alerts are never fraud determinations.",
  input_schema: {
    type: "object",
    properties: {
      severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      status: { type: "string", enum: ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"] },
    },
  },
  execute,
};
