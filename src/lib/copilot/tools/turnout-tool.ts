import { db } from "@/lib/db";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import type { ToolDefinition, ToolResult } from "@/lib/copilot/types";

async function execute(userId: string, input: Record<string, unknown>): Promise<ToolResult> {
  const allowed = await authorize(userId, "results", "read");
  if (!allowed) {
    return { data: null, sources: [], deniedReason: "This role does not have results.read permission." };
  }

  const election = await db.election.findFirst({ orderBy: { createdAt: "desc" } });
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

  const sortOrder = input.sortBy === "highest" ? -1 : 1;
  const sorted = [...scoped].sort((a, b) => sortOrder * (a.turnoutPct - b.turnoutPct));

  return {
    data: sorted.map((r) => ({
      name: r.unitName,
      reportingStations: r.reportingStations,
      totalStations: r.totalStations,
      reportingPct: Number(r.reportingPct.toFixed(1)),
      turnoutPct: Number(r.turnoutPct.toFixed(1)),
      votesCast: r.votesCast,
    })),
    sources: [
      `Live turnout computed from current ResultSubmission rows for "${position.name}", grouped by ${
        level === 0 ? "region" : "constituency"
      }${scope.isNational ? "" : ", within your assigned geography"}`,
    ],
  };
}

export const turnoutTool: ToolDefinition = {
  name: "TurnoutTool",
  description:
    "Turnout percentage by region or constituency, computed only over polling stations that have reported so far. Sort ascending (lowest first) or descending (highest first).",
  input_schema: {
    type: "object",
    properties: {
      level: { type: "string", enum: ["region", "constituency"], description: "Defaults to region." },
      positionName: { type: "string", description: "Defaults to President." },
      sortBy: { type: "string", enum: ["lowest", "highest"], description: "Defaults to lowest." },
    },
  },
  execute,
};
