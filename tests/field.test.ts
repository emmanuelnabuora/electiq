import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { loadOwnAssignment, getWardUnitIdForIncident } from "@/lib/field/scope";

describe("Field Operations — assignment-based scoping", () => {
  const createdIncidentIds: string[] = [];
  afterAll(async () => {
    await db.incident.deleteMany({ where: { id: { in: createdIncidentIds } } });
  });

  it("loadOwnAssignment returns null when the assignment belongs to a different user", async () => {
    const observerUser = await db.user.findUniqueOrThrow({ where: { email: "observer@electiq.example" } });
    const otherUser = await db.user.findUniqueOrThrow({ where: { email: "polling.officer@electiq.example" } });

    const observer = await db.observer.findUniqueOrThrow({ where: { userId: observerUser.id } });
    const assignment = await db.observerAssignment.findFirstOrThrow({ where: { observerId: observer.id } });

    const ownResult = await loadOwnAssignment(observerUser.id, assignment.id);
    const otherResult = await loadOwnAssignment(otherUser.id, assignment.id);

    expect(ownResult).not.toBeNull();
    expect(ownResult?.id).toBe(assignment.id);
    expect(otherResult).toBeNull();
  });

  it("loadOwnAssignment returns null for a user with no Observer profile at all", async () => {
    const commissioner = await db.user.findUniqueOrThrow({ where: { email: "commissioner@electiq.example" } });
    const observerUser = await db.user.findUniqueOrThrow({ where: { email: "observer@electiq.example" } });
    const observer = await db.observer.findUniqueOrThrow({ where: { userId: observerUser.id } });
    const assignment = await db.observerAssignment.findFirstOrThrow({ where: { observerId: observer.id } });

    const result = await loadOwnAssignment(commissioner.id, assignment.id);
    expect(result).toBeNull();
  });

  it("getWardUnitIdForIncident resolves the correct ward for a station-specific incident, and null for a national one", async () => {
    const election = await db.election.findFirstOrThrow();
    const station = await db.pollingStation.findFirstOrThrow({ include: { pollingCenter: true } });

    const stationIncident = await db.incident.create({
      data: { electionId: election.id, title: "Test", description: "Test", severity: "LOW", pollingStationId: station.id },
    });
    const nationalIncident = await db.incident.create({
      data: { electionId: election.id, title: "Test national", description: "Test", severity: "LOW" },
    });
    createdIncidentIds.push(stationIncident.id, nationalIncident.id);

    const wardUnitId = await getWardUnitIdForIncident(stationIncident.id);
    const nationalUnitId = await getWardUnitIdForIncident(nationalIncident.id);

    expect(wardUnitId).toBe(station.pollingCenter.unitId);
    expect(nationalUnitId).toBeNull();
  });
});
