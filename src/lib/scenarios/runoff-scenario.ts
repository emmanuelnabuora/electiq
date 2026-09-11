import { db } from "@/lib/db";
import { getCandidateStandings } from "@/lib/results/candidate-standings";

export type RunoffScenarioResult =
  | { runoffRequired: false; leaderSharePct: number; leaderName: string }
  | {
      runoffRequired: true;
      candidate1: { name: string; partyAbbreviation: string | null; projectedVotes: number; projectedSharePct: number };
      candidate2: { name: string; partyAbbreviation: string | null; projectedVotes: number; projectedSharePct: number };
    };

/**
 * MODEL ESTIMATE — NOT OFFICIAL RESULT.
 *
 * If the current leader's vote share is below 50%, models a two-candidate
 * runoff by redistributing every eliminated candidate's votes to the top
 * two in proportion to the top two's current standing relative to each
 * other. This is a simplifying assumption, not a prediction of real
 * voter behavior: actual runoff voters' second-choice preferences —
 * shaped by endorsements, coalition politics, and who dropped out —
 * could differ substantially from a simple proportional split.
 */
export async function getRunoffScenario(electionId: string, positionName: string): Promise<RunoffScenarioResult> {
  const position = await db.electionPosition.findFirst({ where: { electionId, name: positionName } });
  if (!position) {
    return { runoffRequired: false, leaderSharePct: 0, leaderName: "" };
  }

  const standings = await getCandidateStandings(electionId, position.id);
  if (standings.length === 0) {
    return { runoffRequired: false, leaderSharePct: 0, leaderName: "" };
  }

  const [leader, runnerUp] = standings;
  if (leader.sharePct >= 50) {
    return { runoffRequired: false, leaderSharePct: leader.sharePct, leaderName: leader.fullName };
  }
  if (!runnerUp) {
    return { runoffRequired: false, leaderSharePct: leader.sharePct, leaderName: leader.fullName };
  }

  const eliminatedVotes = standings.slice(2).reduce((sum, c) => sum + c.votes, 0);
  const top2Total = leader.votes + runnerUp.votes;
  const leaderRedistributed = top2Total > 0 ? eliminatedVotes * (leader.votes / top2Total) : eliminatedVotes / 2;
  const runnerUpRedistributed = eliminatedVotes - leaderRedistributed;

  const candidate1Votes = Math.round(leader.votes + leaderRedistributed);
  const candidate2Votes = Math.round(runnerUp.votes + runnerUpRedistributed);
  const runoffTotal = candidate1Votes + candidate2Votes;

  return {
    runoffRequired: true,
    candidate1: {
      name: leader.fullName,
      partyAbbreviation: leader.partyAbbreviation,
      projectedVotes: candidate1Votes,
      projectedSharePct: runoffTotal > 0 ? (candidate1Votes / runoffTotal) * 100 : 0,
    },
    candidate2: {
      name: runnerUp.fullName,
      partyAbbreviation: runnerUp.partyAbbreviation,
      projectedVotes: candidate2Votes,
      projectedSharePct: runoffTotal > 0 ? (candidate2Votes / runoffTotal) * 100 : 0,
    },
  };
}
