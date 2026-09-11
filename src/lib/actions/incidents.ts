"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { ActionError } from "@/lib/actions/errors";
import { getWardUnitIdForIncident } from "@/lib/field/scope";
import { sha256HexBuffer, encryptBuffer } from "@/lib/security/crypto";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") {
    throw new ActionError(`"${key}" is required`);
  }
  return v.trim();
}

export async function reportIncident(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "incidents", "create");

  const electionId = str(formData, "electionId");
  const title = str(formData, "title");
  const description = str(formData, "description");
  const severity = str(formData, "severity") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  const pollingStationId = (formData.get("pollingStationId") as string | null)?.trim() || null;
  const latitude = (formData.get("latitude") as string | null)?.trim();
  const longitude = (formData.get("longitude") as string | null)?.trim();

  const incident = await db.incident.create({
    data: {
      electionId,
      title,
      description,
      severity,
      pollingStationId,
      reportedById: session.user.id,
      gpsLatitude: latitude ? Number(latitude) : null,
      gpsLongitude: longitude ? Number(longitude) : null,
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "INCIDENT_CREATED",
    entityType: "Incident",
    entityId: incident.id,
    newState: { title, severity, pollingStationId },
  });

  revalidatePath("/command-center/incidents");
  redirect(`/command-center/incidents/${incident.id}`);
}

export async function uploadIncidentEvidence(formData: FormData) {
  const session = await requireSession();
  const incidentId = str(formData, "incidentId");
  const file = formData.get("file");

  if (!(file instanceof File)) throw new ActionError("No file was uploaded");
  if (file.size === 0) throw new ActionError("The uploaded file is empty");

  await requirePermission(session.user.id, "incidents", "create");

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = sha256HexBuffer(bytes);
  const encrypted = encryptBuffer(bytes);

  const doc = await db.incidentEvidence.create({
    data: {
      incidentId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: bytes.byteLength,
      sha256,
      content: new Uint8Array(encrypted),
      uploadedById: session.user.id,
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "INCIDENT_EVIDENCE_UPLOADED",
    entityType: "IncidentEvidence",
    entityId: doc.id,
    newState: { fileName: doc.fileName, sha256: doc.sha256 },
  });

  revalidatePath(`/command-center/incidents/${incidentId}`);
}

async function loadIncidentAndAuthorizeReview(incidentId: string, userId: string) {
  const incident = await db.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const wardUnitId = await getWardUnitIdForIncident(incidentId);
  await requirePermission(userId, "incidents", "review", wardUnitId ?? undefined);
  return incident;
}

export async function acknowledgeIncident(formData: FormData) {
  const session = await requireSession();
  const incidentId = str(formData, "incidentId");
  const incident = await loadIncidentAndAuthorizeReview(incidentId, session.user.id);

  if (incident.status !== "OPEN") {
    throw new ActionError(`This incident is already ${incident.status.toLowerCase()}`);
  }

  await db.incident.update({ where: { id: incidentId }, data: { status: "ACKNOWLEDGED" } });
  await recordAudit({
    actorId: session.user.id,
    action: "INCIDENT_ACKNOWLEDGED",
    entityType: "Incident",
    entityId: incidentId,
  });
  revalidatePath(`/command-center/incidents/${incidentId}`);
  revalidatePath("/command-center/incidents");
}

export async function resolveIncident(formData: FormData) {
  const session = await requireSession();
  const incidentId = str(formData, "incidentId");
  const reviewNotes = str(formData, "reviewNotes");
  const incident = await loadIncidentAndAuthorizeReview(incidentId, session.user.id);

  if (incident.status === "RESOLVED" || incident.status === "DISMISSED") {
    throw new ActionError(`This incident is already ${incident.status.toLowerCase()}`);
  }

  await db.incident.update({
    where: { id: incidentId },
    data: { status: "RESOLVED", reviewNotes, resolvedAt: new Date() },
  });
  await recordAudit({
    actorId: session.user.id,
    action: "INCIDENT_RESOLVED",
    entityType: "Incident",
    entityId: incidentId,
    newState: { reviewNotes },
  });
  revalidatePath(`/command-center/incidents/${incidentId}`);
  revalidatePath("/command-center/incidents");
}

export async function dismissIncident(formData: FormData) {
  const session = await requireSession();
  const incidentId = str(formData, "incidentId");
  const reviewNotes = str(formData, "reviewNotes");
  const incident = await loadIncidentAndAuthorizeReview(incidentId, session.user.id);

  if (incident.status === "RESOLVED" || incident.status === "DISMISSED") {
    throw new ActionError(`This incident is already ${incident.status.toLowerCase()}`);
  }

  await db.incident.update({
    where: { id: incidentId },
    data: { status: "DISMISSED", reviewNotes, resolvedAt: new Date() },
  });
  await recordAudit({
    actorId: session.user.id,
    action: "INCIDENT_DISMISSED",
    entityType: "Incident",
    entityId: incidentId,
    newState: { reviewNotes },
  });
  revalidatePath(`/command-center/incidents/${incidentId}`);
  revalidatePath("/command-center/incidents");
}
