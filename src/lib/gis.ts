import { db as sharedDb } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";
import { getCurrentElectionId } from "@/lib/elections/current";

/**
 * All PostGIS interaction lives here. `boundary` (AdministrativeUnit) and
 * `location` (PollingCenter) are declared as `Unsupported(...)` in
 * schema.prisma because Prisma Client cannot hydrate native geometry
 * types — every read or write of those columns goes through the raw SQL
 * helpers below instead of the generated client's normal query builder.
 *
 * Functions take an optional client so the seed script (which runs outside
 * Next.js and constructs its own PrismaClient) can pass its own instance
 * instead of importing the app's singleton.
 */

type DbLike = Pick<PrismaClient, "$executeRaw" | "$queryRaw">;

export type LngLat = [number, number];

/** A closed ring: first and last point must be identical. */
export type Ring = LngLat[];

async function resolveDefaultCountryId(): Promise<string> {
  const electionId = await getCurrentElectionId();
  if (electionId) {
    const election = await sharedDb.election.findUnique({ where: { id: electionId }, select: { countryId: true } });
    if (election) return election.countryId;
  }
  // No current election (e.g. seeding, or a database with no elections
  // configured yet) -- fall back to whichever country was created first,
  // rather than throwing, so this remains usable outside a live election.
  const fallback = await sharedDb.country.findFirstOrThrow({ orderBy: { id: "asc" } });
  return fallback.id;
}

/** Sets an administrative unit's boundary from a single polygon (one outer ring, no holes). */
export async function setUnitBoundary(
  unitId: string,
  ring: Ring,
  client: DbLike = sharedDb
): Promise<void> {
  const geojson = JSON.stringify({ type: "MultiPolygon", coordinates: [[ring]] });
  await client.$executeRaw`
    UPDATE administrative_units
    SET boundary = ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)
    WHERE id = ${unitId}
  `;
}

/** Sets a polling center's point location from latitude/longitude (also kept denormalized as floats for simple display). */
export async function setPollingCenterLocation(
  centerId: string,
  latitude: number,
  longitude: number,
  client: DbLike = sharedDb
): Promise<void> {
  await client.$executeRaw`
    UPDATE polling_centers
    SET location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
    WHERE id = ${centerId}
  `;
}

export type UnitGeoFeature = {
  id: string;
  name: string;
  code: string;
  depth: number;
  registeredVoters: number;
  pollingStationCount: number;
  geojson: GeoJSON.MultiPolygon | null;
};

/**
 * Returns every administrative unit at the given depth as a GeoJSON
 * feature, aggregated with registered-voter and polling-station counts
 * from everything under it — what the interactive map's choropleth layer
 * needs in one query rather than N+1 client-side joins. Pass `parentId` to
 * drill down into one unit's children only (Section 15: "clicking a
 * geographic unit must drill down into its analytical context").
 *
 * Scoped to a single country — defaults to the current election's country
 * when not given explicitly. Without this, once a second country's
 * administrative hierarchy exists in the same database at the same depth
 * numbering (region/constituency/ward), this silently mixed units from
 * every country into one result set; latent with only one country in the
 * database, caught once a second one existed.
 */
export async function getUnitsWithBoundaries(
  depth: number,
  parentId?: string,
  countryId?: string
): Promise<UnitGeoFeature[]> {
  const resolvedCountryId = countryId ?? (await resolveDefaultCountryId());
  const rows = await sharedDb.$queryRaw<
    Array<{
      id: string;
      name: string;
      code: string;
      geojson: string | null;
      registeredVoters: bigint | null;
      pollingStationCount: bigint | null;
    }>
  >`
    SELECT
      au.id,
      au.name,
      au.code,
      ST_AsGeoJSON(au.boundary) AS geojson,
      COALESCE(SUM(ps."registeredVoters"), 0) AS "registeredVoters",
      COUNT(ps.id) AS "pollingStationCount"
    FROM administrative_units au
    JOIN administrative_levels al ON al.id = au."levelId"
    -- walk down to every descendant unit that actually has polling centers
    LEFT JOIN administrative_units descendant ON descendant.id = au.id
      OR descendant."parentId" = au.id
      OR descendant."parentId" IN (SELECT id FROM administrative_units WHERE "parentId" = au.id)
    LEFT JOIN polling_centers pc ON pc."unitId" = descendant.id
    LEFT JOIN polling_stations ps ON ps."pollingCenterId" = pc.id
    WHERE al.depth = ${depth}
      AND al."countryId" = ${resolvedCountryId}
      AND (${parentId ?? null}::text IS NULL OR au."parentId" = ${parentId ?? null})
    GROUP BY au.id, au.name, au.code
    ORDER BY au.name
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    depth,
    registeredVoters: Number(r.registeredVoters ?? 0),
    pollingStationCount: Number(r.pollingStationCount ?? 0),
    geojson: r.geojson ? (JSON.parse(r.geojson) as GeoJSON.MultiPolygon) : null,
  }));
}

export type PollingCenterPoint = {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  stationCount: number;
  registeredVoters: number;
};

/** Returns every polling center that has coordinates, for map markers. */
export async function getPollingCenterPoints(): Promise<PollingCenterPoint[]> {
  const rows = await sharedDb.$queryRaw<
    Array<{
      id: string;
      name: string;
      code: string;
      latitude: number | null;
      longitude: number | null;
      stationCount: bigint;
      registeredVoters: bigint | null;
    }>
  >`
    SELECT
      pc.id, pc.name, pc.code, pc.latitude, pc.longitude,
      COUNT(ps.id) AS "stationCount",
      COALESCE(SUM(ps."registeredVoters"), 0) AS "registeredVoters"
    FROM polling_centers pc
    LEFT JOIN polling_stations ps ON ps."pollingCenterId" = pc.id
    WHERE pc.latitude IS NOT NULL AND pc.longitude IS NOT NULL
    GROUP BY pc.id, pc.name, pc.code, pc.latitude, pc.longitude
    ORDER BY pc.name
  `;

  return rows
    .filter((r) => r.latitude !== null && r.longitude !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      latitude: r.latitude as number,
      longitude: r.longitude as number,
      stationCount: Number(r.stationCount),
      registeredVoters: Number(r.registeredVoters ?? 0),
    }));
}

/**
 * Generates a simple rectangular ring for synthetic/demo geography — real
 * deployments would import actual survey boundaries via Sprint 2's bulk
 * import pipeline or a future GIS-file upload, not this. Used by the seed
 * script to lay out the Republic of Karibu's regions/constituencies/wards
 * on a grid so the map has real, distinct, queryable polygons to render.
 */
export function rectangleRing(
  centerLng: number,
  centerLat: number,
  halfWidth: number,
  halfHeight: number
): Ring {
  const w = halfWidth;
  const h = halfHeight;
  return [
    [centerLng - w, centerLat - h],
    [centerLng + w, centerLat - h],
    [centerLng + w, centerLat + h],
    [centerLng - w, centerLat + h],
    [centerLng - w, centerLat - h],
  ];
}
