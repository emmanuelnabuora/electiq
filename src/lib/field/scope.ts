import { db } from "@/lib/db";

/** Loads the current user's Observer profile, or null if they don't have one. */
export async function getObserverProfile(userId: string) {
  return db.observer.findUnique({ where: { userId } });
}

/**
 * Confirms the given assignment belongs to this user's own Observer
 * profile. Field check-in and reporting are assignment-based, not the
 * coarser administrative-unit UserScope used elsewhere — an observer only
 * ever acts on the specific station(s) they were assigned to.
 */
export async function loadOwnAssignment(userId: string, assignmentId: string) {
  const observer = await getObserverProfile(userId);
  if (!observer) return null;

  const assignment = await db.observerAssignment.findUnique({
    where: { id: assignmentId },
    include: { pollingStation: { include: { pollingCenter: true } } },
  });
  if (!assignment || assignment.observerId !== observer.id) return null;
  return assignment;
}

/** Resolves the ward unit an incident belongs to, for RBAC scope checks — null if the incident isn't tied to a specific polling station (national-level report). */
export async function getWardUnitIdForIncident(incidentId: string): Promise<string | null> {
  const incident = await db.incident.findUnique({
    where: { id: incidentId },
    include: { pollingStation: { include: { pollingCenter: true } } },
  });
  return incident?.pollingStation?.pollingCenter.unitId ?? null;
}
