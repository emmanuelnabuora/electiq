import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/public/rate-limited-response";
import { getPublicElection, searchPublicUnits } from "@/lib/public/queries";

export async function GET(req: NextRequest) {
  return withRateLimit(req, async () => {
    const electionId = req.nextUrl.searchParams.get("electionId") ?? undefined;
    const q = req.nextUrl.searchParams.get("q") ?? "";

    const election = await getPublicElection(electionId);
    if (!election) return NextResponse.json({ error: "No election configured" }, { status: 404 });

    const results = await searchPublicUnits(election.id, q);
    return NextResponse.json({ electionId: election.id, query: q, results });
  });
}
