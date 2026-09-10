"use server";

import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/rbac";
import { getUnitsWithBoundaries, getPollingCenterPoints, type UnitGeoFeature, type PollingCenterPoint } from "@/lib/gis";

export async function fetchUnitsAtDepth(depth: number, parentId?: string): Promise<UnitGeoFeature[]> {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "read");
  return getUnitsWithBoundaries(depth, parentId);
}

export async function fetchPollingCenterPoints(): Promise<PollingCenterPoint[]> {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "read");
  return getPollingCenterPoints();
}
