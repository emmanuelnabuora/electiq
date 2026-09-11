import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/public/rate-limited-response";
import { getPublicElection, getPublicCandidateStandings } from "@/lib/public/queries";

export async function GET(req: NextRequest) {
  return withRateLimit(req, async () => {
    const electionId = req.nextUrl.searchParams.get("electionId") ?? undefined;
    const positionName = req.nextUrl.searchParams.get("position") ?? "President";

    const election = await getPublicElection(electionId);
    if (!election) return NextResponse.json({ error: "No election configured" }, { status: 404 });

    const standings = await getPublicCandidateStandings(election.id, positionName);
    return NextResponse.json({
      electionId: election.id,
      positionName,
      note: "Only PUBLISHED results are included. Figures update as more polling stations are officially published.",
      standings,
    });
  });
}
