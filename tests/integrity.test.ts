import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { haversineDistanceKm, rejectedBallotRate, turnoutPct } from "@/lib/integrity/rules";
import { scanSubmission } from "@/lib/integrity/scan";

describe("Integrity rules — pure helpers", () => {
  it("computes zero distance for identical points", () => {
    expect(haversineDistanceKm(-1.0, 36.0, -1.0, 36.0)).toBeCloseTo(0, 5);
  });

  it("computes a plausible distance between two known points", () => {
    // Nairobi to Mombasa, Kenya — roughly 440km as the crow flies.
    const km = haversineDistanceKm(-1.2921, 36.8219, -4.0435, 39.6682);
    expect(km).toBeGreaterThan(400);
    expect(km).toBeLessThan(480);
  });

  it("computes rejected ballot rate safely, including zero votes cast", () => {
    expect(rejectedBallotRate(10, 100)).toBeCloseTo(0.1);
    expect(rejectedBallotRate(0, 0)).toBe(0);
  });

  it("computes turnout percentage safely, including zero registered voters", () => {
    expect(turnoutPct(50, 100)).toBe(50);
    expect(turnoutPct(50, 0)).toBe(0);
  });
});

describe("Integrity scan — live against real seeded data", () => {
  const createdSubmissionIds: string[] = [];

  afterAll(async () => {
    await db.integrityAlert.deleteMany({ where: { entityId: { in: createdSubmissionIds } } });
    await db.resultSubmission.deleteMany({ where: { id: { in: createdSubmissionIds } } });
  });

  it("flags HIGH_REJECTED_BALLOT_RATE for a submission with an unusually high rejection rate", async () => {
    const election = await db.election.findFirstOrThrow();
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: election.id, name: "President" },
    });
    const station = await db.pollingStation.findFirstOrThrow({ skip: 5 });
    const candidates = await db.candidate.findMany({ where: { positionId: position.id }, take: 1 });

    const submission = await db.resultSubmission.create({
      data: {
        electionId: election.id,
        positionId: position.id,
        pollingStationId: station.id,
        version: 9201,
        status: "AWAITING_REVIEW",
        registeredVoters: 1000,
        ballotsIssued: 900,
        votesCast: 900,
        validVotes: 700,
        rejectedBallots: 200, // ~22% rejection rate — well above the 5% threshold
        submittedAt: new Date(),
        candidateResults: { create: [{ candidateId: candidates[0].id, votes: 700 }] },
      },
    });
    createdSubmissionIds.push(submission.id);

    const { alertsCreated } = await scanSubmission(submission.id);
    expect(alertsCreated).toBeGreaterThan(0);

    const alert = await db.integrityAlert.findFirst({
      where: { rule: "HIGH_REJECTED_BALLOT_RATE", entityId: submission.id },
    });
    expect(alert).not.toBeNull();
    expect(alert?.status).toBe("OPEN");
    expect(alert?.severity).toBe("HIGH"); // 22% is above the 15% escalation threshold too
  });

  it("does not create a duplicate alert for the same condition on a second scan", async () => {
    const election = await db.election.findFirstOrThrow();
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: election.id, name: "President" },
    });
    const station = await db.pollingStation.findFirstOrThrow({ skip: 6 });
    const candidates = await db.candidate.findMany({ where: { positionId: position.id }, take: 1 });

    const submission = await db.resultSubmission.create({
      data: {
        electionId: election.id,
        positionId: position.id,
        pollingStationId: station.id,
        version: 9202,
        status: "AWAITING_REVIEW",
        registeredVoters: 1000,
        ballotsIssued: 900,
        votesCast: 900,
        validVotes: 750,
        rejectedBallots: 150, // 16.7% — above threshold
        submittedAt: new Date(),
        candidateResults: { create: [{ candidateId: candidates[0].id, votes: 750 }] },
      },
    });
    createdSubmissionIds.push(submission.id);

    const first = await scanSubmission(submission.id);
    const second = await scanSubmission(submission.id);

    expect(first.alertsCreated).toBeGreaterThan(0);
    expect(second.alertsCreated).toBe(0);

    const alerts = await db.integrityAlert.findMany({
      where: { rule: "HIGH_REJECTED_BALLOT_RATE", entityId: submission.id },
    });
    expect(alerts).toHaveLength(1);
  });

  it("flags MISSING_RESULT_DOCUMENT for a verified result with no evidence attached", async () => {
    const election = await db.election.findFirstOrThrow();
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: election.id, name: "President" },
    });
    const station = await db.pollingStation.findFirstOrThrow({ skip: 7 });
    const candidates = await db.candidate.findMany({ where: { positionId: position.id }, take: 1 });

    const submission = await db.resultSubmission.create({
      data: {
        electionId: election.id,
        positionId: position.id,
        pollingStationId: station.id,
        version: 9203,
        status: "VERIFIED",
        registeredVoters: 1000,
        ballotsIssued: 800,
        votesCast: 780,
        validVotes: 780,
        rejectedBallots: 0,
        submittedAt: new Date(),
        verifiedAt: new Date(),
        candidateResults: { create: [{ candidateId: candidates[0].id, votes: 780 }] },
      },
    });
    createdSubmissionIds.push(submission.id);

    await scanSubmission(submission.id);

    const alert = await db.integrityAlert.findFirst({
      where: { rule: "MISSING_RESULT_DOCUMENT", entityId: submission.id },
    });
    expect(alert).not.toBeNull();
  });
});
