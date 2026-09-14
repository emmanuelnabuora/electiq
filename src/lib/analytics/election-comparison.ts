import { db } from "@/lib/db";

export type ElectionSummary = {
  electionId: string;
  electionName: string;
  electionDate: string;
  status: string;
  reportingStations: number;
  totalStations: number;
  votesCast: number;
  registeredVoters: number;
  turnoutPct: number;
  partyShares: Array<{ partyAbbreviation: string; votes: number; sharePct: number }>;
};

async function summarizeElection(electionId: string, positionName: string): Promise<ElectionSummary> {
  const election = await db.election.findUniqueOrThrow({ where: { id: electionId } });
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  const totalStations = await db.pollingStation.count({
    where: { pollingCenter: { unit: { level: { countryId: election.countryId } } } },
  });

  if (!position) {
    return {
      electionId,
      electionName: election.name,
      electionDate: election.electionDate.toISOString(),
      status: election.status,
      reportingStations: 0,
      totalStations,
      votesCast: 0,
      registeredVoters: 0,
      turnoutPct: 0,
      partyShares: [],
    };
  }

  const current = await db.resultSubmission.findMany({
    where: { electionId, positionId: position.id, status: { notIn: ["CORRECTED", "VALIDATION_FAILED", "DRAFT"] } },
    include: { candidateResults: { include: { candidate: { include: { party: true } } } } },
  });

  const votesCast = current.reduce((sum, r) => sum + r.votesCast, 0);
  const registeredVoters = current.reduce((sum, r) => sum + r.registeredVoters, 0);

  const votesByParty = new Map<string, number>();
  for (const submission of current) {
    for (const cr of submission.candidateResults) {
      const key = cr.candidate.party?.abbreviation ?? "Independent";
      votesByParty.set(key, (votesByParty.get(key) ?? 0) + cr.votes);
    }
  }
  const totalPartyVotes = [...votesByParty.values()].reduce((a, b) => a + b, 0);
  const partyShares = [...votesByParty.entries()]
    .map(([partyAbbreviation, votes]) => ({
      partyAbbreviation,
      votes,
      sharePct: totalPartyVotes > 0 ? (votes / totalPartyVotes) * 100 : 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  return {
    electionId,
    electionName: election.name,
    electionDate: election.electionDate.toISOString(),
    status: election.status,
    reportingStations: current.length,
    totalStations,
    votesCast,
    registeredVoters,
    turnoutPct: registeredVoters > 0 ? (votesCast / registeredVoters) * 100 : 0,
    partyShares,
  };
}

export type ElectionComparison = {
  electionA: ElectionSummary;
  electionB: ElectionSummary;
  turnoutDeltaPct: number;
  partyShareDeltas: Array<{ partyAbbreviation: string; sharePctA: number; sharePctB: number; deltaPct: number }>;
};

/**
 * Compares two elections' turnout and party vote share for a given
 * position. Parties are matched by abbreviation across elections — this
 * schema gives every election its own Party/Candidate rows even when they
 * represent the same real-world party, so matching is by name, not by ID.
 *
 * This is a descriptive comparison only. Section 8's "never imply
 * causation from correlation without supporting evidence" applies: a
 * turnout or share delta here describes what changed, not why.
 */
export async function compareElections(
  electionAId: string,
  electionBId: string,
  positionName: string
): Promise<ElectionComparison> {
  const [electionA, electionB] = await Promise.all([
    summarizeElection(electionAId, positionName),
    summarizeElection(electionBId, positionName),
  ]);

  const parties = new Set([
    ...electionA.partyShares.map((p) => p.partyAbbreviation),
    ...electionB.partyShares.map((p) => p.partyAbbreviation),
  ]);

  const partyShareDeltas = [...parties].map((partyAbbreviation) => {
    const sharePctA = electionA.partyShares.find((p) => p.partyAbbreviation === partyAbbreviation)?.sharePct ?? 0;
    const sharePctB = electionB.partyShares.find((p) => p.partyAbbreviation === partyAbbreviation)?.sharePct ?? 0;
    return { partyAbbreviation, sharePctA, sharePctB, deltaPct: sharePctB - sharePctA };
  });

  return {
    electionA,
    electionB,
    turnoutDeltaPct: electionB.turnoutPct - electionA.turnoutPct,
    partyShareDeltas: partyShareDeltas.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)),
  };
}
