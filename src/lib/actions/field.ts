"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { ActionError } from "@/lib/actions/errors";
import { loadOwnAssignment } from "@/lib/field/scope";
import type { Prisma } from "@/generated/prisma/client";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") {
    throw new ActionError(`"${key}" is required`);
  }
  return v.trim();
}

/** Assigns an existing OBSERVER-role user to a polling station, creating their accreditation profile on first assignment if needed. */
export async function assignObserver(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "field", "manage");

  const userId = str(formData, "userId");
  const pollingStationId = str(formData, "pollingStationId");
  const organization = (formData.get("organization") as string | null)?.trim() || null;
  const accreditationNumber = (formData.get("accreditationNumber") as string | null)?.trim() || null;

  const observer = await db.observer.upsert({
    where: { userId },
    update: {},
    create: { userId, organization, accreditationNumber },
  });

  const existing = await db.observerAssignment.findUnique({
    where: { observerId_pollingStationId: { observerId: observer.id, pollingStationId } },
  });
  if (existing) {
    throw new ActionError("This observer is already assigned to this polling station");
  }

  const assignment = await db.observerAssignment.create({
    data: { observerId: observer.id, pollingStationId },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "OBSERVER_ASSIGNED",
    entityType: "ObserverAssignment",
    entityId: assignment.id,
    newState: { observerId: observer.id, pollingStationId },
  });

  revalidatePath("/command-center/field");
}

export async function acceptAssignment(formData: FormData) {
  const session = await requireSession();
  const assignmentId = str(formData, "assignmentId");

  const assignment = await loadOwnAssignment(session.user.id, assignmentId);
  if (!assignment) throw new ActionError("This assignment does not belong to you");
  if (assignment.status !== "ASSIGNED") {
    throw new ActionError(`This assignment is already ${assignment.status.toLowerCase()}`);
  }

  await db.observerAssignment.update({
    where: { id: assignmentId },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "FIELD_ASSIGNMENT_ACCEPTED",
    entityType: "ObserverAssignment",
    entityId: assignmentId,
  });

  revalidatePath("/command-center/field");
}

export async function checkIn(formData: FormData) {
  const session = await requireSession();
  const assignmentId = str(formData, "assignmentId");
  const latitude = (formData.get("latitude") as string | null)?.trim();
  const longitude = (formData.get("longitude") as string | null)?.trim();

  await requirePermission(session.user.id, "field", "checkin");

  const assignment = await loadOwnAssignment(session.user.id, assignmentId);
  if (!assignment) throw new ActionError("This assignment does not belong to you");
  if (assignment.status !== "ACCEPTED") {
    throw new ActionError("Accept the assignment before checking in");
  }

  await db.observerAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "CHECKED_IN",
      checkedInAt: new Date(),
      checkInLatitude: latitude ? Number(latitude) : null,
      checkInLongitude: longitude ? Number(longitude) : null,
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "FIELD_CHECK_IN",
    entityType: "ObserverAssignment",
    entityId: assignmentId,
    newState: { latitude, longitude },
  });

  revalidatePath("/command-center/field");
}

/**
 * Submits a field report. `clientReportId` is an idempotency key the
 * client generates once (see src/lib/field/offline-queue.ts) — if the
 * same report is synced twice after a flaky connection, the unique
 * constraint on (assignmentId, clientReportId) means the retry is a no-op
 * rather than a duplicate report.
 */
export async function submitFieldReport(formData: FormData) {
  const session = await requireSession();
  const assignmentId = str(formData, "assignmentId");
  const electionId = str(formData, "electionId");
  const type = str(formData, "type") as "OPENING" | "TURNOUT" | "COUNTING" | "CLOSING" | "GENERAL";
  const notes = (formData.get("notes") as string | null)?.trim() || "";
  const clientReportId = str(formData, "clientReportId");
  const latitude = (formData.get("latitude") as string | null)?.trim();
  const longitude = (formData.get("longitude") as string | null)?.trim();

  await requirePermission(session.user.id, "field", "report");

  const assignment = await loadOwnAssignment(session.user.id, assignmentId);
  if (!assignment) throw new ActionError("This assignment does not belong to you");
  if (assignment.status !== "CHECKED_IN" && assignment.status !== "COMPLETED") {
    throw new ActionError("Check in at the polling station before filing a report");
  }

  const content: Prisma.InputJsonObject = { notes };
  let votersProcessed: number | null = null;
  if (type === "TURNOUT") {
    votersProcessed = Number(str(formData, "votersProcessed"));
    if (!Number.isInteger(votersProcessed) || votersProcessed < 0) {
      throw new ActionError("Voters processed must be a non-negative whole number");
    }
  }
  const reportContent: Prisma.InputJsonObject =
    votersProcessed !== null ? { ...content, votersProcessed } : content;

  const existing = await db.fieldReport.findUnique({
    where: { assignmentId_clientReportId: { assignmentId, clientReportId } },
  });
  if (existing) {
    // Idempotent retry — the offline queue already succeeded once.
    return;
  }

  const report = await db.fieldReport.create({
    data: {
      assignmentId,
      electionId,
      type,
      content: reportContent,
      clientReportId,
      gpsLatitude: latitude ? Number(latitude) : null,
      gpsLongitude: longitude ? Number(longitude) : null,
    },
  });

  if (type === "TURNOUT" && votersProcessed !== null) {
    await db.turnoutSnapshot.create({
      data: {
        electionId,
        pollingStationId: assignment.pollingStationId,
        votersProcessed,
        registeredVoters: assignment.pollingStation.registeredVoters,
        source: "FIELD",
      },
    });
    await recordAudit({
      actorId: session.user.id,
      action: "TURNOUT_SNAPSHOT_CREATED",
      entityType: "TurnoutSnapshot",
      entityId: report.id,
      newState: { votersProcessed },
    });
  }

  await recordAudit({
    actorId: session.user.id,
    action: "FIELD_REPORT_SUBMITTED",
    entityType: "FieldReport",
    entityId: report.id,
    newState: { type, assignmentId },
  });

  revalidatePath("/command-center/field");
}
