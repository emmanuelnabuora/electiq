"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { ActionError } from "@/lib/actions/errors";
import { getWardUnitIdForAlert } from "@/lib/integrity/scope";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") {
    throw new ActionError(`"${key}" is required`);
  }
  return v.trim();
}

async function loadAlertAndAuthorize(alertId: string, userId: string) {
  const alert = await db.integrityAlert.findUniqueOrThrow({ where: { id: alertId } });
  const wardUnitId = await getWardUnitIdForAlert(alert.entityType, alert.entityId);
  await requirePermission(userId, "integrity", "review", wardUnitId ?? undefined);
  return alert;
}

/** Claims an alert for review — moves OPEN to UNDER_REVIEW and assigns the current user. */
export async function claimAlert(formData: FormData) {
  const session = await requireSession();
  const alertId = str(formData, "alertId");
  const alert = await loadAlertAndAuthorize(alertId, session.user.id);

  if (alert.status !== "OPEN") {
    throw new ActionError(`This alert is already ${alert.status.toLowerCase()}`);
  }

  await db.integrityAlert.update({
    where: { id: alertId },
    data: { status: "UNDER_REVIEW", assignedToId: session.user.id },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "INTEGRITY_ALERT_ASSIGNED",
    entityType: "IntegrityAlert",
    entityId: alertId,
  });

  revalidatePath(`/integrity/${alertId}`);
  revalidatePath("/integrity");
}

export async function resolveAlert(formData: FormData) {
  const session = await requireSession();
  const alertId = str(formData, "alertId");
  const notes = str(formData, "reviewNotes");
  const alert = await loadAlertAndAuthorize(alertId, session.user.id);

  if (alert.status === "RESOLVED" || alert.status === "DISMISSED") {
    throw new ActionError(`This alert is already ${alert.status.toLowerCase()}`);
  }

  await db.integrityAlert.update({
    where: { id: alertId },
    data: { status: "RESOLVED", reviewNotes: notes, resolvedAt: new Date(), assignedToId: session.user.id },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "INTEGRITY_ALERT_RESOLVED",
    entityType: "IntegrityAlert",
    entityId: alertId,
    newState: { reviewNotes: notes },
  });

  revalidatePath(`/integrity/${alertId}`);
  revalidatePath("/integrity");
}

export async function dismissAlert(formData: FormData) {
  const session = await requireSession();
  const alertId = str(formData, "alertId");
  const notes = str(formData, "reviewNotes");
  const alert = await loadAlertAndAuthorize(alertId, session.user.id);

  if (alert.status === "RESOLVED" || alert.status === "DISMISSED") {
    throw new ActionError(`This alert is already ${alert.status.toLowerCase()}`);
  }

  await db.integrityAlert.update({
    where: { id: alertId },
    data: { status: "DISMISSED", reviewNotes: notes, resolvedAt: new Date(), assignedToId: session.user.id },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "INTEGRITY_ALERT_DISMISSED",
    entityType: "IntegrityAlert",
    entityId: alertId,
    newState: { reviewNotes: notes },
  });

  revalidatePath(`/integrity/${alertId}`);
  revalidatePath("/integrity");
}
