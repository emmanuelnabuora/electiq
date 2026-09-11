import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { resultsTool } from "@/lib/copilot/tools/results-tool";
import { turnoutTool } from "@/lib/copilot/tools/turnout-tool";
import { incidentTool } from "@/lib/copilot/tools/incident-tool";
import { integrityTool } from "@/lib/copilot/tools/integrity-tool";
import { auditTool } from "@/lib/copilot/tools/audit-tool";
import { electionSearchTool } from "@/lib/copilot/tools/election-search-tool";
import { reportTool } from "@/lib/copilot/tools/report-tool";

async function userIdByEmail(email: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return user.id;
}

describe("Copilot tools — never bypass RBAC (Section 30)", () => {
  it("ResultsTool denies a role without results.read", async () => {
    const mediaUserId = await userIdByEmail("media@electiq.example");
    const result = await resultsTool.execute(mediaUserId, { action: "status_summary" });
    expect(result.deniedReason).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("IncidentTool denies a role without incidents.read", async () => {
    const pollingOfficerId = await userIdByEmail("polling.officer@electiq.example");
    const result = await incidentTool.execute(pollingOfficerId, {});
    expect(result.deniedReason).toBeTruthy();
  });

  it("IntegrityTool denies a role without integrity.read", async () => {
    const pollingOfficerId = await userIdByEmail("polling.officer@electiq.example");
    const result = await integrityTool.execute(pollingOfficerId, {});
    expect(result.deniedReason).toBeTruthy();
  });

  it("AuditTool denies a role without audit.read", async () => {
    const observerId = await userIdByEmail("observer@electiq.example");
    const result = await auditTool.execute(observerId, {});
    expect(result.deniedReason).toBeTruthy();
  });

  it("ResultsTool grants a role with results.read", async () => {
    const analystId = await userIdByEmail("analyst@electiq.example");
    const result = await resultsTool.execute(analystId, { action: "status_summary" });
    expect(result.deniedReason).toBeUndefined();
    expect(Array.isArray(result.data)).toBe(true);
  });
});

describe("Copilot tools — geographic scoping matches RBAC scope", () => {
  it("TurnoutTool restricts a constituency-scoped user to their own constituency", async () => {
    const nationalId = await userIdByEmail("commissioner@electiq.example");
    const scopedId = await userIdByEmail("constituency.officer@electiq.example");

    // Constituency-level, not region-level: a constituency officer's scope
    // walks down from their own constituency, not up to its parent region,
    // so a region-level query correctly returns nothing for them — that's
    // the scope working as intended, not what this test is checking.
    const nationalResult = await turnoutTool.execute(nationalId, { level: "constituency" });
    const scopedResult = await turnoutTool.execute(scopedId, { level: "constituency" });

    const nationalRows = nationalResult.data as unknown[];
    const scopedRows = scopedResult.data as unknown[];

    expect(nationalRows.length).toBeGreaterThan(scopedRows.length);
    expect(scopedRows.length).toBe(1);
  });
});

describe("Copilot tools — data correctness", () => {
  it("ResultsTool standings returns candidates whose vote shares sum to ~100%", async () => {
    const commissionerId = await userIdByEmail("commissioner@electiq.example");
    const result = await resultsTool.execute(commissionerId, { action: "standings", positionName: "President" });
    const data = result.data as { standings: Array<{ sharePct: number }> };
    const totalShare = data.standings.reduce((sum, s) => sum + s.sharePct, 0);
    expect(totalShare).toBeCloseTo(100, 0);
  });

  it("ElectionSearchTool finds a known seeded candidate by partial name", async () => {
    const commissionerId = await userIdByEmail("commissioner@electiq.example");
    const result = await electionSearchTool.execute(commissionerId, { query: "Amara" });
    const data = result.data as { candidates: Array<{ name: string }> };
    expect(data.candidates.some((c) => c.name === "Amara Kito")).toBe(true);
  });

  it("ElectionSearchTool with no query returns a message rather than an error", async () => {
    const commissionerId = await userIdByEmail("commissioner@electiq.example");
    const result = await electionSearchTool.execute(commissionerId, { query: "" });
    expect(result.data).toEqual({ message: "No search query provided." });
  });

  it("ReportTool combines results, standings, and open alert/incident counts", async () => {
    const commissionerId = await userIdByEmail("commissioner@electiq.example");
    const result = await reportTool.execute(commissionerId, {});
    const data = result.data as {
      election: string;
      candidateStandings: unknown[];
      openIntegrityAlerts: number;
      openIncidents: number;
    };
    expect(data.election).toBe("Karibu General Election 2026");
    expect(Array.isArray(data.candidateStandings)).toBe(true);
    expect(typeof data.openIntegrityAlerts).toBe("number");
    expect(typeof data.openIncidents).toBe("number");
  });
});
