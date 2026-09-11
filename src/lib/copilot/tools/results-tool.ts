import { db } from "@/lib/db";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { getCandidateStandings } from "@/lib/results/candidate-standings";
import type { ToolDefinition, ToolResult } from "@/lib/copilot/types";

async function execute(userId: string, input: Record<string, unknown>): Promise<ToolResult> {
  const allowed = await authorize(userId, "results", "read");
  if (!allowed) {
    return { data: null, sources: [], deniedReason: "This role does not have results.read permission." };
  }

  const action = String(input.action ?? "status_summary");
  const election = await db.election.findFirst({ orderBy: { createdAt: "desc" } });
  if (!election) return { data: { message: "No election configured." }, sources: [] };

  if (action === "standings") {
    const positionName = input.positionName ? String(input.positionName) : "President";
    const position = await db.electionPosition.findFirst({
      where: { electionId: election.id, name: positionName },
    });
    if (!position) {
      return { data: { message: `No position named "${positionName}" found.` }, sources: [] };
    }
    const standings = await getCandidateStandings(election.id, position.id);
    return {
      data: {
        position: position.name,
        note: "Figures are live/provisional — computed from all current, non-corrected submissions, not only published results.",
        standings,
      },
      sources: [`ResultSubmission and CandidateResult rows for position "${position.name}"`],
    };
  }

  const scope = await resolveUserScope(userId);
  const geoFilter = scope.isNational
    ? {}
    : { pollingStation: { pollingCenter: { unitId: { in: scope.unitIds } } } };

  if (action === "pending_verification") {
    const pending = await db.resultSubmission.findMany({
      where: { electionId: election.id, status: "AWAITING_REVIEW", ...geoFilter },
      include: { pollingStation: true, position: true },
      take: 50,
    });
    return {
      data: pending.map((p) => ({
        pollingStation: p.pollingStation.code,
        position: p.position.name,
        votesCast: p.votesCast,
        submittedAt: p.submittedAt,
      })),
      sources: [`ResultSubmission rows with status AWAITING_REVIEW${scope.isNational ? "" : " within your assigned geography"}`],
    };
  }

  const counts = await db.resultSubmission.groupBy({
    by: ["status"],
    where: { electionId: election.id, ...geoFilter },
    _count: { _all: true },
  });
  return {
    data: counts.map((c) => ({ status: c.status, count: c._count._all })),
    sources: [`ResultSubmission rows grouped by status${scope.isNational ? "" : " within your assigned geography"}`],
  };
}

export const resultsTool: ToolDefinition = {
  name: "ResultsTool",
  description:
    "Query polling-station result submissions: candidate standings for a position (live/provisional, not official until published), submissions awaiting verification, or a count of submissions by status.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["standings", "pending_verification", "status_summary"],
        description: "Which view to return. Defaults to status_summary.",
      },
      positionName: {
        type: "string",
        description: "Position name for 'standings', e.g. President. Defaults to President.",
      },
    },
  },
  execute,
};
