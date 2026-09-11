import { db } from "@/lib/db";
import { authorize } from "@/lib/rbac";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { getCandidateStandings } from "@/lib/results/candidate-standings";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import type { ToolDefinition, ToolResult } from "@/lib/copilot/types";

async function execute(userId: string): Promise<ToolResult> {
  const allowed = await authorize(userId, "elections", "read");
  if (!allowed) {
    return { data: null, sources: [], deniedReason: "This role does not have elections.read permission." };
  }

  const election = await db.election.findFirst({ orderBy: { createdAt: "desc" } });
  if (!election) return { data: { message: "No election configured." }, sources: [] };

  const position = await db.electionPosition.findFirst({
    where: { electionId: election.id, name: "President" },
  });

  const aggregate = await getResultsAggregate(election.id);
  const standings = position ? await getCandidateStandings(election.id, position.id) : [];
  const regional = position ? await getGeographicBreakdown(election.id, position.id, 0) : [];

  const [openIntegrityAlerts, criticalIntegrityAlerts, openIncidents, criticalIncidents] = await Promise.all([
    db.integrityAlert.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    db.integrityAlert.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] }, severity: "CRITICAL" } }),
    db.incident.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED", "UNDER_REVIEW"] } } }),
    db.incident.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED", "UNDER_REVIEW"] }, severity: "CRITICAL" } }),
  ]);

  return {
    data: {
      election: election.name,
      status: election.status,
      reporting: {
        stationsReporting: aggregate.reportingStations,
        totalStations: aggregate.totalStations,
        votesCast: aggregate.votesCast,
        verifiedCount: aggregate.verifiedCount,
        publishedCount: aggregate.publishedCount,
      },
      candidateStandingsNote:
        "Provisional — from current reported submissions, not only published results.",
      candidateStandings: standings,
      regionalReporting: regional.map((r) => ({
        name: r.unitName,
        reportingPct: Number(r.reportingPct.toFixed(1)),
        turnoutPct: Number(r.turnoutPct.toFixed(1)),
      })),
      openIntegrityAlerts,
      criticalIntegrityAlerts,
      openIncidents,
      criticalIncidents,
    },
    sources: [
      "ResultSubmission aggregate and candidate standings",
      "Regional reporting breakdown",
      "IntegrityAlert and Incident counts (national totals, not geography-filtered for this summary tool)",
    ],
  };
}

export const reportTool: ToolDefinition = {
  name: "ReportTool",
  description:
    "Generates a national situation report: reporting/verification/publication progress, provisional candidate standings, regional reporting completion, and open integrity alert and incident counts.",
  input_schema: { type: "object", properties: {} },
  execute: (userId) => execute(userId),
};
