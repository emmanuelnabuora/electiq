import { db } from "@/lib/db";

/**
 * Real location label for a polling station -- walks up its actual
 * administrative unit chain (ward -> constituency/county) rather than
 * showing a raw station code. Returns null if the station can't be
 * resolved (e.g. a stale/deleted reference), so callers can fall back
 * to something honest ("Unknown location") instead of a fabricated
 * placeholder.
 */
export async function getPollingStationLocationLabel(pollingStationId: string): Promise<string | null> {
  const station = await db.pollingStation.findUnique({
    where: { id: pollingStationId },
    select: {
      pollingCenter: {
        select: {
          unit: {
            select: {
              name: true,
              parent: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const unit = station?.pollingCenter.unit;
  if (!unit) return null;
  return unit.parent ? `${unit.parent.name}, ${unit.name}` : unit.name;
}
