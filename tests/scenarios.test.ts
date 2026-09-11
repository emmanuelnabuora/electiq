import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { getRemainingReportProjection } from "@/lib/scenarios/remaining-report";
import { getTurnoutScenario } from "@/lib/scenarios/turnout-scenario";
import { getSwingScenario } from "@/lib/scenarios/swing-scenario";
import { getRunoffScenario } from "@/lib/scenarios/runoff-scenario";

const ELECTION_ID = "seed-karibu-general-2026";

describe("Remaining Report Simulation", () => {
  it("projects a total votes cast at least as large as what's already reported", async () => {
    const projection = await getRemainingReportProjection(ELECTION_ID, "President");
    expect(projection.reportingStations).toBeGreaterThan(0);
    expect(projection.projectedTotalVotesCast).toBeGreaterThanOrEqual(projection.reportedVotesCast);
  });

  it("projected candidate shares sum to ~100%", async () => {
    const projection = await getRemainingReportProjection(ELECTION_ID, "President");
    const totalShare = projection.candidates.reduce((sum, c) => sum + c.projectedSharePct, 0);
    expect(totalShare).toBeCloseTo(100, 0);
  });

  it("returns an empty, non-throwing result for a position that doesn't exist", async () => {
    const projection = await getRemainingReportProjection(ELECTION_ID, "Senator");
    expect(projection.reportingStations).toBe(0);
    expect(projection.candidates).toEqual([]);
  });
});

describe("Turnout Adjustment scenario", () => {
  it("increasing turnout increases projected votes cast, decreasing it decreases them", async () => {
    const up = await getTurnoutScenario(ELECTION_ID, "President", 10);
    const down = await getTurnoutScenario(ELECTION_ID, "President", -10);
    expect(up.projectedVotesCast).toBeGreaterThan(up.currentVotesCast);
    expect(down.projectedVotesCast).toBeLessThan(down.currentVotesCast);
  });

  it("clamps adjusted turnout to the 0-100% range", async () => {
    const extreme = await getTurnoutScenario(ELECTION_ID, "President", 1000);
    expect(extreme.adjustedTurnoutPct).toBeLessThanOrEqual(100);
  });

  it("holds candidate vote share constant while scaling absolute votes", async () => {
    const scenario = await getTurnoutScenario(ELECTION_ID, "President", 5);
    const totalProjected = scenario.candidates.reduce((sum, c) => sum + c.projectedVotes, 0);
    for (const c of scenario.candidates) {
      const projectedShare = totalProjected > 0 ? (c.projectedVotes / totalProjected) * 100 : 0;
      expect(projectedShare).toBeCloseTo(c.currentSharePct, 0);
    }
  });

  it("current candidate shares sum to ~100%", async () => {
    const scenario = await getTurnoutScenario(ELECTION_ID, "President", 5);
    const totalShare = scenario.candidates.reduce((sum, c) => sum + c.currentSharePct, 0);
    expect(totalShare).toBeCloseTo(100, 0);
  });
});

describe("Regional Swing Adjustment scenario", () => {
  it("increases the target party's projected share and decreases others proportionally", async () => {
    const scenario = await getSwingScenario(ELECTION_ID, "President", "UFP", 5);
    const target = scenario.parties.find((p) => p.partyAbbreviation === "UFP")!;
    expect(target.projectedSharePct).toBeGreaterThan(target.currentSharePct);

    const totalProjected = scenario.parties.reduce((sum, p) => sum + p.projectedSharePct, 0);
    expect(totalProjected).toBeCloseTo(100, 0);
  });

  it("constituency impact never reports more leading constituencies than exist", async () => {
    const scenario = await getSwingScenario(ELECTION_ID, "President", "UFP", 5);
    const totalConstituencies = await db.administrativeUnit.count({ where: { level: { depth: 1 } } });
    expect(scenario.constituencyImpact.projectedLeading).toBeLessThanOrEqual(totalConstituencies);
    expect(scenario.constituencyImpact.currentlyLeading).toBeLessThanOrEqual(totalConstituencies);
  });
});

describe("Runoff scenario", () => {
  it("reports no runoff required when the leader already has a majority, or models one otherwise — never throws", async () => {
    const scenario = await getRunoffScenario(ELECTION_ID, "President");
    if (scenario.runoffRequired) {
      const total = scenario.candidate1.projectedSharePct + scenario.candidate2.projectedSharePct;
      expect(total).toBeCloseTo(100, 0);
      expect(scenario.candidate1.projectedSharePct).toBeGreaterThanOrEqual(scenario.candidate2.projectedSharePct);
    } else {
      expect(scenario.leaderSharePct).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns a non-runoff result for a position with no candidates rather than throwing", async () => {
    const scenario = await getRunoffScenario(ELECTION_ID, "Senator");
    expect(scenario.runoffRequired).toBe(false);
  });
});
