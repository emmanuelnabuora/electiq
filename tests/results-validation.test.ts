import { describe, it, expect } from "vitest";
import { validateResultSubmission } from "@/lib/results/validation";

const BASE = {
  registeredVoters: 1000,
  ballotsIssued: 800,
  votesCast: 750,
  validVotes: 730,
  rejectedBallots: 20,
  candidateVotes: [
    { candidateId: "a", votes: 400 },
    { candidateId: "b", votes: 330 },
  ],
};

describe("Results Engine — deterministic validation", () => {
  it("accepts a balanced, internally-consistent result", () => {
    const result = validateResultSubmission(BASE);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects ballots issued exceeding registered voters", () => {
    const result = validateResultSubmission({ ...BASE, ballotsIssued: 1500 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Ballots issued"))).toBe(true);
  });

  it("rejects votes cast exceeding ballots issued", () => {
    const result = validateResultSubmission({ ...BASE, votesCast: 900 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Votes cast"))).toBe(true);
  });

  it("rejects valid + rejected not equalling votes cast", () => {
    const result = validateResultSubmission({ ...BASE, rejectedBallots: 100 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Valid votes plus rejected"))).toBe(true);
  });

  it("rejects a candidate vote total that doesn't equal valid votes", () => {
    const result = validateResultSubmission({
      ...BASE,
      candidateVotes: [{ candidateId: "a", votes: 1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Candidate vote total"))).toBe(true);
  });

  it("rejects negative or non-integer counts rather than silently coercing them", () => {
    const result = validateResultSubmission({ ...BASE, votesCast: -5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("votesCast"))).toBe(true);
  });

  it("rejects a negative individual candidate vote count", () => {
    const result = validateResultSubmission({
      ...BASE,
      candidateVotes: [{ candidateId: "a", votes: -1 }, { candidateId: "b", votes: 731 }],
    });
    expect(result.valid).toBe(false);
  });
});
