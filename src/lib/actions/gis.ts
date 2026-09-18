"use server";

import { requireSession } from "@/lib/session";
import { requirePermission, authorize } from "@/lib/rbac";
import { getUnitsWithBoundaries, getPollingCenterPoints, type UnitGeoFeature, type PollingCenterPoint } from "@/lib/gis";
import { getCurrentElectionId } from "@/lib/elections/current";
import { getFieldOperationsMapData } from "@/lib/field/map-data";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import { db } from "@/lib/db";

export async function fetchUnitsAtDepth(depth: number, parentId?: string): Promise<UnitGeoFeature[]> {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "read");
  return getUnitsWithBoundaries(depth, parentId);
}

export async function fetchPollingCenterPoints(): Promise<PollingCenterPoint[]> {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "read");
  const electionId = await getCurrentElectionId();
  if (!electionId) return [];
  const election = await db.election.findUniqueOrThrow({ where: { id: electionId }, select: { countryId: true } });
  return getPollingCenterPoints(election.countryId);
}

export async function fetchFieldOperationsMapData() {
  const session = await requireSession();
  const canView = await authorize(session.user.id, "field", "manage");
  if (!canView) return { checkIns: [], reports: [], incidents: [], polling: [] };

  const electionId = await getCurrentElectionId();
  if (!electionId) return { checkIns: [], reports: [], incidents: [], polling: [] };

  const election = await db.election.findUniqueOrThrow({ where: { id: electionId }, select: { countryId: true } });
  const [mapData, polling] = await Promise.all([
    getFieldOperationsMapData(electionId),
    getPollingCenterPoints(election.countryId),
  ]);

  return { ...mapData, polling };
}

/**
 * Real per-unit turnout %, for the map's turnout layer -- reuses
 * getGeographicBreakdown, the same function the Turnout screen and
 * Dashboard already use, so the map's colors and the Turnout screen's
 * table always agree on the same numbers. Only supports depth 0
 * (region) and 1 (constituency), matching getGeographicBreakdown's own
 * supported depths; depth 2 (ward) returns an empty map rather than
 * fabricating ward-level turnout that isn't actually computed anywhere.
 */
export async function fetchTurnoutByUnit(depth: number): Promise<Record<string, number>> {
  const session = await requireSession();
  await requirePermission(session.user.id, "results", "read");

  if (depth !== 0 && depth !== 1) return {};

  const electionId = await getCurrentElectionId();
  if (!electionId) return {};

  const positions = await db.electionPosition.findMany({ where: { electionId } });
  const referencePosition = positions.find((p) => p.name === "President") ?? positions[0];
  if (!referencePosition) return {};

  const rows = await getGeographicBreakdown(electionId, referencePosition.id, depth);
  return Object.fromEntries(rows.map((r) => [r.unitId, r.turnoutPct]));
}
