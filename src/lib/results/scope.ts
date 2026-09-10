import { db } from "@/lib/db";

/**
 * Resolves the AdministrativeUnit (ward) that a polling station belongs to,
 * so RBAC's geographic-scope check (src/lib/rbac.ts authorize()) can
 * enforce e.g. "this constituency officer may only verify results for
 * polling stations within their own constituency."
 */
export async function getWardUnitIdForPollingStation(pollingStationId: string): Promise<string> {
  const station = await db.pollingStation.findUniqueOrThrow({
    where: { id: pollingStationId },
    include: { pollingCenter: true },
  });
  return station.pollingCenter.unitId;
}
