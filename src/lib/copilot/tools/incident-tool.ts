import { db } from "@/lib/db";
import { authorize, resolveUserScope } from "@/lib/rbac";
import type { ToolDefinition, ToolResult } from "@/lib/copilot/types";
import type { Prisma } from "@/generated/prisma/client";

async function execute(userId: string, input: Record<string, unknown>): Promise<ToolResult> {
  const allowed = await authorize(userId, "incidents", "read");
  if (!allowed) {
    return { data: null, sources: [], deniedReason: "This role does not have incidents.read permission." };
  }

  const where: Prisma.IncidentWhereInput = {};
  if (input.severity) where.severity = String(input.severity).toUpperCase() as never;
  if (input.status) where.status = String(input.status).toUpperCase() as never;

  const scope = await resolveUserScope(userId);
  const incidents = await db.incident.findMany({
    where,
    include: { pollingStation: { include: { pollingCenter: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const scoped = scope.isNational
    ? incidents
    : incidents.filter(
        (i) => !i.pollingStationId || scope.unitIds.includes(i.pollingStation!.pollingCenter.unitId)
      );

  return {
    data: scoped.map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      status: i.status,
      pollingStation: i.pollingStation?.code ?? "Not station-specific",
      createdAt: i.createdAt,
    })),
    sources: [`Incident rows${scope.isNational ? "" : ", within your assigned geography,"} matching the given filters`],
  };
}

export const incidentTool: ToolDefinition = {
  name: "IncidentTool",
  description: "Query reported field incidents, optionally filtered by severity or status.",
  input_schema: {
    type: "object",
    properties: {
      severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
      status: { type: "string", enum: ["OPEN", "ACKNOWLEDGED", "UNDER_REVIEW", "RESOLVED", "DISMISSED"] },
    },
  },
  execute,
};
