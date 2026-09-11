import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  haversineDistanceKm,
  rejectedBallotRate,
  turnoutPct,
  INTEGRITY_THRESHOLDS,
} from "@/lib/integrity/rules";
import type { IntegrityRule, IntegritySeverity, Prisma } from "@/generated/prisma/client";

/**
 * Section 2 of the master spec, restated here because it governs
 * everything in this file: an alert is "requires verification" or
 * "unusual statistical pattern," never a fraud determination. Every
 * `explanation` string below is written in that register on purpose.
 */

async function createAlertIfNotExists(params: {
  rule: IntegrityRule;
  severity: IntegritySeverity;
  entityType: string;
  entityId: string;
  explanation: string;
  evidence: Prisma.InputJsonValue;
}): Promise<boolean> {
  const existing = await db.integrityAlert.findFirst({
    where: {
      rule: params.rule,
      entityType: params.entityType,
      entityId: params.entityId,
      status: { in: ["OPEN", "UNDER_REVIEW"] },
    },
  });
  if (existing) return false;

  const alert = await db.integrityAlert.create({
    data: {
      rule: params.rule,
      severity: params.severity,
      entityType: params.entityType,
      entityId: params.entityId,
      explanation: params.explanation,
      evidence: params.evidence,
    },
  });

  await recordAudit({
    action: "INTEGRITY_ALERT_CREATED",
    entityType: "IntegrityAlert",
    entityId: alert.id,
    newState: { rule: params.rule, severity: params.severity },
  });

  return true;
}

/**
 * Runs every applicable rule against one submission (and, where a rule
 * needs context, its siblings in the same constituency or version chain).
 * Called automatically after a submission passes deterministic validation
 * (src/lib/actions/results.ts submitResult) — an integrity alert is a
 * second, independent layer, not a replacement for that validation.
 */
export async function scanSubmission(submissionId: string): Promise<{ alertsCreated: number }> {
  const submission = await db.resultSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      candidateResults: true,
      documents: true,
      pollingStation: { include: { pollingCenter: { include: { unit: true } } } },
    },
  });

  let alertsCreated = 0;
  const flag = async (...args: Parameters<typeof createAlertIfNotExists>) => {
    if (await createAlertIfNotExists(...args)) alertsCreated++;
  };

  // 1. TURNOUT_GT_REGISTERED — defense in depth; submission-time validation
  // already prevents this, so this should never fire on data that went
  // through submitResult(). It exists so a data-integrity bug in that
  // validation doesn't go unnoticed.
  if (submission.votesCast > submission.registeredVoters) {
    await flag({
      rule: "TURNOUT_GT_REGISTERED",
      severity: "CRITICAL",
      entityType: "ResultSubmission",
      entityId: submission.id,
      explanation: "Votes cast exceeds registered voters for this polling station. Requires verification.",
      evidence: { votesCast: submission.votesCast, registeredVoters: submission.registeredVoters },
    });
  }

  // 2. VOTES_GT_VALID — same defense-in-depth reasoning.
  if (submission.validVotes + submission.rejectedBallots !== submission.votesCast) {
    await flag({
      rule: "VOTES_GT_VALID",
      severity: "CRITICAL",
      entityType: "ResultSubmission",
      entityId: submission.id,
      explanation: "Valid votes plus rejected ballots does not equal votes cast. Requires verification.",
      evidence: {
        validVotes: submission.validVotes,
        rejectedBallots: submission.rejectedBallots,
        votesCast: submission.votesCast,
      },
    });
  }

  // 3. CANDIDATE_TOTAL_MISMATCH — same defense-in-depth reasoning.
  const candidateTotal = submission.candidateResults.reduce((sum, cr) => sum + cr.votes, 0);
  if (candidateTotal !== submission.validVotes) {
    await flag({
      rule: "CANDIDATE_TOTAL_MISMATCH",
      severity: "CRITICAL",
      entityType: "ResultSubmission",
      entityId: submission.id,
      explanation: "Sum of candidate votes does not equal valid votes. Requires verification.",
      evidence: { candidateTotal, validVotes: submission.validVotes },
    });
  }

  // 4. DUPLICATE_RESULT — two different submitters filing for the same
  // (position, station) within a short window of each other.
  const siblings = await db.resultSubmission.findMany({
    where: {
      electionId: submission.electionId,
      positionId: submission.positionId,
      pollingStationId: submission.pollingStationId,
      id: { not: submission.id },
    },
    select: { id: true, submittedAt: true, submittedById: true },
  });
  const windowMs = INTEGRITY_THRESHOLDS.duplicateWindowMinutes * 60_000;
  const nearDuplicate = siblings.find(
    (s) =>
      s.submittedById &&
      s.submittedById !== submission.submittedById &&
      s.submittedAt &&
      submission.submittedAt &&
      Math.abs(s.submittedAt.getTime() - submission.submittedAt.getTime()) <= windowMs
  );
  if (nearDuplicate) {
    await flag({
      rule: "DUPLICATE_RESULT",
      severity: "HIGH",
      entityType: "ResultSubmission",
      entityId: submission.id,
      explanation:
        "Another submission for the same polling station and position was filed by a different user within a short window. Requires verification.",
      evidence: { otherSubmissionId: nearDuplicate.id, windowMinutes: INTEGRITY_THRESHOLDS.duplicateWindowMinutes },
    });
  }

  // 5. MISSING_RESULT_DOCUMENT
  if (["VERIFIED", "APPROVED", "PUBLISHED"].includes(submission.status) && submission.documents.length === 0) {
    await flag({
      rule: "MISSING_RESULT_DOCUMENT",
      severity: "MEDIUM",
      entityType: "ResultSubmission",
      entityId: submission.id,
      explanation: "This result has progressed past initial review with no supporting evidence document attached.",
      evidence: { status: submission.status },
    });
  }

  // 6. GPS_MISMATCH
  const center = submission.pollingStation.pollingCenter;
  if (
    submission.gpsLatitude !== null &&
    submission.gpsLongitude !== null &&
    center.latitude !== null &&
    center.longitude !== null
  ) {
    const distanceKm = haversineDistanceKm(
      submission.gpsLatitude,
      submission.gpsLongitude,
      center.latitude,
      center.longitude
    );
    if (distanceKm > INTEGRITY_THRESHOLDS.gpsMismatchKm) {
      await flag({
        rule: "GPS_MISMATCH",
        severity: "MEDIUM",
        entityType: "ResultSubmission",
        entityId: submission.id,
        explanation: `The device location captured at submission is ${distanceKm.toFixed(
          1
        )} km from the polling center's registered location. Requires verification.`,
        evidence: { distanceKm, thresholdKm: INTEGRITY_THRESHOLDS.gpsMismatchKm },
      });
    }
  }

  // 7. HIGH_REJECTED_BALLOT_RATE
  const rejectedRate = rejectedBallotRate(submission.rejectedBallots, submission.votesCast);
  if (rejectedRate > INTEGRITY_THRESHOLDS.highRejectedBallotRate) {
    await flag({
      rule: "HIGH_REJECTED_BALLOT_RATE",
      severity: rejectedRate > 0.15 ? "HIGH" : "MEDIUM",
      entityType: "ResultSubmission",
      entityId: submission.id,
      explanation: `Rejected ballots are ${(rejectedRate * 100).toFixed(
        1
      )}% of votes cast, above the ${(INTEGRITY_THRESHOLDS.highRejectedBallotRate * 100).toFixed(0)}% threshold. Unusual statistical pattern.`,
      evidence: { rejectedRate, rejectedBallots: submission.rejectedBallots, votesCast: submission.votesCast },
    });
  }

  // 8. UNUSUAL_TURNOUT_VARIANCE — compare against other reporting stations
  // in the same constituency.
  const constituencyId = center.unit.parentId;
  if (constituencyId) {
    const peers = await db.resultSubmission.findMany({
      where: {
        electionId: submission.electionId,
        positionId: submission.positionId,
        id: { not: submission.id },
        status: { notIn: ["CORRECTED", "VALIDATION_FAILED", "DRAFT"] },
        pollingStation: { pollingCenter: { unit: { parentId: constituencyId } } },
      },
      select: { votesCast: true, registeredVoters: true },
    });
    if (peers.length >= 2) {
      const peerAvgTurnout =
        peers.reduce((sum, p) => sum + turnoutPct(p.votesCast, p.registeredVoters), 0) / peers.length;
      const thisTurnout = turnoutPct(submission.votesCast, submission.registeredVoters);
      const variance = Math.abs(thisTurnout - peerAvgTurnout);
      if (variance > INTEGRITY_THRESHOLDS.turnoutVariancePct) {
        await flag({
          rule: "UNUSUAL_TURNOUT_VARIANCE",
          severity: "MEDIUM",
          entityType: "ResultSubmission",
          entityId: submission.id,
          explanation: `This station's turnout (${thisTurnout.toFixed(
            1
          )}%) differs from its constituency's average (${peerAvgTurnout.toFixed(
            1
          )}%, from ${peers.length} other reporting stations) by more than ${INTEGRITY_THRESHOLDS.turnoutVariancePct} points. Unusual statistical pattern, not a determination of error.`,
          evidence: { thisTurnout, peerAvgTurnout, peerCount: peers.length },
        });
      }
    }
  }

  // 9. MULTIPLE_SUBMISSIONS
  const versionCount = await db.resultSubmission.count({
    where: {
      electionId: submission.electionId,
      positionId: submission.positionId,
      pollingStationId: submission.pollingStationId,
    },
  });
  if (versionCount > INTEGRITY_THRESHOLDS.maxNormalVersions) {
    await flag({
      rule: "MULTIPLE_SUBMISSIONS",
      severity: "LOW",
      entityType: "PollingStation",
      entityId: submission.pollingStationId,
      explanation: `This polling station's result for this position has been submitted or corrected ${versionCount} times, more than the usual pattern.`,
      evidence: { versionCount, positionId: submission.positionId },
    });
  }

  // 10. LATE_CORRECTION — this submission corrects a version that had
  // already been approved or published.
  if (submission.previousVersionId) {
    const previous = await db.resultSubmission.findUnique({
      where: { id: submission.previousVersionId },
      select: { status: true, approvedAt: true, publishedAt: true },
    });
    if (previous && (previous.status === "APPROVED" || previous.status === "PUBLISHED" || previous.publishedAt)) {
      await flag({
        rule: "LATE_CORRECTION",
        severity: "HIGH",
        entityType: "ResultSubmission",
        entityId: submission.id,
        explanation:
          "This correction replaces a version that had already been approved or published. Requires verification before the new version proceeds.",
        evidence: { previousStatus: previous.status, previousApprovedAt: previous.approvedAt, previousPublishedAt: previous.publishedAt },
      });
    }
  }

  return { alertsCreated };
}
