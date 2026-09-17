import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/public/rate-limited-response";
import { getPublicElection, getPublicElectionSummary } from "@/lib/public/queries";

export async function GET(req: NextRequest) {
  return withRateLimit(req, async () => {
    const electionId = req.nextUrl.searchParams.get("electionId") ?? undefined;
    const positionName = req.nextUrl.searchParams.get("position") ?? "President";

    const election = await getPublicElection(electionId);
    if (!election) return NextResponse.json({ error: "No election configured" }, { status: 404 });

    const summary = await getPublicElectionSummary(election.id, positionName);
    return NextResponse.json({
      electionId: election.id,
      positionName,
      note: "Reflects PUBLISHED results only. Figures update as more polling stations are officially published.",
      ...summary,
    });
  });
}
