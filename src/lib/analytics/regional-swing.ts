import { db } from "@/lib/db";

export type SwingRow = {
  unitId: string;
  unitName: string;
  sharePctA: number;
  sharePctB: number;
  swingPct: number;
};

/**
 * Vote-share swing for one party between two elections, by administrative
 * unit (region or constituency). Units are shared across elections in
 * this schema (AdministrativeUnit has no electionId), so the same unitId
 * naturally lines up both elections' results — no name-matching needed.
 *
 * Swing is a descriptive statistic: it says a party's share moved by N
 * points in a unit between two elections. It does not, on its own,
 * explain why — Section 8's caution against implying causation from
 * correlation applies directly here.
 */
export async function getRegionalSwing(
  electionAId: string,
  electionBId: string,
  positionName: string,
  partyAbbreviation: string,
  depth: 0 | 1
): Promise<SwingRow[]> {
  const [positionA, positionB] = await Promise.all([
    db.electionPosition.findFirst({ where: { electionId: electionAId, name: positionName } }),
    db.electionPosition.findFirst({ where: { electionId: electionBId, name: positionName } }),
  ]);
  if (!positionA || !positionB) return [];

  const shareByUnit = async (electionId: string, positionId: string) => {
    const rows = await db.$queryRaw<Array<{ unitId: string; unitName: string; partyVotes: bigint; totalVotes: bigint }>>`
      WITH election_country AS (
        SELECT "countryId" FROM elections WHERE id = ${electionId}
      ),
      unit_at_depth AS (
        SELECT au.id, au.name
        FROM administrative_units au
        JOIN administrative_levels al ON al.id = au."levelId"
        WHERE al.depth = ${depth}
          AND al."countryId" = (SELECT "countryId" FROM election_country)
      ),
      station_unit AS (
        SELECT ps.id AS "stationId", COALESCE(u0.id, u1.id, u2.id) AS "unitId"
        FROM polling_stations ps
        JOIN polling_centers pc ON pc.id = ps."pollingCenterId"
        JOIN administrative_units ward ON ward.id = pc."unitId"
        LEFT JOIN unit_at_depth u0 ON u0.id = ward.id
        LEFT JOIN unit_at_depth u1 ON u1.id = ward."parentId"
        LEFT JOIN administrative_units constituency ON constituency.id = ward."parentId"
        LEFT JOIN unit_at_depth u2 ON u2.id = constituency."parentId"
      ),
      current_submission AS (
        SELECT id, "pollingStationId" FROM result_submissions
        WHERE "electionId" = ${electionId} AND "positionId" = ${positionId}
          AND status NOT IN ('CORRECTED', 'VALIDATION_FAILED', 'DRAFT')
      )
      SELECT
        ud.id AS "unitId",
        ud.name AS "unitName",
        COALESCE(SUM(CASE WHEN p.abbreviation = ${partyAbbreviation} THEN cr.votes ELSE 0 END), 0) AS "partyVotes",
        COALESCE(SUM(cr.votes), 0) AS "totalVotes"
      FROM unit_at_depth ud
      LEFT JOIN station_unit su ON su."unitId" = ud.id
      LEFT JOIN current_submission cs ON cs."pollingStationId" = su."stationId"
      LEFT JOIN candidate_results cr ON cr."submissionId" = cs.id
      LEFT JOIN candidates c ON c.id = cr."candidateId"
      LEFT JOIN parties p ON p.id = c."partyId"
      GROUP BY ud.id, ud.name
      ORDER BY ud.name
    `;
    return new Map(
      rows.map((r) => [
        r.unitId,
        { unitName: r.unitName, sharePct: Number(r.totalVotes) > 0 ? (Number(r.partyVotes) / Number(r.totalVotes)) * 100 : 0 },
      ])
    );
  };

  const [sharesA, sharesB] = await Promise.all([
    shareByUnit(electionAId, positionA.id),
    shareByUnit(electionBId, positionB.id),
  ]);

  const unitIds = new Set([...sharesA.keys(), ...sharesB.keys()]);
  return [...unitIds]
    .map((unitId) => {
      const a = sharesA.get(unitId);
      const b = sharesB.get(unitId);
      const unitName = a?.unitName ?? b?.unitName ?? unitId;
      const sharePctA = a?.sharePct ?? 0;
      const sharePctB = b?.sharePct ?? 0;
      return { unitId, unitName, sharePctA, sharePctB, swingPct: sharePctB - sharePctA };
    })
    .sort((x, y) => x.unitName.localeCompare(y.unitName));
}
