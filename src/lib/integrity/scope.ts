import { db } from "@/lib/db";

/**
 * Resolves the ward unit an integrity alert's underlying entity belongs to,
 * for the same RBAC geographic-scope check used elsewhere (src/lib/rbac.ts
 * authorize()). Alerts reference different entity types (a result
 * submission, or a polling station directly for station-level rules like
 * MULTIPLE_SUBMISSIONS), so this dispatches on entityType.
 */
export async function getWardUnitIdForAlert(entityType: string, entityId: string): Promise<string | null> {
  if (entityType === "ResultSubmission") {
    const submission = await db.resultSubmission.findUnique({
      where: { id: entityId },
      include: { pollingStation: { include: { pollingCenter: true } } },
    });
    return submission?.pollingStation.pollingCenter.unitId ?? null;
  }
  if (entityType === "PollingStation") {
    const station = await db.pollingStation.findUnique({
      where: { id: entityId },
      include: { pollingCenter: true },
    });
    return station?.pollingCenter.unitId ?? null;
  }
  return null;
}
