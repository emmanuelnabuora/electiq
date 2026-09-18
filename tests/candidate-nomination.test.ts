import { describe, it, expect } from "vitest";
import { canApproveNomination } from "@/lib/elections/nomination";

describe("canApproveNomination (candidate nomination approval gate)", () => {
  it("blocks approval when the candidate's party is not REGISTERED", () => {
    expect(canApproveNomination({ party: { registrationStatus: "PENDING" } })).toBe(false);
    expect(canApproveNomination({ party: { registrationStatus: "SUSPENDED" } })).toBe(false);
  });

  it("allows approval when the candidate's party is REGISTERED", () => {
    expect(canApproveNomination({ party: { registrationStatus: "REGISTERED" } })).toBe(true);
  });

  it("allows approval for an independent candidate with no party at all", () => {
    expect(canApproveNomination({ party: null })).toBe(true);
  });
});
