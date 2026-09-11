import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/public/rate-limited-response";
import { getPublicElection, getPublicRegionalResults } from "@/lib/public/queries";

export async function GET(req: NextRequest) {
  return withRateLimit(req, async () => {
    const electionId = req.nextUrl.searchParams.get("electionId") ?? undefined;
    const positionName = req.nextUrl.searchParams.get("position") ?? "President";
    const level = req.nextUrl.searchParams.get("level") === "constituency" ? 1 : 0;

    const election = await getPublicElection(electionId);
    if (!election) return NextResponse.json({ error: "No election configured" }, { status: 404 });

    const regions = await getPublicRegionalResults(election.id, positionName, level);
    return NextResponse.json({ electionId: election.id, positionName, regions });
  });
}
