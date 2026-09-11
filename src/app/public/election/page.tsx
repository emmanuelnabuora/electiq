import { getPublicElection } from "@/lib/public/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PublicElectionDataPage() {
  const election = await getPublicElection();
  if (!election) return <p className="text-sm text-neutral">No election configured yet.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-light">Election Data</h1>
        <p className="mt-1 text-sm text-neutral">{election.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 py-4 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs text-neutral">Election date</p>
            <p className="text-light">
              {new Date(election.electionDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral">Status</p>
            <Badge tone="accent">{election.status}</Badge>
          </div>
          <div>
            <p className="text-xs text-neutral">Positions</p>
            <p className="text-light">{election.positions.join(", ")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered parties</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 py-4">
          {election.parties.map((p) => (
            <div key={p.abbreviation} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 text-sm">
              <span className="text-light">{p.name}</span>
              <Badge>{p.abbreviation}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
