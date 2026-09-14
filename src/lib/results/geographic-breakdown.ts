import { db } from "@/lib/db";

export type GeographicBreakdownRow = {
  unitId: string;
  unitName: string;
  totalStations: number;
  reportingStations: number;
  reportingPct: number;
  registeredVoters: number; // across reporting stations only
  votesCast: number;
  turnoutPct: number;
};

/**
 * Per-unit (region or constituency, by `depth`) breakdown for a position's
 * live results. `reportingPct` is stations-reported / total-stations
 * (Section 16 "Reporting Completion"); `turnoutPct` is votes-cast /
 * registered-voters computed only over the stations that have reported so
 * far — dividing by every registered voter in the unit would conflate
 * "turnout is low" with "most stations haven't reported yet," which are
 * different facts.
 *
 * Scoped to the election's own country (via election_country CTE) —
 * without this, once a second country's administrative hierarchy exists
 * in the same database (e.g. both a demo country and a real one, sharing
 * the same depth numbering for region/constituency/ward), this query
 * silently mixed units from every country at that depth into one result
 * set. That was latent and invisible with only one country in the
 * database; caught when building the Turnout page against a database
 * that now has two.
 */
export async function getGeographicBreakdown(
  electionId: string,
  positionId: string,
  depth: 0 | 1
): Promise<GeographicBreakdownRow[]> {
  const rows = await db.$queryRaw<
    Array<{
      unitId: string;
      unitName: string;
      totalStations: bigint;
      reportingStations: bigint;
      registeredVoters: bigint | null;
      votesCast: bigint | null;
    }>
  >`
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
      SELECT
        ps.id AS "stationId",
        ps."registeredVoters",
        COALESCE(u0.id, u1.id, u2.id) AS "unitId"
      FROM polling_stations ps
      JOIN polling_centers pc ON pc.id = ps."pollingCenterId"
      JOIN administrative_units ward ON ward.id = pc."unitId"
      LEFT JOIN unit_at_depth u0 ON u0.id = ward.id
      LEFT JOIN unit_at_depth u1 ON u1.id = ward."parentId"
      LEFT JOIN administrative_units constituency ON constituency.id = ward."parentId"
      LEFT JOIN unit_at_depth u2 ON u2.id = constituency."parentId"
    ),
    current_result AS (
      SELECT rs."pollingStationId", rs."votesCast"
      FROM result_submissions rs
      WHERE rs."electionId" = ${electionId}
        AND rs."positionId" = ${positionId}
        AND rs.status NOT IN ('CORRECTED', 'VALIDATION_FAILED', 'DRAFT')
    )
    SELECT
      ud.id AS "unitId",
      ud.name AS "unitName",
      COUNT(su."stationId") AS "totalStations",
      COUNT(cr."pollingStationId") AS "reportingStations",
      COALESCE(SUM(CASE WHEN cr."pollingStationId" IS NOT NULL THEN su."registeredVoters" END), 0) AS "registeredVoters",
      COALESCE(SUM(cr."votesCast"), 0) AS "votesCast"
    FROM unit_at_depth ud
    LEFT JOIN station_unit su ON su."unitId" = ud.id
    LEFT JOIN current_result cr ON cr."pollingStationId" = su."stationId"
    GROUP BY ud.id, ud.name
    ORDER BY ud.name
  `;

  return rows.map((r) => {
    const totalStations = Number(r.totalStations);
    const reportingStations = Number(r.reportingStations);
    const registeredVoters = Number(r.registeredVoters ?? 0);
    const votesCast = Number(r.votesCast ?? 0);
    return {
      unitId: r.unitId,
      unitName: r.unitName,
      totalStations,
      reportingStations,
      reportingPct: totalStations > 0 ? (reportingStations / totalStations) * 100 : 0,
      registeredVoters,
      votesCast,
      turnoutPct: registeredVoters > 0 ? (votesCast / registeredVoters) * 100 : 0,
    };
  });
}
