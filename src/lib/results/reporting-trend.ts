import { db } from "@/lib/db";

export type ReportingTrendPoint = {
  time: string; // ISO timestamp of this submission event
  cumulativeStations: number;
  cumulativeVotesCast: number;
};

/**
 * A genuine time series built from real `submittedAt` timestamps — not a
 * simulated or interpolated curve. Each point is an actual submission
 * event; "cumulative" values are running totals through that moment. Only
 * current (non-corrected, non-failed) submissions count, matching the
 * definition used everywhere else in this module — a correction removes
 * that submission's contribution to the running total, so this can
 * legitimately dip if a large station's result is corrected downward.
 */
export async function getReportingTrend(
  electionId: string,
  positionId: string
): Promise<ReportingTrendPoint[]> {
  const submissions = await db.resultSubmission.findMany({
    where: {
      electionId,
      positionId,
      status: { notIn: ["CORRECTED", "VALIDATION_FAILED", "DRAFT"] },
      submittedAt: { not: null },
    },
    select: { submittedAt: true, votesCast: true },
    orderBy: { submittedAt: "asc" },
  });

  let cumulativeStations = 0;
  let cumulativeVotesCast = 0;

  return submissions.map((s) => {
    cumulativeStations += 1;
    cumulativeVotesCast += s.votesCast;
    return {
      time: s.submittedAt!.toISOString(),
      cumulativeStations,
      cumulativeVotesCast,
    };
  });
}
