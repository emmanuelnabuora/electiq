import { db } from "@/lib/db";

export type RemainingReportProjection = {
  reportingStations: number;
  totalStations: number;
  reportedVotesCast: number;
  projectedAdditionalVotes: number;
  projectedTotalVotesCast: number;
  candidates: Array<{
    name: string;
    partyAbbreviation: string | null;
    currentVotes: number;
    currentSharePct: number;
    projectedVotes: number;
    projectedSharePct: number;
  }>;
};

/**
 * MODEL ESTIMATE — NOT OFFICIAL RESULT.
 *
 * Projects a final total by assuming unreported polling stations turn out
 * at the same rate, and split their vote the same way, as stations that
 * have already reported. This is the single biggest assumption a
 * "remaining count" projection can make — see the confidence note
 * returned alongside this in src/lib/actions/scenarios.ts — and it will
 * be visibly wrong if the unreported stations are concentrated in areas
 * that lean differently than the national average.
 */
export async function getRemainingReportProjection(
  electionId: string,
  positionName: string
): Promise<RemainingReportProjection> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  const totalStations = await db.pollingStation.count();

  if (!position) {
    return {
      reportingStations: 0,
      totalStations,
      reportedVotesCast: 0,
      projectedAdditionalVotes: 0,
      projectedTotalVotesCast: 0,
      candidates: [],
    };
  }

  const current = await db.resultSubmission.findMany({
    where: { electionId, positionId: position.id, status: { notIn: ["CORRECTED", "VALIDATION_FAILED", "DRAFT"] } },
    include: { candidateResults: { include: { candidate: { include: { party: true } } } } },
  });

  const reportedRegisteredVoters = current.reduce((sum, r) => sum + r.registeredVoters, 0);
  const reportedVotesCast = current.reduce((sum, r) => sum + r.votesCast, 0);
  // Candidate votes sum to valid votes, not votes cast — rejected ballots
  // have no candidate attribution. Shares must be computed against valid
  // votes or they'd never reach 100% (short by exactly the rejected-ballot
  // rate). Kept separate from projectedTotalVotesCast, which is a
  // participation/turnout figure and correctly includes rejected ballots.
  const reportedValidVotes = current.reduce((sum, r) => sum + r.validVotes, 0);
  const avgTurnoutRate = reportedRegisteredVoters > 0 ? reportedVotesCast / reportedRegisteredVoters : 0;
  const validVoteRatio = reportedVotesCast > 0 ? reportedValidVotes / reportedVotesCast : 1;

  const totalRegisteredVoters = (await db.pollingStation.aggregate({ _sum: { registeredVoters: true } }))._sum
    .registeredVoters ?? 0;
  const unreportedRegisteredVoters = Math.max(0, totalRegisteredVoters - reportedRegisteredVoters);
  const projectedAdditionalVotes = Math.round(unreportedRegisteredVoters * avgTurnoutRate);
  const projectedTotalVotesCast = reportedVotesCast + projectedAdditionalVotes;
  // Assumes the current rejected-ballot rate continues into the unreported stations.
  const projectedTotalValidVotes = Math.round(projectedTotalVotesCast * validVoteRatio);

  const votesByCandidate = new Map<string, { name: string; party: string | null; votes: number }>();
  for (const submission of current) {
    for (const cr of submission.candidateResults) {
      const key = cr.candidateId;
      const existing = votesByCandidate.get(key);
      if (existing) {
        existing.votes += cr.votes;
      } else {
        votesByCandidate.set(key, {
          name: cr.candidate.fullName,
          party: cr.candidate.party?.abbreviation ?? null,
          votes: cr.votes,
        });
      }
    }
  }

  const candidates = [...votesByCandidate.values()].map((c) => {
    const currentSharePct = reportedValidVotes > 0 ? (c.votes / reportedValidVotes) * 100 : 0;
    const projectedVotes = Math.round((currentSharePct / 100) * projectedTotalValidVotes);
    return {
      name: c.name,
      partyAbbreviation: c.party,
      currentVotes: c.votes,
      currentSharePct,
      projectedVotes,
      projectedSharePct: projectedTotalValidVotes > 0 ? (projectedVotes / projectedTotalValidVotes) * 100 : 0,
    };
  });

  return {
    reportingStations: current.length,
    totalStations,
    reportedVotesCast,
    projectedAdditionalVotes,
    projectedTotalVotesCast,
    candidates: candidates.sort((a, b) => b.projectedVotes - a.projectedVotes),
  };
}
