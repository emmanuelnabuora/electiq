"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { setPollingCenterLocation } from "@/lib/gis";
import { ActionError } from "@/lib/actions/errors";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") {
    throw new ActionError(`"${key}" is required`);
  }
  return v.trim();
}

/** Single-record polling station entry — for the common bulk-import path, see src/lib/import/polling-stations.ts. */
export async function createPollingStation(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "geography", "manage");

  const wardId = str(formData, "wardId");
  const centerCode = str(formData, "centerCode");
  const centerName = str(formData, "centerName");
  const stationCode = str(formData, "stationCode");
  const stationName = str(formData, "stationName");
  const registeredVoters = Number(str(formData, "registeredVoters"));
  const latitudeRaw = (formData.get("latitude") as string | null)?.trim();
  const longitudeRaw = (formData.get("longitude") as string | null)?.trim();

  if (!Number.isInteger(registeredVoters) || registeredVoters < 0) {
    throw new ActionError("Registered voters must be a non-negative whole number");
  }

  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;
  if ((latitude !== null && Number.isNaN(latitude)) || (longitude !== null && Number.isNaN(longitude))) {
    throw new ActionError("Latitude/longitude must be numbers");
  }

  const center = await db.pollingCenter.upsert({
    where: { code: centerCode },
    update: {},
    create: { code: centerCode, name: centerName, unitId: wardId, latitude, longitude },
  });

  if (latitude !== null && longitude !== null) {
    await setPollingCenterLocation(center.id, latitude, longitude);
  }

  const station = await db.pollingStation.create({
    data: {
      code: stationCode,
      name: stationName,
      registeredVoters,
      pollingCenterId: center.id,
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "POLLING_STATION_CREATED",
    entityType: "PollingStation",
    entityId: station.id,
    newState: { code: stationCode, name: stationName, registeredVoters, centerCode },
  });

  revalidatePath("/polling-stations");
}
