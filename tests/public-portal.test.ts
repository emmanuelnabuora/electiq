import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  getPublicElection,
  getPublicCandidateStandings,
  getPublicRegionalResults,
  getPublicUpdates,
} from "@/lib/public/queries";
import { checkRateLimit } from "@/lib/public/rate-limit";

const ELECTION_ID = "seed-karibu-general-2026";

describe("Public Portal — never exposes unpublished data (Section 31)", () => {
  const createdIds: string[] = [];
  afterAll(async () => {
    await db.resultSubmission.deleteMany({ where: { id: { in: createdIds } } });
  });

  it("getPublicCandidateStandings excludes an AWAITING_REVIEW submission's votes entirely", async () => {
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: ELECTION_ID, name: "President" },
    });
    const candidate = await db.candidate.findFirstOrThrow({ where: { positionId: position.id } });
    const station = await db.pollingStation.findFirstOrThrow({ skip: 10 });

    const before = await getPublicCandidateStandings(ELECTION_ID, "President");
    const beforeVotes = before.find((s) => s.fullName === candidate.fullName)?.votes ?? 0;

    const submission = await db.resultSubmission.create({
      data: {
        electionId: ELECTION_ID,
        positionId: position.id,
        pollingStationId: station.id,
        version: 9301,
        status: "AWAITING_REVIEW",
        registeredVoters: 999999,
        ballotsIssued: 999999,
        votesCast: 999999,
        validVotes: 999999,
        rejectedBallots: 0,
        candidateResults: { create: [{ candidateId: candidate.id, votes: 999999 }] },
      },
    });
    createdIds.push(submission.id);

    const after = await getPublicCandidateStandings(ELECTION_ID, "President");
    const afterVotes = after.find((s) => s.fullName === candidate.fullName)?.votes ?? 0;

    expect(afterVotes).toBe(beforeVotes);
  });

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
