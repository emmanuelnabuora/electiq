import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { compareElections } from "@/lib/analytics/election-comparison";
import { getRegionalSwing } from "@/lib/analytics/regional-swing";
import { getCompetitiveness } from "@/lib/analytics/competitiveness";
import { getRejectedBallotDistribution, getTurnoutDistribution } from "@/lib/analytics/distributions";

async function getElectionIds() {
  const election2026 = await db.election.findUniqueOrThrow({ where: { id: "seed-karibu-general-2026" } });
  const election2021 = await db.election.findUniqueOrThrow({ where: { id: "seed-karibu-general-2021" } });
  return { election2026, election2021 };
}

describe("Election comparison (Section 8 — never imply causation from correlation)", () => {
  it("compares turnout and party vote share between two real elections", async () => {
    const { election2026, election2021 } = await getElectionIds();
    const comparison = await compareElections(election2021.id, election2026.id, "President");

    expect(comparison.electionA.electionName).toBe(election2021.name);
    expect(comparison.electionB.electionName).toBe(election2026.name);
    expect(comparison.electionA.reportingStations).toBeGreaterThan(0);
    expect(comparison.electionB.reportingStations).toBeGreaterThan(0);

    const totalA = comparison.electionA.partyShares.reduce((s, p) => s + p.sharePct, 0);
    const totalB = comparison.electionB.partyShares.reduce((s, p) => s + p.sharePct, 0);
    expect(totalA).toBeCloseTo(100, 0);
    expect(totalB).toBeCloseTo(100, 0);

    for (const delta of comparison.partyShareDeltas) {
      expect(delta.deltaPct).toBeCloseTo(delta.sharePctB - delta.sharePctA, 5);
    }
  });

  it("returns zeroed-out data for a position that doesn't exist, rather than throwing", async () => {
    const { election2026, election2021 } = await getElectionIds();
    const comparison = await compareElections(election2021.id, election2026.id, "Governor-General");
    expect(comparison.electionA.reportingStations).toBe(0);
    expect(comparison.electionA.partyShares).toEqual([]);
  });
});

describe("Regional swing", () => {
  it("computes a swing per region that equals shareB minus shareA", async () => {
    const { election2026, election2021 } = await getElectionIds();
    const swing = await getRegionalSwing(election2021.id, election2026.id, "President", "UFP", 0);

    expect(swing.length).toBeGreaterThan(0);
    for (const row of swing) {
      expect(row.swingPct).toBeCloseTo(row.sharePctB - row.sharePctA, 5);
    }

    const northern = swing.find((s) => s.unitName === "Northern Region");
    expect(northern).toBeDefined();
  });
});

describe("Competitiveness", () => {
  it("classifies margins into the correct bands and sorts closest races first", async () => {
    const { election2026 } = await getElectionIds();
    const rows = await getCompetitiveness(election2026.id, "President", 0);

    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].marginPct).toBeGreaterThanOrEqual(rows[i - 1].marginPct);
    }
    for (const row of rows) {
      if (row.marginPct >= 20) expect(row.classification).toBe("SAFE");
      else if (row.marginPct >= 10) expect(row.classification).toBe("LIKELY");
      else if (row.marginPct >= 3) expect(row.classification).toBe("COMPETITIVE");
      else expect(row.classification).toBe("TOSS_UP");
    }
  });
});

describe("Statistical distributions", () => {
  it("computes turnout distribution with min <= median <= max and buckets that sum to the reporting count", async () => {
    const { election2026 } = await getElectionIds();
    const dist = await getTurnoutDistribution(election2026.id, "President");

    expect(dist.count).toBeGreaterThan(0);
    expect(dist.min).toBeLessThanOrEqual(dist.median);
    expect(dist.median).toBeLessThanOrEqual(dist.max);

    const bucketTotal = dist.buckets.reduce((sum, b) => sum + b.count, 0);
    expect(bucketTotal).toBe(dist.count);
  });

  it("computes rejected ballot distribution consistently", async () => {
    const { election2026 } = await getElectionIds();
    const dist = await getRejectedBallotDistribution(election2026.id, "President");

    expect(dist.count).toBeGreaterThan(0);
    expect(dist.min).toBeGreaterThanOrEqual(0);
    const bucketTotal = dist.buckets.reduce((sum, b) => sum + b.count, 0);
    expect(bucketTotal).toBe(dist.count);
  });

  it("returns an empty, non-throwing result for a position with no submissions", async () => {
    const { election2026 } = await getElectionIds();
    const dist = await getTurnoutDistribution(election2026.id, "Nonexistent Position");
    expect(dist.count).toBe(0);
    expect(dist.buckets.every((b) => b.count === 0)).toBe(true);
  });
});
