"use server";

import { requireSession } from "@/lib/session";
import { requirePermission, authorize } from "@/lib/rbac";
import { getUnitsWithBoundaries, getPollingCenterPoints, type UnitGeoFeature, type PollingCenterPoint } from "@/lib/gis";
import { getCurrentElectionId } from "@/lib/elections/current";
import { getFieldOperationsMapData } from "@/lib/field/map-data";
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
