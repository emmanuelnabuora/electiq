import { db } from "@/lib/db";

export type TurnoutScenarioResult = {
  currentTurnoutPct: number;
  adjustedTurnoutPct: number;
  currentVotesCast: number;
  projectedVotesCast: number;
  candidates: Array<{
    name: string;
    partyAbbreviation: string | null;
    currentSharePct: number;
    currentVotes: number;
    projectedVotes: number;
  }>;
};

/**
 * MODEL ESTIMATE — NOT OFFICIAL RESULT.
 *
 * Applies a uniform turnout change (in percentage points) to the
 * currently-reported registered voter base and holds every candidate's
 * vote share exactly constant. That last part is the assumption worth
 * naming out loud: real turnout swings very often favor some candidates
 * more than others (e.g. a late get-out-the-vote effort), which this
 * model cannot represent — it only shows what a share-neutral turnout
 * change would look like in isolation.
 */
export async function getTurnoutScenario(
  electionId: string,
  positionName: string,
  turnoutDeltaPct: number
): Promise<TurnoutScenarioResult> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) {
    return {
      currentTurnoutPct: 0,
      adjustedTurnoutPct: 0,
      currentVotesCast: 0,
      projectedVotesCast: 0,
      candidates: [],
    };
  }

  const current = await db.resultSubmission.findMany({
    where: { electionId, positionId: position.id, status: { notIn: ["CORRECTED", "VALIDATION_FAILED", "DRAFT"] } },
    include: { candidateResults: { include: { candidate: { include: { party: true } } } } },
  });

  const registeredVoters = current.reduce((sum, r) => sum + r.registeredVoters, 0);
  const currentVotesCast = current.reduce((sum, r) => sum + r.votesCast, 0);
  // Candidate votes sum to valid votes, not votes cast (rejected ballots
  // have no candidate attribution) — shares must use validVotes as the
  // denominator or they never reach 100%, short by the rejected-ballot rate.
  const currentValidVotes = current.reduce((sum, r) => sum + r.validVotes, 0);
  const currentTurnoutPct = registeredVoters > 0 ? (currentVotesCast / registeredVoters) * 100 : 0;
  const adjustedTurnoutPct = Math.min(100, Math.max(0, currentTurnoutPct + turnoutDeltaPct));
  const projectedVotesCast = Math.round(registeredVoters * (adjustedTurnoutPct / 100));
  const validVoteRatio = currentVotesCast > 0 ? currentValidVotes / currentVotesCast : 1;
  const projectedValidVotes = Math.round(projectedVotesCast * validVoteRatio);

  const votesByCandidate = new Map<string, { name: string; party: string | null; votes: number }>();
  for (const submission of current) {
    for (const cr of submission.candidateResults) {
      const existing = votesByCandidate.get(cr.candidateId);
      if (existing) existing.votes += cr.votes;
      else
        votesByCandidate.set(cr.candidateId, {
          name: cr.candidate.fullName,
          party: cr.candidate.party?.abbreviation ?? null,
          votes: cr.votes,
        });
    }
  }

  const candidates = [...votesByCandidate.values()].map((c) => {
    const currentSharePct = currentValidVotes > 0 ? (c.votes / currentValidVotes) * 100 : 0;
    return {
      name: c.name,
      partyAbbreviation: c.party,
      currentSharePct,
      currentVotes: c.votes,
      projectedVotes: Math.round((currentSharePct / 100) * projectedValidVotes),
    };
  });

  return {
    currentTurnoutPct,
    adjustedTurnoutPct,
    currentVotesCast,
    projectedVotesCast,
    candidates: candidates.sort((a, b) => b.projectedVotes - a.projectedVotes),
  };
}
