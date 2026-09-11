import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import type { ToolDefinition, ToolResult } from "@/lib/copilot/types";

async function execute(userId: string, input: Record<string, unknown>): Promise<ToolResult> {
  const allowed = await authorize(userId, "elections", "read");
  if (!allowed) {
    return { data: null, sources: [], deniedReason: "This role does not have elections.read permission." };
  }

  const currentElectionId = await getCurrentElectionId();
  const election = currentElectionId ? await db.election.findUnique({ where: { id: currentElectionId } }) : null;
  if (!election) return { data: { message: "No election configured." }, sources: [] };

  const positionName = input.positionName ? String(input.positionName) : "President";
  const position = await db.electionPosition.findFirst({
    where: { electionId: election.id, name: positionName },
  });
  if (!position) {
    return { data: { message: `No position named "${positionName}" found.` }, sources: [] };
  }

  const level = input.level === "constituency" ? 1 : 0;
  const rows = await getGeographicBreakdown(election.id, position.id, level);
  const scope = await resolveUserScope(userId);
  const scoped = scope.isNational ? rows : rows.filter((r) => scope.unitIds.includes(r.unitId));

  const notReported = scoped.filter((r) => r.reportingStations === 0).map((r) => r.unitName);
  const fullyReported = scoped.filter((r) => r.reportingStations === r.totalStations).map((r) => r.unitName);

  return {
    data: {
      units: scoped.map((r) => ({
        name: r.unitName,
        reportingStations: r.reportingStations,
        totalStations: r.totalStations,
        reportingPct: Number(r.reportingPct.toFixed(1)),
      })),
      notYetReported: notReported,
      fullyReported,
    },
    sources: [
      `Reporting-completion status by ${level === 0 ? "region" : "constituency"} for "${position.name}"${
        scope.isNational ? "" : ", within your assigned geography"
      }`,
    ],
  };
}

export const mapTool: ToolDefinition = {
  name: "MapTool",
  description:
    "Geographic reporting-completion status: which regions or constituencies have fully reported, which have not reported at all, and each unit's reporting percentage.",
  input_schema: {
    type: "object",
    properties: {
      level: { type: "string", enum: ["region", "constituency"], description: "Defaults to region." },
      positionName: { type: "string", description: "Defaults to President." },
    },
  },
  execute,
};
