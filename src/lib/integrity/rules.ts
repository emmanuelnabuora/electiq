/** Great-circle distance between two lat/lng points, in kilometers. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const INTEGRITY_THRESHOLDS = {
  /** Section 5's HIGH_REJECTED_BALLOT_RATE — flag above this fraction of votes cast. */
  highRejectedBallotRate: 0.05,
  /** GPS_MISMATCH — flag when the device location is this far from the polling center's registered point. */
  gpsMismatchKm: 2,
  /** UNUSUAL_TURNOUT_VARIANCE — flag when a station's turnout differs from its constituency's average by more than this many percentage points. */
  turnoutVariancePct: 25,
  /** MULTIPLE_SUBMISSIONS — flag when a (position, station) has been corrected more than this many times (more than N total versions). */
  maxNormalVersions: 3,
  /** DUPLICATE_RESULT — flag when two different submitters file for the same (position, station) within this many minutes of each other. */
  duplicateWindowMinutes: 10,
} as const;

export function rejectedBallotRate(rejectedBallots: number, votesCast: number): number {
  return votesCast > 0 ? rejectedBallots / votesCast : 0;
}

export function turnoutPct(votesCast: number, registeredVoters: number): number {
  return registeredVoters > 0 ? (votesCast / registeredVoters) * 100 : 0;
}
