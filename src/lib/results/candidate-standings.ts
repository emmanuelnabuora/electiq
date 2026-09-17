import { db } from "@/lib/db";

export type CandidateStanding = {
  candidateId: string;
  fullName: string;
  partyAbbreviation: string | null;
  photoUrl: string | null;
  votes: number;
  sharePct: number;
};

/**
 * Live candidate standings for a position, computed from "current"
 * submissions (same definition as getResultsAggregate: excludes CORRECTED
 * and VALIDATION_FAILED rows). This is deliberately not restricted to
 * PUBLISHED results — an operational Command Center needs to show the
 * picture as it's coming in, the way election-night coverage shows
 * unofficial/live tallies before certification. The UI that renders this
 * must label it as provisional, never as an official result (Section 2:
 * never let analytics imply more certainty than the data supports).
 */
export async function getCandidateStandings(
  electionId: string,
  positionId: string
): Promise<CandidateStanding[]> {
  const candidates = await db.candidate.findMany({
    where: { electionId, positionId },
    include: { party: true },
  });

  const results = await db.candidateResult.findMany({
    where: {
      candidateId: { in: candidates.map((c) => c.id) },
      submission: { status: { notIn: ["CORRECTED", "VALIDATION_FAILED", "DRAFT"] } },
    },
    select: { candidateId: true, votes: true },
  });

  const votesByCandidate = new Map<string, number>();
  for (const r of results) {
    votesByCandidate.set(r.candidateId, (votesByCandidate.get(r.candidateId) ?? 0) + r.votes);
  }

  const totalVotes = [...votesByCandidate.values()].reduce((a, b) => a + b, 0);

  return candidates
    .map((c) => {
      const votes = votesByCandidate.get(c.id) ?? 0;
      return {
        candidateId: c.id,
        fullName: c.fullName,
        partyAbbreviation: c.party?.abbreviation ?? null,
        photoUrl: c.photoUrl,
        votes,
        sharePct: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
      };
    })
    .sort((a, b) => b.votes - a.votes);
}
