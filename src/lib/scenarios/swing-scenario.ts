import { db } from "@/lib/db";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";

export type SwingScenarioResult = {
  targetParty: string;
  swingDeltaPct: number;
  parties: Array<{ partyAbbreviation: string; currentSharePct: number; projectedSharePct: number }>;
  constituencyImpact: {
    currentlyLeading: number;
    projectedLeading: number;
    gained: string[];
    lost: string[];
  };
};

async function getPartyVotesForElection(electionId: string, positionId: string) {
  const rows = await db.$queryRaw<Array<{ partyAbbreviation: string | null; votes: bigint }>>`
    SELECT p.abbreviation AS "partyAbbreviation", COALESCE(SUM(cr.votes), 0) AS votes
    FROM result_submissions rs
    JOIN candidate_results cr ON cr."submissionId" = rs.id
    JOIN candidates c ON c.id = cr."candidateId"
    LEFT JOIN parties p ON p.id = c."partyId"
    WHERE rs."electionId" = ${electionId} AND rs."positionId" = ${positionId}
      AND rs.status NOT IN ('CORRECTED', 'VALIDATION_FAILED', 'DRAFT')
    GROUP BY p.abbreviation
  `;
  return rows.map((r) => ({ partyAbbreviation: r.partyAbbreviation ?? "Independent", votes: Number(r.votes) }));
}

/**
 * MODEL ESTIMATE — NOT OFFICIAL RESULT.
 *
 * Applies a uniform vote-share swing toward one party, drawn
 * proportionally from every other party, at every polling station and
 * constituency alike. Real swings are essentially never uniform — a
 * swing concentrated in one region, or driven by a factor specific to
 * certain voters, would look nothing like this. The constituency-impact
 * section counts how many constituencies would change which party
 * currently leads them under this uniform assumption — a stand-in for
 * "seat scenarios" since this schema's only genuinely populated
 * multi-constituency race (President) isn't literally seat-based.
 */
export async function getSwingScenario(
  electionId: string,
  positionName: string,
  targetParty: string,
  swingDeltaPct: number
): Promise<SwingScenarioResult> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) {
    return {
      targetParty,
      swingDeltaPct,
      parties: [],
      constituencyImpact: { currentlyLeading: 0, projectedLeading: 0, gained: [], lost: [] },
    };
  }

  const partyVotes = await getPartyVotesForElection(electionId, position.id);
  const totalVotes = partyVotes.reduce((sum, p) => sum + p.votes, 0);
  const currentShares = partyVotes.map((p) => ({
    partyAbbreviation: p.partyAbbreviation,
    sharePct: totalVotes > 0 ? (p.votes / totalVotes) * 100 : 0,
  }));

  const targetCurrent = currentShares.find((p) => p.partyAbbreviation === targetParty)?.sharePct ?? 0;
  const targetProjected = Math.min(100, Math.max(0, targetCurrent + swingDeltaPct));
  const actualDelta = targetProjected - targetCurrent;
  const othersCurrentTotal = 100 - targetCurrent;

  const parties = currentShares.map((p) => {
    if (p.partyAbbreviation === targetParty) {
      return { partyAbbreviation: p.partyAbbreviation, currentSharePct: p.sharePct, projectedSharePct: targetProjected };
    }
    // Draw the swing proportionally from every other party's current share.
    const proportion = othersCurrentTotal > 0 ? p.sharePct / othersCurrentTotal : 0;
    const projectedSharePct = Math.max(0, p.sharePct - actualDelta * proportion);
    return { partyAbbreviation: p.partyAbbreviation, currentSharePct: p.sharePct, projectedSharePct };
  });

  // Constituency-level impact: apply the same swing to each constituency's
  // party shares and see whether the plurality leader changes.
  const constituencies = await getGeographicBreakdown(electionId, position.id, 1);
  let currentlyLeading = 0;
  let projectedLeading = 0;
  const gained: string[] = [];
  const lost: string[] = [];

  for (const unit of constituencies) {
    if (unit.reportingStations === 0) continue;

    const rows = await db.$queryRaw<Array<{ partyAbbreviation: string | null; votes: bigint }>>`
      WITH station_unit AS (
        SELECT ps.id AS "stationId"
        FROM polling_stations ps
        JOIN polling_centers pc ON pc.id = ps."pollingCenterId"
        JOIN administrative_units ward ON ward.id = pc."unitId"
        WHERE ward.id = ${unit.unitId} OR ward."parentId" = ${unit.unitId}
      ),
      current_submission AS (
        SELECT id, "pollingStationId" FROM result_submissions
        WHERE "electionId" = ${electionId} AND "positionId" = ${position.id}
          AND status NOT IN ('CORRECTED', 'VALIDATION_FAILED', 'DRAFT')
      )
      SELECT p.abbreviation AS "partyAbbreviation", COALESCE(SUM(cr.votes), 0) AS votes
      FROM station_unit su
      JOIN current_submission cs ON cs."pollingStationId" = su."stationId"
      JOIN candidate_results cr ON cr."submissionId" = cs.id
      JOIN candidates c ON c.id = cr."candidateId"
      LEFT JOIN parties p ON p.id = c."partyId"
      GROUP BY p.abbreviation
    `;
    const local = rows.map((r) => ({ party: r.partyAbbreviation ?? "Independent", votes: Number(r.votes) }));
    const localTotal = local.reduce((sum, p) => sum + p.votes, 0);
    if (localTotal === 0) continue;

    const currentLeader = local.reduce((a, b) => (b.votes > a.votes ? b : a)).party;
    if (currentLeader === targetParty) currentlyLeading++;

    const localTargetShare = ((local.find((p) => p.party === targetParty)?.votes ?? 0) / localTotal) * 100;
    const localOthersTotal = 100 - localTargetShare;
    const projectedLocalShares = local.map((p) => {
      const sharePct = (p.votes / localTotal) * 100;
      if (p.party === targetParty) return { party: p.party, sharePct: Math.min(100, Math.max(0, localTargetShare + actualDelta)) };
      const proportion = localOthersTotal > 0 ? sharePct / localOthersTotal : 0;
      return { party: p.party, sharePct: Math.max(0, sharePct - actualDelta * proportion) };
    });
    const projectedLeader = projectedLocalShares.reduce((a, b) => (b.sharePct > a.sharePct ? b : a)).party;
    if (projectedLeader === targetParty) projectedLeading++;

    if (currentLeader !== targetParty && projectedLeader === targetParty) gained.push(unit.unitName);
    if (currentLeader === targetParty && projectedLeader !== targetParty) lost.push(unit.unitName);
  }

  return {
    targetParty,
    swingDeltaPct: actualDelta,
    parties: parties.sort((a, b) => b.projectedSharePct - a.projectedSharePct),
    constituencyImpact: { currentlyLeading, projectedLeading, gained, lost },
  };
}
