import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { getCandidateStandings } from "@/lib/results/candidate-standings";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import { getReportingTrend } from "@/lib/results/reporting-trend";

/**
 * Live Command Center snapshot (Section 4/18 — a dedicated read endpoint
 * the dashboard polls for near-real-time updates, Section 4's "implement
 * near-real-time updates"). Everything in the response is a fresh database
 * read at request time — nothing here is cached across requests, and there
 * is no simulated or interpolated data.
 */
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await authorize(session.user.id, "elections", "read");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const electionId = req.nextUrl.searchParams.get("electionId");
  const election = await (electionId
    ? db.election.findUnique({ where: { id: electionId } })
    : db.election.findFirst({ where: { status: { not: "ARCHIVED" } }, orderBy: { electionDate: "desc" } }));

  if (!election) {
    return NextResponse.json({ error: "No election configured" }, { status: 404 });
  }

  const referencePosition =
    (await db.electionPosition.findFirst({ where: { electionId: election.id, name: "President" } })) ??
    (await db.electionPosition.findFirst({ where: { electionId: election.id }, orderBy: { id: "asc" } }));

  if (!referencePosition) {
    return NextResponse.json({ error: "No positions configured" }, { status: 404 });
  }

  const [aggregate, standings, regional, constituencies, trend] = await Promise.all([
    getResultsAggregate(election.id),
    getCandidateStandings(election.id, referencePosition.id),
    getGeographicBreakdown(election.id, referencePosition.id, 0),
    getGeographicBreakdown(election.id, referencePosition.id, 1),
    getReportingTrend(election.id, referencePosition.id),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    electionId: election.id,
    positionId: referencePosition.id,
    positionName: referencePosition.name,
    aggregate,
    standings,
    regional,
    constituencies,
    trend,
  });
}
