import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { getWardUnitIdForPollingStation } from "@/lib/results/scope";

describe("Results aggregation (Section 12 — reporting/verification/publication are separate metrics)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    await db.resultSubmission.deleteMany({ where: { id: { in: createdIds } } });
  });

  it("counts only current (non-CORRECTED, non-VALIDATION_FAILED) submissions toward reporting", async () => {
    const election = await db.election.findFirstOrThrow();
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: election.id, name: "President" },
    });
    const station = await db.pollingStation.findFirstOrThrow();

    const before = await getResultsAggregate(election.id);

    const submission = await db.resultSubmission.create({
      data: {
        electionId: election.id,
        positionId: position.id,
        pollingStationId: station.id,
        version: 9001, // well outside real version numbers to avoid unique clashes
        status: "AWAITING_REVIEW",
        registeredVoters: 1000,
        ballotsIssued: 800,
        votesCast: 750,
        validVotes: 750,
        rejectedBallots: 0,
      },
    });
    createdIds.push(submission.id);

    const afterSubmit = await getResultsAggregate(election.id);
    expect(afterSubmit.reportingStations).toBe(before.reportingStations + 1);
    expect(afterSubmit.votesCast).toBe(before.votesCast + 750);

    // Correcting it (marking CORRECTED) must remove it from the live count again.
    await db.resultSubmission.update({ where: { id: submission.id }, data: { status: "CORRECTED" } });
    const afterCorrection = await getResultsAggregate(election.id);
    expect(afterCorrection.reportingStations).toBe(before.reportingStations);
    expect(afterCorrection.votesCast).toBe(before.votesCast);
  });

  it("a VALIDATION_FAILED submission never counts toward votes cast", async () => {
    const election = await db.election.findFirstOrThrow();
    const position = await db.electionPosition.findFirstOrThrow({
      where: { electionId: election.id, name: "President" },
    });
    const station = await db.pollingStation.findFirstOrThrow({ skip: 1 });

    const before = await getResultsAggregate(election.id);

    const submission = await db.resultSubmission.create({
      data: {
        electionId: election.id,
        positionId: position.id,
        pollingStationId: station.id,
        version: 9002,
        status: "VALIDATION_FAILED",
        registeredVoters: 1000,
        ballotsIssued: 800,
        votesCast: 5000, // deliberately invalid, mirrors a real failed-validation row
        validVotes: 750,
        rejectedBallots: 0,
        validationErrors: ["Votes cast cannot exceed ballots issued"],
      },
    });
    createdIds.push(submission.id);

    const after = await getResultsAggregate(election.id);
    expect(after.reportingStations).toBe(before.reportingStations);
    expect(after.votesCast).toBe(before.votesCast);
  });
});

describe("Geographic scope resolution for results", () => {
  it("resolves a polling station's ward unit id correctly", async () => {
    const station = await db.pollingStation.findFirstOrThrow({
      include: { pollingCenter: true },
    });
    const wardUnitId = await getWardUnitIdForPollingStation(station.id);
    expect(wardUnitId).toBe(station.pollingCenter.unitId);
  });
});
