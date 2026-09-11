import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getCandidateStandings } from "@/lib/results/candidate-standings";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import { getReportingTrend } from "@/lib/results/reporting-trend";

describe("Live Command Center — candidate standings", () => {
  const createdIds: string[] = [];
  afterAll(async () => {
    await db.resultSubmission.deleteMany({ where: { id: { in: createdIds } } });
  });

  it("sums votes per candidate across current submissions and computes vote share", async () => {
    const election = await db.election.findFirstOrThrow();
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: election.id, name: "President" },
    });
    const candidates = await db.candidate.findMany({ where: { positionId: position.id }, take: 2 });
    const station = await db.pollingStation.findFirstOrThrow({ skip: 2 });

    const before = await getCandidateStandings(election.id, position.id);
    const beforeVotes = new Map(before.map((s) => [s.candidateId, s.votes]));

    const submission = await db.resultSubmission.create({
      data: {
        electionId: election.id,
        positionId: position.id,
        pollingStationId: station.id,
        version: 9101,
        status: "VERIFIED",
        registeredVoters: 500,
        ballotsIssued: 400,
        votesCast: 400,
        validVotes: 400,
        rejectedBallots: 0,
        candidateResults: {
          create: [
            { candidateId: candidates[0].id, votes: 300 },
            { candidateId: candidates[1].id, votes: 100 },
          ],
        },
      },
    });
    createdIds.push(submission.id);

    const after = await getCandidateStandings(election.id, position.id);
    const c0 = after.find((s) => s.candidateId === candidates[0].id)!;
    const c1 = after.find((s) => s.candidateId === candidates[1].id)!;

    expect(c0.votes).toBe((beforeVotes.get(candidates[0].id) ?? 0) + 300);
    expect(c1.votes).toBe((beforeVotes.get(candidates[1].id) ?? 0) + 100);
    // Standings are sorted descending by votes.
    expect(after[0].votes).toBeGreaterThanOrEqual(after[after.length - 1].votes);
    // Every candidate's share should sum to ~100% across all candidates.
    const totalShare = after.reduce((sum, s) => sum + s.sharePct, 0);
    expect(totalShare).toBeCloseTo(100, 0);
  });
});

describe("Live Command Center — geographic breakdown", () => {
  it("reporting percentage never exceeds 100 and matches station counts", async () => {
    const election = await db.election.findFirstOrThrow();
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: election.id, name: "President" },
    });

    const regional = await getGeographicBreakdown(election.id, position.id, 0);
    expect(regional.length).toBeGreaterThan(0);
    for (const row of regional) {
      expect(row.reportingStations).toBeLessThanOrEqual(row.totalStations);
      expect(row.reportingPct).toBeLessThanOrEqual(100);
      expect(row.reportingPct).toBeGreaterThanOrEqual(0);
    }

    const totalStationsAcrossRegions = regional.reduce((sum, r) => sum + r.totalStations, 0);
    const actualStationCount = await db.pollingStation.count();
    expect(totalStationsAcrossRegions).toBe(actualStationCount);
  });

  it("constituency-level rows sum to the same total station count as regions", async () => {
    const election = await db.election.findFirstOrThrow();
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: election.id, name: "President" },
    });

    const [regional, constituencies] = await Promise.all([
      getGeographicBreakdown(election.id, position.id, 0),
      getGeographicBreakdown(election.id, position.id, 1),
    ]);

    const regionTotal = regional.reduce((sum, r) => sum + r.totalStations, 0);
    const constituencyTotal = constituencies.reduce((sum, r) => sum + r.totalStations, 0);
    expect(constituencyTotal).toBe(regionTotal);
  });
});

describe("Live Command Center — reporting trend", () => {
  it("produces a monotonically non-decreasing cumulative series from real timestamps", async () => {
    const election = await db.election.findFirstOrThrow();
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: election.id, name: "President" },
    });

    const trend = await getReportingTrend(election.id, position.id);
    for (let i = 1; i < trend.length; i++) {
      expect(trend[i].cumulativeStations).toBeGreaterThanOrEqual(trend[i - 1].cumulativeStations);
      expect(new Date(trend[i].time).getTime()).toBeGreaterThanOrEqual(new Date(trend[i - 1].time).getTime());
    }
  });
});
