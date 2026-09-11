import { getPublicElection, getPublicCandidateStandings } from "@/lib/public/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PublicResultsPage() {
  const election = await getPublicElection();
  if (!election) {
    return <p className="text-sm text-neutral">No election configured yet.</p>;
  }

  const positionName = election.positions.includes("President") ? "President" : election.positions[0];
  const standings = positionName ? await getPublicCandidateStandings(election.id, positionName) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">{election.name}</p>
        <h1 className="mt-1 text-2xl font-semibold text-light">Official Results — {positionName}</h1>
        <p className="mt-1 text-sm text-neutral">
          {new Date(election.electionDate).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          · <Badge tone="accent">{election.status}</Badge>
        </p>
      </div>

      <Card>
        <CardContent className="py-3 text-xs text-neutral">
          These figures include only polling-station results that election officials have officially
          published. Results still being verified or approved are not reflected here — see the Updates
          page for how many stations have published so far.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 py-4">
          {standings.length === 0 && (
            <p className="text-sm text-neutral">No results have been published yet for this position.</p>
          )}
          {standings.map((s) => (
            <div key={s.fullName} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0">
              <div>
                <p className="text-light">{s.fullName}</p>
                {s.partyAbbreviation && <p className="text-xs text-neutral">{s.partyAbbreviation}</p>}
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-light">{s.sharePct.toFixed(1)}%</p>
                <p className="text-xs text-neutral">{s.votes.toLocaleString("en-US")} votes</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
