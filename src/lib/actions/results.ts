"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { ActionError } from "@/lib/actions/errors";
import { getWardUnitIdForPollingStation } from "@/lib/results/scope";
import { validateResultSubmission } from "@/lib/results/validation";
import { storeResultDocument } from "@/lib/evidence";
import { scanSubmission } from "@/lib/integrity/scan";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") {
    throw new ActionError(`"${key}" is required`);
  }
  return v.trim();
}

function int(formData: FormData, key: string): number {
  const raw = str(formData, key);
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new ActionError(`"${key}" must be a whole number`);
  }
  return n;
}

/**
 * Submits a polling-station result. If a prior version already exists for
 * this (election, position, polling station), this creates a new version
 * rather than editing anything in place, and the prior version is marked
 * CORRECTED — nothing is ever overwritten (Section 3).
 */
export async function submitResult(formData: FormData) {
  const session = await requireSession();

  const electionId = str(formData, "electionId");
  const positionId = str(formData, "positionId");
  const pollingStationId = str(formData, "pollingStationId");
  const wardUnitId = await getWardUnitIdForPollingStation(pollingStationId);

  await requirePermission(session.user.id, "results", "submit", wardUnitId);

  const registeredVoters = int(formData, "registeredVoters");
  const ballotsIssued = int(formData, "ballotsIssued");
  const votesCast = int(formData, "votesCast");
  const validVotes = int(formData, "validVotes");
  const rejectedBallots = int(formData, "rejectedBallots");
  const changeReason = (formData.get("changeReason") as string | null)?.trim() || null;
  const gpsLatitude = (formData.get("gpsLatitude") as string | null)?.trim();
  const gpsLongitude = (formData.get("gpsLongitude") as string | null)?.trim();

  const candidateIds = formData.getAll("candidateId").map(String);
  const candidateVoteValues = formData.getAll("candidateVotes").map(String);
  const candidateVotes = candidateIds.map((candidateId, i) => ({
    candidateId,
    votes: Number(candidateVoteValues[i]),
  }));

  const validation = validateResultSubmission({
    registeredVoters,
    ballotsIssued,
    votesCast,
    validVotes,
    rejectedBallots,
    candidateVotes,
  });

  const previous = await db.resultSubmission.findFirst({
    where: { electionId, positionId, pollingStationId },
    orderBy: { version: "desc" },
  });

  if (previous && !changeReason) {
    throw new ActionError("A reason is required when correcting a previous submission");
  }

  const submission = await db.$transaction(async (tx) => {
    const created = await tx.resultSubmission.create({
      data: {
        electionId,
        positionId,
        pollingStationId,
        submittedById: session.user.id,
        version: (previous?.version ?? 0) + 1,
        previousVersionId: previous?.id,
        status: validation.valid ? "AWAITING_REVIEW" : "VALIDATION_FAILED",
        registeredVoters,
        ballotsIssued,
        votesCast,
        validVotes,
        rejectedBallots,
        gpsLatitude: gpsLatitude ? Number(gpsLatitude) : null,
        gpsLongitude: gpsLongitude ? Number(gpsLongitude) : null,
        changeReason,
        validationErrors: validation.errors,
        submittedAt: new Date(),
        candidateResults: { create: candidateVotes },
      },
    });

    if (previous) {
      await tx.resultSubmission.update({
        where: { id: previous.id },
        data: { status: "CORRECTED" },
      });
    }

    return created;
  });

  await recordAudit({
    actorId: session.user.id,
    action: validation.valid ? "RESULT_SUBMITTED" : "RESULT_VALIDATION_FAILED",
    entityType: "ResultSubmission",
    entityId: submission.id,
    newState: { version: submission.version, status: submission.status, errors: validation.errors },
  });

  // Integrity monitoring is a second, independent layer on top of
  // deterministic validation (Section 5) — only runs once a submission has
  // already passed the rules in src/lib/results/validation.ts.
  if (validation.valid) {
    await scanSubmission(submission.id);
  }

  revalidatePath("/results/submissions");
  redirect(`/results/submissions/${submission.id}`);
}

export async function verifyResult(formData: FormData) {
  const session = await requireSession();
  const submissionId = str(formData, "submissionId");
  const decision = str(formData, "decision") as "VERIFIED" | "FLAGGED" | "DISPUTED";
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const submission = await db.resultSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { pollingStation: { include: { pollingCenter: true } } },
  });
  const wardUnitId = submission.pollingStation.pollingCenter.unitId;

  await requirePermission(session.user.id, "results", "verify", wardUnitId);

  if (submission.status !== "AWAITING_REVIEW") {
    throw new ActionError(`This result is ${submission.status.toLowerCase()}, not awaiting review`);
  }

  await db.$transaction([
    db.resultVerification.create({
      data: { submissionId, verifierId: session.user.id, decision, notes },
    }),
    db.resultSubmission.update({
      where: { id: submissionId },
      data: { status: decision, verifiedAt: decision === "VERIFIED" ? new Date() : undefined },
    }),
  ]);

  await recordAudit({
    actorId: session.user.id,
    action: decision === "VERIFIED" ? "RESULT_VERIFIED" : decision === "FLAGGED" ? "RESULT_FLAGGED" : "RESULT_DISPUTED",
    entityType: "ResultSubmission",
    entityId: submissionId,
    newState: { decision, notes },
  });

  revalidatePath(`/results/submissions/${submissionId}`);
}

export async function approveResult(formData: FormData) {
  const session = await requireSession();
  const submissionId = str(formData, "submissionId");

  const submission = await db.resultSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { pollingStation: { include: { pollingCenter: true } } },
  });
  const wardUnitId = submission.pollingStation.pollingCenter.unitId;

  await requirePermission(session.user.id, "results", "approve", wardUnitId);

  if (submission.status !== "VERIFIED") {
    throw new ActionError(`This result must be VERIFIED before it can be approved (currently ${submission.status})`);
  }

  await db.resultSubmission.update({
    where: { id: submissionId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "RESULT_APPROVED",
    entityType: "ResultSubmission",
    entityId: submissionId,
  });

  revalidatePath(`/results/submissions/${submissionId}`);
}

export async function publishResult(formData: FormData) {
  const session = await requireSession();
  const submissionId = str(formData, "submissionId");

  const submission = await db.resultSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { pollingStation: { include: { pollingCenter: true } } },
  });
  const wardUnitId = submission.pollingStation.pollingCenter.unitId;

  await requirePermission(session.user.id, "results", "publish", wardUnitId);

  if (submission.status !== "APPROVED") {
    throw new ActionError(`This result must be APPROVED before it can be published (currently ${submission.status})`);
  }

  await db.resultSubmission.update({
    where: { id: submissionId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "RESULT_PUBLISHED",
    entityType: "ResultSubmission",
    entityId: submissionId,
  });

  revalidatePath(`/results/submissions/${submissionId}`);
  revalidatePath("/command-center");
}

export async function uploadResultDocument(formData: FormData) {
  const session = await requireSession();
  const submissionId = str(formData, "submissionId");
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new ActionError("No file was uploaded");
  }
  if (file.size === 0) {
    throw new ActionError("The uploaded file is empty");
  }

  const submission = await db.resultSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { pollingStation: { include: { pollingCenter: true } } },
  });
  const wardUnitId = submission.pollingStation.pollingCenter.unitId;

  await requirePermission(session.user.id, "results", "submit", wardUnitId);

  const bytes = Buffer.from(await file.arrayBuffer());
  const doc = await storeResultDocument({
    submissionId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes,
    uploadedById: session.user.id,
  });

  await recordAudit({
    actorId: session.user.id,
    action: "RESULT_DOCUMENT_UPLOADED",
    entityType: "ResultDocument",
    entityId: doc.id,
    newState: { fileName: doc.fileName, sha256: doc.sha256, sizeBytes: doc.sizeBytes },
  });

  revalidatePath(`/results/submissions/${submissionId}`);
}
