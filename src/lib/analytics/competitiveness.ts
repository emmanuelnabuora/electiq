import { db } from "@/lib/db";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";

export type CompetitivenessRow = {
  unitId: string;
  unitName: string;
  leader: string;
  runnerUp: string;
  marginPct: number;
  classification: "SAFE" | "LIKELY" | "COMPETITIVE" | "TOSS_UP";
};

function classify(marginPct: number): CompetitivenessRow["classification"] {
  if (marginPct >= 20) return "SAFE";
  if (marginPct >= 10) return "LIKELY";
  if (marginPct >= 3) return "COMPETITIVE";
  return "TOSS_UP";
}

/**
 * Margin between the top two candidates in each unit, classified into
 * plain bands. This describes how close a race currently looks based on
 * reported figures — it is not a prediction and carries no claim about
 * why a race is close.
 */
export async function getCompetitiveness(
  electionId: string,
  positionName: string,
  depth: 0 | 1
): Promise<CompetitivenessRow[]> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) return [];

  const units = await getGeographicBreakdown(electionId, position.id, depth);
  const results: CompetitivenessRow[] = [];

  for (const unit of units) {
    if (unit.reportingStations === 0) continue;

    const rows = await db.$queryRaw<Array<{ fullName: string; votes: bigint }>>`
      WITH station_unit AS (
        SELECT ps.id AS "stationId"
        FROM polling_stations ps
        JOIN polling_centers pc ON pc.id = ps."pollingCenterId"
        JOIN administrative_units ward ON ward.id = pc."unitId"
        LEFT JOIN administrative_units constituency ON constituency.id = ward."parentId"
        WHERE ward.id = ${unit.unitId} OR ward."parentId" = ${unit.unitId} OR constituency."parentId" = ${unit.unitId}
      ),
      current_submission AS (
        SELECT id, "pollingStationId" FROM result_submissions
        WHERE "electionId" = ${electionId} AND "positionId" = ${position.id}
          AND status NOT IN ('CORRECTED', 'VALIDATION_FAILED', 'DRAFT')
      )
      SELECT c."fullName", COALESCE(SUM(cr.votes), 0) AS votes
      FROM station_unit su
      JOIN current_submission cs ON cs."pollingStationId" = su."stationId"
      JOIN candidate_results cr ON cr."submissionId" = cs.id
      JOIN candidates c ON c.id = cr."candidateId"
      GROUP BY c."fullName"
      ORDER BY votes DESC
    `;

    if (rows.length < 2) continue;
    const total = rows.reduce((sum, r) => sum + Number(r.votes), 0);
    if (total === 0) continue;

    const leaderPct = (Number(rows[0].votes) / total) * 100;
    const runnerUpPct = (Number(rows[1].votes) / total) * 100;
    const marginPct = leaderPct - runnerUpPct;

    results.push({
      unitId: unit.unitId,
      unitName: unit.unitName,
      leader: rows[0].fullName,
      runnerUp: rows[1].fullName,
      marginPct: Number(marginPct.toFixed(1)),
      classification: classify(marginPct),
    });
  }

  return results.sort((a, b) => a.marginPct - b.marginPct);
}
