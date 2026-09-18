/**
 * The actual rule: a candidate can't be approved while running under
 * a party that isn't REGISTERED. An independent (no party) is never
 * blocked by this. Kept in its own plain module (not the "use server"
 * actions file) because Next.js requires every export from a "use
 * server" file to itself be an async Server Action -- a synchronous
 * helper can't live there, which is exactly the build error that
 * caught this on the first production build attempt.
 */
export function canApproveNomination(candidate: { party: { registrationStatus: string } | null }): boolean {
  if (!candidate.party) return true;
  return candidate.party.registrationStatus === "REGISTERED";
}
