import { db } from "@/lib/db";

/**
 * Resolves which election counts as "current" for live dashboards,
 * submission forms, and Copilot tools. Ordering by `createdAt` (as every
 * one of these call sites originally did) is wrong once a
 * historical/archived election exists in the database — insertion order
 * is not the same as chronological order, and Sprint 8 seeding a 2021
 * historical election after the 2026 live one exposed exactly this bug
 * (several pages and Copilot tools started treating the archived 2021
 * election as "current"). Prefer the most recent non-archived election
 * by its actual election date; fall back to the most recent election
 * overall only if every election has been archived.
 */
export async function getCurrentElectionId(): Promise<string | null> {
  const live = await db.election.findFirst({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { electionDate: "desc" },
    select: { id: true },
  });
  if (live) return live.id;

  const any = await db.election.findFirst({
    orderBy: { electionDate: "desc" },
    select: { id: true },
  });
  return any?.id ?? null;
}
