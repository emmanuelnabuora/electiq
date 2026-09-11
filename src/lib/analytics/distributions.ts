import { db } from "@/lib/db";

export type DistributionStats = {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  buckets: Array<{ label: string; count: number }>;
};

function computeStats(values: number[], bucketEdges: number[], bucketLabels: string[]): DistributionStats {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, median: 0, buckets: bucketLabels.map((label) => ({ label, count: 0 })) };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const buckets = bucketLabels.map((label, i) => {
    const lower = bucketEdges[i];
    const upper = bucketEdges[i + 1] ?? Infinity;
    const count = values.filter((v) => v >= lower && v < upper).length;
    return { label, count };
  });

  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    median,
    buckets,
  };
}

/** Distribution of rejected-ballot rate (%) across reporting polling stations, for one position. */
export async function getRejectedBallotDistribution(
  electionId: string,
  positionName: string
): Promise<DistributionStats> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) return computeStats([], [], []);

  const submissions = await db.resultSubmission.findMany({
    where: { electionId, positionId: position.id, status: { notIn: ["CORRECTED", "VALIDATION_FAILED", "DRAFT"] } },
    select: { rejectedBallots: true, votesCast: true },
  });

  const rates = submissions
    .filter((s) => s.votesCast > 0)
    .map((s) => (s.rejectedBallots / s.votesCast) * 100);

  return computeStats(rates, [0, 2, 4, 6, 8], ["0-2%", "2-4%", "4-6%", "6-8%", "8%+"]);
}

/** Distribution of turnout (%) across reporting polling stations, for one position. */
export async function getTurnoutDistribution(electionId: string, positionName: string): Promise<DistributionStats> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) return computeStats([], [], []);

  const submissions = await db.resultSubmission.findMany({
    where: { electionId, positionId: position.id, status: { notIn: ["CORRECTED", "VALIDATION_FAILED", "DRAFT"] } },
    select: { registeredVoters: true, votesCast: true },
  });

  const turnouts = submissions
    .filter((s) => s.registeredVoters > 0)
    .map((s) => (s.votesCast / s.registeredVoters) * 100);

  return computeStats(turnouts, [0, 50, 60, 70, 80], ["<50%", "50-60%", "60-70%", "70-80%", "80%+"]);
}
