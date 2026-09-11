import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/public/rate-limited-response";
import { getPublicElection } from "@/lib/public/queries";

export async function GET(req: NextRequest) {
  return withRateLimit(req, async () => {
    const electionId = req.nextUrl.searchParams.get("electionId") ?? undefined;
    const election = await getPublicElection(electionId);
    if (!election) return NextResponse.json({ error: "No election configured" }, { status: 404 });
    return NextResponse.json(election);
  });
}
