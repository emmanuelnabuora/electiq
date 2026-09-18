"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { ActionError } from "@/lib/actions/errors";
import { storeCandidateDocument } from "@/lib/evidence";
import { canApproveNomination } from "@/lib/elections/nomination";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || v.trim() === "") {
    throw new ActionError(`"${key}" is required`);
  }
  return v.trim();
}

/** Section 2 of the master spec — election configuration wizard. Creates the election plus its initial positions in one step. */
export async function createElection(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "create");

  const name = str(formData, "name");
  const electionDate = str(formData, "electionDate");
  const countryId = str(formData, "countryId");
  const positionNames = formData
    .getAll("positions")
    .map((p) => String(p).trim())
    .filter(Boolean);

  if (positionNames.length === 0) {
    throw new ActionError("At least one position is required");
  }

  const election = await db.election.create({
    data: {
      name,
      electionDate: new Date(electionDate),
      countryId,
      status: "DRAFT",
      positions: { create: positionNames.map((n) => ({ name: n })) },
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "ELECTION_CREATED",
    entityType: "Election",
    entityId: election.id,
    newState: { name: election.name, electionDate, positions: positionNames },
  });

  revalidatePath("/elections");
  redirect(`/elections/${election.id}`);
}

export async function updateElectionStatus(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const electionId = str(formData, "electionId");
  const status = str(formData, "status") as
    | "DRAFT"
    | "CONFIGURED"
    | "ACTIVE"
    | "CLOSED"
    | "ARCHIVED";

  const before = await db.election.findUniqueOrThrow({ where: { id: electionId } });
  const election = await db.election.update({ where: { id: electionId }, data: { status } });

  await recordAudit({
    actorId: session.user.id,
    action: "ELECTION_UPDATED",
    entityType: "Election",
    entityId: election.id,
    previousState: { status: before.status },
    newState: { status: election.status },
  });

  revalidatePath(`/elections/${electionId}`);
}

export async function addPosition(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const electionId = str(formData, "electionId");
  const name = str(formData, "name");

  const position = await db.electionPosition.create({ data: { electionId, name } });

  await recordAudit({
    actorId: session.user.id,
    action: "POSITION_CREATED",
    entityType: "ElectionPosition",
    entityId: position.id,
    newState: { name, electionId },
  });

  revalidatePath(`/elections/${electionId}`);
}

export async function addParty(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const electionId = str(formData, "electionId");
  const name = str(formData, "name");
  const abbreviation = str(formData, "abbreviation").toUpperCase();
  const colorHex = (formData.get("colorHex") as string | null)?.trim() || null;

  const party = await db.party.create({
    data: { electionId, name, abbreviation, colorHex },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "PARTY_CREATED",
    entityType: "Party",
    entityId: party.id,
    newState: { name, abbreviation },
  });

  revalidatePath(`/elections/${electionId}`);
}

export async function addCandidate(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const electionId = str(formData, "electionId");
  const positionId = str(formData, "positionId");
  const fullName = str(formData, "fullName");
  const partyId = (formData.get("partyId") as string | null) || null;
  const photoUrl = (formData.get("photoUrl") as string | null)?.trim() || null;

  const candidate = await db.candidate.create({
    data: { electionId, positionId, fullName, partyId, photoUrl },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "CANDIDATE_CREATED",
    entityType: "Candidate",
    entityId: candidate.id,
    newState: { fullName, positionId, partyId, photoUrl },
  });

  revalidatePath(`/elections/${electionId}`);
}

export async function updateCandidatePhoto(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const candidateId = str(formData, "candidateId");
  const photoUrl = (formData.get("photoUrl") as string | null)?.trim() || null;

  if (photoUrl) {
    let parsed: URL;
    try {
      parsed = new URL(photoUrl);
    } catch {
      throw new ActionError("That doesn't look like a valid URL.");
    }
    if (parsed.protocol !== "https:") {
      throw new ActionError("Photo URL must use https:// (a plain http:// link won't load securely).");
    }
  }

  const candidate = await db.candidate.update({
    where: { id: candidateId },
    data: { photoUrl },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "CANDIDATE_UPDATED",
    entityType: "Candidate",
    entityId: candidateId,
    newState: { photoUrl },
  });

  revalidatePath(`/elections/${candidate.electionId}`);
}

export async function deleteCandidate(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const candidateId = str(formData, "candidateId");
  const electionId = str(formData, "electionId");

  const candidate = await db.candidate.delete({ where: { id: candidateId } });

  await recordAudit({
    actorId: session.user.id,
    action: "CANDIDATE_DELETED",
    entityType: "Candidate",
    entityId: candidateId,
    previousState: { fullName: candidate.fullName },
  });

  revalidatePath(`/elections/${electionId}`);
}

/**
 * Real nomination-vetting decision, not a cosmetic label. Deliberately
 * enforces one real rule: a candidate cannot be marked APPROVED while
 * running under a party that isn't itself REGISTERED -- an
 * independent (partyId is null) has no such gate. This makes
 * nominationStatus and the party's registrationStatus actually
 * interact, rather than being two unrelated fields that happen to sit
 * next to each other on the same screen.
 */
export async function updateCandidateNominationStatus(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const candidateId = str(formData, "candidateId");
  const electionId = str(formData, "electionId");
  const status = str(formData, "nominationStatus") as "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  const notes = (formData.get("nominationNotes") as string | null)?.trim() || null;

  const candidate = await db.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { party: true },
  });

  if (status === "APPROVED" && !canApproveNomination(candidate)) {
    throw new ActionError(
      `Cannot approve this candidate's nomination: their party (${candidate.party!.abbreviation}) is not currently REGISTERED.`
    );
  }

  const updated = await db.candidate.update({
    where: { id: candidateId },
    data: { nominationStatus: status, nominationNotes: notes },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "CANDIDATE_UPDATED",
    entityType: "Candidate",
    entityId: candidateId,
    previousState: { nominationStatus: candidate.nominationStatus },
    newState: { nominationStatus: updated.nominationStatus, nominationNotes: notes },
  });

  revalidatePath(`/elections/${electionId}`);
  revalidatePath("/elections/candidates");
}

/**
 * Real nomination-paperwork upload for a candidate (e.g. a nomination
 * form, proof of eligibility, a party endorsement letter) -- same
 * content-addressed, encrypted-at-rest storage as result evidence
 * (src/lib/evidence.ts), not a lighter-weight path just because it's a
 * different entity type.
 */
export async function uploadCandidateDocument(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const candidateId = str(formData, "candidateId");
  const electionId = str(formData, "electionId");
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new ActionError("No file was uploaded");
  }
  if (file.size === 0) {
    throw new ActionError("The uploaded file is empty");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const doc = await storeCandidateDocument({
    candidateId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes,
    uploadedById: session.user.id,
  });

  await recordAudit({
    actorId: session.user.id,
    action: "CANDIDATE_DOCUMENT_UPLOADED",
    entityType: "CandidateDocument",
    entityId: doc.id,
    newState: { fileName: doc.fileName, sha256: doc.sha256, sizeBytes: doc.sizeBytes },
  });

  revalidatePath(`/elections/${electionId}`);
  revalidatePath("/elections/candidates");
}

/**
 * Real party registration decision. Deliberately does NOT cascade to
 * automatically reject the party's candidates when suspended -- that
 * stays a separate, explicit human decision per candidate via
 * updateCandidateNominationStatus, rather than an automatic mass
 * rejection triggered by this one action.
 */
export async function updatePartyRegistrationStatus(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const partyId = str(formData, "partyId");
  const electionId = str(formData, "electionId");
  const status = str(formData, "registrationStatus") as "PENDING" | "REGISTERED" | "SUSPENDED";

  const before = await db.party.findUniqueOrThrow({ where: { id: partyId } });
  const updated = await db.party.update({ where: { id: partyId }, data: { registrationStatus: status } });

  await recordAudit({
    actorId: session.user.id,
    action: "PARTY_UPDATED",
    entityType: "Party",
    entityId: partyId,
    previousState: { registrationStatus: before.registrationStatus },
    newState: { registrationStatus: updated.registrationStatus },
  });

  revalidatePath(`/elections/${electionId}`);
  revalidatePath("/elections/parties");
}

/**
 * Replaces a party's full set of covered administrative units in one
 * call (the form submits every checked unit at once) rather than
 * toggling one at a time -- matches how the form itself presents this
 * as a single "select all that apply" control.
 */
export async function setPartyGeographicCoverage(formData: FormData) {
  const session = await requireSession();
  await requirePermission(session.user.id, "elections", "update");

  const partyId = str(formData, "partyId");
  const electionId = str(formData, "electionId");
  const unitIds = formData.getAll("unitIds").map(String);

  await db.$transaction([
    db.partyGeographicCoverage.deleteMany({ where: { partyId } }),
    db.partyGeographicCoverage.createMany({
      data: unitIds.map((unitId) => ({ partyId, unitId })),
    }),
  ]);

  await recordAudit({
    actorId: session.user.id,
    action: "PARTY_UPDATED",
    entityType: "Party",
    entityId: partyId,
    newState: { coverageUnitCount: unitIds.length },
  });

  revalidatePath(`/elections/${electionId}`);
  revalidatePath("/elections/parties");
}
