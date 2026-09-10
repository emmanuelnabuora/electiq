import { db } from "@/lib/db";

/**
 * Section 12: "Maintain separate calculations for SUBMITTED, VERIFIED,
 * APPROVED, PUBLISHED... allows the system to display Reporting Progress,
 * Verification Progress, and Publication Progress as different metrics."
 *
 * "Current" here means the latest version of a submission that hasn't been
 * superseded (CORRECTED) or rejected at validation (VALIDATION_FAILED) —
 * exactly one such row can exist per (position, polling station) at a time,
 * because submitResult() marks the prior version CORRECTED the moment a
 * new one is submitted.
 *
 * Turnout is computed against a single reference position (the election's
 * first configured position, treated as the headline/presidential race) to
 * avoid double-counting a voter's single visit to the polling station
 * across multiple down-ballot races.
 */
export async function getResultsAggregate(electionId: string) {
  // Prefer the position named "President" as the turnout reference when one
  // exists (the natural headline race for a general election); otherwise
  // fall back to whichever position was configured first. Position creation
  // order isn't guaranteed across concurrent inserts, so this avoids
  // non-deterministically picking a down-ballot race with zero submissions.
  const referencePosition =
    (await db.electionPosition.findFirst({ where: { electionId, name: "President" } })) ??
    (await db.electionPosition.findFirst({ where: { electionId }, orderBy: { id: "asc" } }));

  const totalStations = await db.pollingStation.count();

  if (!referencePosition) {
    return {
      referencePositionName: null,
      totalStations,
      reportingStations: 0,
      votesCast: 0,
      verifiedCount: 0,
      approvedCount: 0,
      publishedCount: 0,
    };
  }

  const current = await db.resultSubmission.findMany({
    where: {
      electionId,
      positionId: referencePosition.id,
      status: { notIn: ["CORRECTED", "VALIDATION_FAILED", "DRAFT"] },
    },
    select: { votesCast: true, status: true },
  });

  const votesCast = current.reduce((sum, r) => sum + r.votesCast, 0);
  const verifiedCount = current.filter((r) =>
    ["VERIFIED", "APPROVED", "PUBLISHED"].includes(r.status)
  ).length;
  const approvedCount = current.filter((r) => ["APPROVED", "PUBLISHED"].includes(r.status)).length;
  const publishedCount = current.filter((r) => r.status === "PUBLISHED").length;

  return {
    referencePositionName: referencePosition.name,
    totalStations,
    reportingStations: current.length,
    votesCast,
    verifiedCount,
    approvedCount,
    publishedCount,
  };
}
