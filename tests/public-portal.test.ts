import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  getPublicElection,
  getPublicCandidateStandings,
  getPublicRegionalResults,
  getPublicUpdates,
  getPublicElectionSummary,
  searchPublicUnits,
} from "@/lib/public/queries";
import { checkRateLimit } from "@/lib/public/rate-limit";

const ELECTION_ID = "seed-karibu-general-2026";

describe("Public Portal — never exposes unpublished data (Section 31)", () => {
  const createdIds: string[] = [];
  afterAll(async () => {
    await db.resultSubmission.deleteMany({ where: { id: { in: createdIds } } });
  });

  const NON_PUBLISHED_STATUSES = [
    "DRAFT",
    "SUBMITTED",
    "VALIDATION_FAILED",
    "AWAITING_REVIEW",
    "VERIFIED",
    "FLAGGED",
    "DISPUTED",
    "CORRECTED",
    "APPROVED",
  ] as const;

  it.each(NON_PUBLISHED_STATUSES)(
    "a %s submission never affects candidate standings, regional results, or the updates feed",
    async (status) => {
      const position = await db.electionPosition.findFirstOrThrow({
        where: { electionId: ELECTION_ID, name: "President" },
      });
      const candidate = await db.candidate.findFirstOrThrow({ where: { positionId: position.id } });
      const station = await db.pollingStation.findFirstOrThrow({
        skip: 20 + NON_PUBLISHED_STATUSES.indexOf(status),
        include: { pollingCenter: { include: { unit: { include: { parent: { include: { parent: true } } } } } } },
      });
      const regionName = station.pollingCenter.unit.parent?.parent?.name;

      const [standingsBefore, regionsBefore, updatesBefore] = await Promise.all([
        getPublicCandidateStandings(ELECTION_ID, "President"),
        getPublicRegionalResults(ELECTION_ID, "President", 0),
        getPublicUpdates(ELECTION_ID, "President"),
      ]);
      const beforeVotes = standingsBefore.find((s) => s.fullName === candidate.fullName)?.votes ?? 0;
      const beforeRegion = regionsBefore.find((r) => r.unitName === regionName);
      const beforeUpdateCount = updatesBefore.length;

      const submission = await db.resultSubmission.create({
        data: {
          electionId: ELECTION_ID,
          positionId: position.id,
          pollingStationId: station.id,
          version: 9400 + NON_PUBLISHED_STATUSES.indexOf(status),
          status,
          registeredVoters: 777777,
          ballotsIssued: 777777,
          votesCast: 777777,
          validVotes: 777777,
          rejectedBallots: 0,
          // publishedAt intentionally left unset -- a real PUBLISHED row
          // always has this, and getPublicUpdates filters on it too, so
          // this also proves that guard independently of `status` itself.
          candidateResults: { create: [{ candidateId: candidate.id, votes: 777777 }] },
        },
      });
      createdIds.push(submission.id);

      const [standingsAfter, regionsAfter, updatesAfter] = await Promise.all([
        getPublicCandidateStandings(ELECTION_ID, "President"),
        getPublicRegionalResults(ELECTION_ID, "President", 0),
        getPublicUpdates(ELECTION_ID, "President"),
      ]);
      const afterVotes = standingsAfter.find((s) => s.fullName === candidate.fullName)?.votes ?? 0;
      const afterRegion = regionsAfter.find((r) => r.unitName === regionName);

      expect(afterVotes).toBe(beforeVotes);
      expect(afterRegion?.votesCast ?? 0).toBe(beforeRegion?.votesCast ?? 0);
      expect(afterRegion?.publishedStations ?? 0).toBe(beforeRegion?.publishedStations ?? 0);
      expect(updatesAfter.length).toBe(beforeUpdateCount);
    }
  );

  it("getPublicCandidateStandings includes a PUBLISHED submission's votes", async () => {
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: ELECTION_ID, name: "President" },
    });
    const candidate = await db.candidate.findFirstOrThrow({ where: { positionId: position.id } });
    const station = await db.pollingStation.findFirstOrThrow({ skip: 11 });

    const before = await getPublicCandidateStandings(ELECTION_ID, "President");
    const beforeVotes = before.find((s) => s.fullName === candidate.fullName)?.votes ?? 0;

    const submission = await db.resultSubmission.create({
      data: {
        electionId: ELECTION_ID,
        positionId: position.id,
        pollingStationId: station.id,
        version: 9302,
        status: "PUBLISHED",
        registeredVoters: 500,
        ballotsIssued: 400,
        votesCast: 400,
        validVotes: 400,
        rejectedBallots: 0,
        publishedAt: new Date(),
        candidateResults: { create: [{ candidateId: candidate.id, votes: 400 }] },
      },
    });
    createdIds.push(submission.id);

    const after = await getPublicCandidateStandings(ELECTION_ID, "President");
    const afterVotes = after.find((s) => s.fullName === candidate.fullName)?.votes ?? 0;

    expect(afterVotes).toBe(beforeVotes + 400);
  });

  it("getPublicElectionSummary excludes a non-published submission from its KPI totals", async () => {
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: ELECTION_ID, name: "President" },
    });
    // Deliberately pick a station with NO existing submission at all
    // (not just skip an arbitrary offset) -- otherwise this test could
    // land on a station that's already reporting, where the function
    // correctly declines to also double-count it as "pending".
    const stationWithNoSubmission = await db.pollingStation.findFirstOrThrow({
      where: { resultSubmissions: { none: { electionId: ELECTION_ID, positionId: position.id } } },
    });

    const before = await getPublicElectionSummary(ELECTION_ID, "President");

    const submission = await db.resultSubmission.create({
      data: {
        electionId: ELECTION_ID,
        positionId: position.id,
        pollingStationId: stationWithNoSubmission.id,
        version: 9410,
        status: "AWAITING_REVIEW",
        registeredVoters: 888888,
        ballotsIssued: 888888,
        votesCast: 888888,
        validVotes: 888888,
        rejectedBallots: 0,
      },
    });
    createdIds.push(submission.id);

    const after = await getPublicElectionSummary(ELECTION_ID, "President");
    expect(after.totalValidVotes).toBe(before.totalValidVotes);
    expect(after.reportingPollingStations).toBe(before.reportingPollingStations);
    // The station now shows up as "pending" (a bare count, not its
    // content) rather than silently vanishing or being miscounted as
    // reporting.
    expect(after.pendingPollingStations).toBe(before.pendingPollingStations + 1);
    expect(after.totalPollingStations).toBe(before.totalPollingStations);
  });

  it("searchPublicUnits never returns vote counts, turnout, or any result-shaped field", async () => {
    const results = await searchPublicUnits(ELECTION_ID, "a");
    for (const r of results) {
      expect(r).not.toHaveProperty("votes");
      expect(r).not.toHaveProperty("turnoutPct");
      expect(r).not.toHaveProperty("registeredVoters");
      expect(Object.keys(r).sort()).toEqual(["id", "kind", "name", "parentName"].sort());
    }
  });

  it("getPublicUpdates never returns submitter/verifier/approver identity or evidence fields", async () => {
    const updates = await getPublicUpdates(ELECTION_ID, "President");
    for (const u of updates) {
      expect(Object.keys(u).sort()).toEqual(
        ["stationCode", "unitName", "constituencyName", "countyName", "turnoutPct", "publishedAt"].sort()
      );
    }
  });

  it("getPublicRegionalResults never counts a VERIFIED (not yet published) submission", async () => {
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: ELECTION_ID, name: "President" },
    });
    const station = await db.pollingStation.findFirstOrThrow({
      skip: 12,
      include: { pollingCenter: { include: { unit: { include: { parent: { include: { parent: true } } } } } } },
    });
    const regionName = station.pollingCenter.unit.parent?.parent?.name;

    const before = await getPublicRegionalResults(ELECTION_ID, "President", 0);
    const beforeRegion = before.find((r) => r.unitName === regionName);

    const submission = await db.resultSubmission.create({
      data: {
        electionId: ELECTION_ID,
        positionId: position.id,
        pollingStationId: station.id,
        version: 9303,
        status: "VERIFIED",
        registeredVoters: 12345,
        ballotsIssued: 12000,
        votesCast: 12000,
        validVotes: 12000,
        rejectedBallots: 0,
      },
    });
    createdIds.push(submission.id);

    const after = await getPublicRegionalResults(ELECTION_ID, "President", 0);
    const afterRegion = after.find((r) => r.unitName === regionName);

    expect(afterRegion?.votesCast).toBe(beforeRegion?.votesCast ?? 0);
    expect(afterRegion?.publishedStations).toBe(beforeRegion?.publishedStations ?? 0);
  });

  it("getPublicUpdates only ever returns PUBLISHED submissions", async () => {
    const updates = await getPublicUpdates(ELECTION_ID, "President");
    for (const u of updates) {
      const station = await db.pollingStation.findUniqueOrThrow({ where: { code: u.stationCode } });
      const submission = await db.resultSubmission.findFirst({
        where: { electionId: ELECTION_ID, pollingStationId: station.id, status: "PUBLISHED" },
      });
      expect(submission).not.toBeNull();
    }
  });

  it("getPublicElection exposes only safe configuration fields", async () => {
    const election = await getPublicElection(ELECTION_ID);
    expect(election).not.toBeNull();
    expect(election!.name).toBe("Election Management System General Election 2026");
    expect(Array.isArray(election!.positions)).toBe(true);
    expect(Array.isArray(election!.parties)).toBe(true);
    expect(election).not.toHaveProperty("countryId");
  });
});

describe("Public API rate limiter", () => {
  it("allows requests under the limit and blocks once exceeded", () => {
    const key = `test-client-${Date.now()}`;
    let lastResult;
    for (let i = 0; i < 30; i++) {
      lastResult = checkRateLimit(key);
      expect(lastResult.allowed).toBe(true);
    }
    const blocked = checkRateLimit(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks separate clients independently", () => {
    const keyA = `client-a-${Date.now()}`;
    const keyB = `client-b-${Date.now()}`;
    for (let i = 0; i < 30; i++) checkRateLimit(keyA);
    const blockedA = checkRateLimit(keyA);
    const allowedB = checkRateLimit(keyB);
    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });
});
