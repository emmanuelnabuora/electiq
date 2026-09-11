import { db } from "@/lib/db";

/**
 * Section 31: "Public Portal queries must explicitly filter for
 * PUBLIC/PUBLISHED information. Never depend on frontend hiding."
 *
 * Every function in this file is the ONLY sanctioned way the public
 * portal (src/app/public/, src/app/api/public/) reads election data.
 * None of them accept a status filter parameter — PUBLISHED is hard-coded
 * into every query below, not passed in, so there is no way for a caller
 * to accidentally widen it. This is deliberately a different, narrower
 * set of functions than src/lib/results/*, which power the internal
 * Command Center and intentionally include unverified/in-progress data —
 * mixing the two up is exactly the mistake this file exists to prevent.
 *
 * Never expose from here: submitter/verifier/approver identities,
 * AuditLog entries, IntegrityAlert content, Incident content, observer
 * identities, or evidence documents — see Section 31's explicit list.
 */

const PUBLISHED_ONLY = { status: "PUBLISHED" as const };

export async function getPublicElection(electionId?: string) {
  const election = electionId
    ? await db.election.findUnique({ where: { id: electionId } })
    : await db.election.findFirst({
        where: { status: { not: "ARCHIVED" } },
        orderBy: { electionDate: "desc" },
      });
  if (!election) return null;

  const [positions, parties] = await Promise.all([
    db.electionPosition.findMany({ where: { electionId: election.id }, select: { id: true, name: true } }),
    db.party.findMany({
      where: { electionId: election.id },
      select: { name: true, abbreviation: true, colorHex: true },
    }),
  ]);

  return {
    id: election.id,
    name: election.name,
    electionDate: election.electionDate.toISOString(),
    status: election.status,
    positions: positions.map((p) => p.name),
    parties,
  };
}

export type PublicCandidateStanding = {
  fullName: string;
  partyAbbreviation: string | null;
  votes: number;
  sharePct: number;
};

export async function getPublicCandidateStandings(
  electionId: string,
  positionName: string
): Promise<PublicCandidateStanding[]> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) return [];

  const candidates = await db.candidate.findMany({
    where: { electionId, positionId: position.id },
    include: { party: true },
  });

  const results = await db.candidateResult.findMany({
    where: {
      candidateId: { in: candidates.map((c) => c.id) },
      submission: { ...PUBLISHED_ONLY },
    },
    select: { candidateId: true, votes: true },
  });

  const votesByCandidate = new Map<string, number>();
  for (const r of results) votesByCandidate.set(r.candidateId, (votesByCandidate.get(r.candidateId) ?? 0) + r.votes);
  const totalVotes = [...votesByCandidate.values()].reduce((a, b) => a + b, 0);

  return candidates
    .map((c) => {
      const votes = votesByCandidate.get(c.id) ?? 0;
      return {
        fullName: c.fullName,
        partyAbbreviation: c.party?.abbreviation ?? null,
        votes,
        sharePct: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
      };
    })
    .sort((a, b) => b.votes - a.votes);
}

export type PublicRegionResult = {
  unitName: string;
  publishedStations: number;
  totalStations: number;
  votesCast: number;
  registeredVoters: number;
  turnoutPct: number;
};

export async function getPublicRegionalResults(
  electionId: string,
  positionName: string,
  depth: 0 | 1
): Promise<PublicRegionResult[]> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) return [];

  const rows = await db.$queryRaw<
    Array<{
      unitId: string;
      unitName: string;
      totalStations: bigint;
      publishedStations: bigint;
      registeredVoters: bigint | null;
      votesCast: bigint | null;
    }>
  >`
    WITH unit_at_depth AS (
      SELECT au.id, au.name
      FROM administrative_units au
      JOIN administrative_levels al ON al.id = au."levelId"
      WHERE al.depth = ${depth}
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
    published_submission AS (
      SELECT "pollingStationId", "votesCast"
      FROM result_submissions
      WHERE "electionId" = ${electionId} AND "positionId" = ${position.id} AND status = 'PUBLISHED'
    )
    SELECT
      ud.id AS "unitId",
      ud.name AS "unitName",
      COUNT(su."stationId") AS "totalStations",
      COUNT(psub."pollingStationId") AS "publishedStations",
      COALESCE(SUM(CASE WHEN psub."pollingStationId" IS NOT NULL THEN su."registeredVoters" END), 0) AS "registeredVoters",
      COALESCE(SUM(psub."votesCast"), 0) AS "votesCast"
    FROM unit_at_depth ud
    LEFT JOIN station_unit su ON su."unitId" = ud.id
    LEFT JOIN published_submission psub ON psub."pollingStationId" = su."stationId"
    GROUP BY ud.id, ud.name
    ORDER BY ud.name
  `;

  return rows.map((r) => {
    const registeredVoters = Number(r.registeredVoters ?? 0);
    const votesCast = Number(r.votesCast ?? 0);
    return {
      unitName: r.unitName,
      publishedStations: Number(r.publishedStations),
      totalStations: Number(r.totalStations),
      registeredVoters,
      votesCast,
      turnoutPct: registeredVoters > 0 ? (votesCast / registeredVoters) * 100 : 0,
    };
  });
}

export type PublicUpdate = { stationCode: string; unitName: string; publishedAt: string };

/**
 * A public activity feed built only from `publishedAt` timestamps and
 * station/ward names — never from AuditLog (Section 31 explicitly
 * forbids exposing audit logs publicly) and never including who
 * submitted, verified, approved, or published anything.
 */
export async function getPublicUpdates(electionId: string, positionName: string, limit = 20): Promise<PublicUpdate[]> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) return [];

  const rows = await db.resultSubmission.findMany({
    where: { electionId, positionId: position.id, status: "PUBLISHED" },
    include: { pollingStation: { include: { pollingCenter: { include: { unit: true } } } } },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return rows
    .filter((r) => r.publishedAt)
    .map((r) => ({
      stationCode: r.pollingStation.code,
      unitName: r.pollingStation.pollingCenter.unit.name,
      publishedAt: r.publishedAt!.toISOString(),
    }));
}

export type PublicRegionGeo = {
  unitId: string;
  unitName: string;
  publishedStations: number;
  totalStations: number;
  turnoutPct: number;
  geojson: GeoJSON.MultiPolygon | null;
};

/**
 * Region boundaries with PUBLISHED-only reporting stats, for the public
 * map. Boundary polygons themselves aren't sensitive (they're
 * administrative geography, not results), but every vote/reporting
 * figure attached to them still goes through the same PUBLISHED-only
 * rule as everywhere else in this file.
 */
export async function getPublicRegionsWithBoundaries(
  electionId: string,
  positionName: string
): Promise<PublicRegionGeo[]> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) return [];

  const rows = await db.$queryRaw<
    Array<{
      unitId: string;
      unitName: string;
      geojson: string | null;
      totalStations: bigint;
      publishedStations: bigint;
      registeredVoters: bigint | null;
      votesCast: bigint | null;
    }>
  >`
    WITH region AS (
      SELECT au.id, au.name, au.boundary
      FROM administrative_units au
      JOIN administrative_levels al ON al.id = au."levelId"
      WHERE al.depth = 0
    ),
    station_region AS (
      SELECT ps.id AS "stationId", ps."registeredVoters", r.id AS "regionId"
      FROM polling_stations ps
      JOIN polling_centers pc ON pc.id = ps."pollingCenterId"
      JOIN administrative_units ward ON ward.id = pc."unitId"
      JOIN administrative_units constituency ON constituency.id = ward."parentId"
      JOIN region r ON r.id = constituency."parentId"
    ),
    published_submission AS (
      SELECT "pollingStationId", "votesCast"
      FROM result_submissions
      WHERE "electionId" = ${electionId} AND "positionId" = ${position.id} AND status = 'PUBLISHED'
    )
    SELECT
      r.id AS "unitId",
      r.name AS "unitName",
      ST_AsGeoJSON(r.boundary) AS geojson,
      COUNT(sr."stationId") AS "totalStations",
      COUNT(psub."pollingStationId") AS "publishedStations",
      COALESCE(SUM(CASE WHEN psub."pollingStationId" IS NOT NULL THEN sr."registeredVoters" END), 0) AS "registeredVoters",
      COALESCE(SUM(psub."votesCast"), 0) AS "votesCast"
    FROM region r
    LEFT JOIN station_region sr ON sr."regionId" = r.id
    LEFT JOIN published_submission psub ON psub."pollingStationId" = sr."stationId"
    GROUP BY r.id, r.name, r.boundary
    ORDER BY r.name
  `;

  return rows.map((r) => {
    const registeredVoters = Number(r.registeredVoters ?? 0);
    const votesCast = Number(r.votesCast ?? 0);
    return {
      unitId: r.unitId,
      unitName: r.unitName,
      publishedStations: Number(r.publishedStations),
      totalStations: Number(r.totalStations),
      turnoutPct: registeredVoters > 0 ? (votesCast / registeredVoters) * 100 : 0,
      geojson: r.geojson ? (JSON.parse(r.geojson) as GeoJSON.MultiPolygon) : null,
    };
  });
}
