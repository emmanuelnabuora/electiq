export type CandidateVoteInput = {
  candidateId: string;
  votes: number;
};

export type ResultSubmissionInput = {
  registeredVoters: number;
  ballotsIssued: number;
  votesCast: number;
  validVotes: number;
  rejectedBallots: number;
  candidateVotes: CandidateVoteInput[];
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Deterministic validation rules for a polling-station result submission,
 * exactly as listed in the master spec's Results Engine section. This
 * function never talks to the database and never classifies anything as
 * fraud — a failing result is "requires correction," not an accusation.
 */
export function validateResultSubmission(input: ResultSubmissionInput): ValidationResult {
  const errors: string[] = [];

  const counts = [
    ["registeredVoters", input.registeredVoters],
    ["ballotsIssued", input.ballotsIssued],
    ["votesCast", input.votesCast],
    ["validVotes", input.validVotes],
    ["rejectedBallots", input.rejectedBallots],
  ] as const;

  for (const [label, value] of counts) {
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`"${label}" must be a non-negative whole number`);
    }
  }

  for (const cv of input.candidateVotes) {
    if (!Number.isInteger(cv.votes) || cv.votes < 0) {
      errors.push(`Candidate vote count for "${cv.candidateId}" must be a non-negative whole number`);
    }
  }

  // Every subsequent rule assumes well-formed integers — skip them if the
  // basic shape is already wrong, so the error list stays focused on the
  // real problem instead of a cascade of nonsense comparisons.
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  if (input.ballotsIssued > input.registeredVoters) {
    errors.push("Ballots issued cannot exceed registered voters");
  }
  if (input.votesCast > input.ballotsIssued) {
    errors.push("Votes cast cannot exceed ballots issued");
  }
  if (input.validVotes + input.rejectedBallots !== input.votesCast) {
    errors.push("Valid votes plus rejected ballots must equal votes cast");
  }

  const candidateTotal = input.candidateVotes.reduce((sum, cv) => sum + cv.votes, 0);
  if (candidateTotal !== input.validVotes) {
    errors.push(
      `Candidate vote total (${candidateTotal}) must equal valid votes (${input.validVotes})`
    );
  }

  return { valid: errors.length === 0, errors };
}
