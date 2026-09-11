import { getPublicElection, getPublicRegionalResults } from "@/lib/public/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PublicTurnoutPage() {
  const election = await getPublicElection();
  if (!election) return <p className="text-sm text-neutral">No election configured yet.</p>;

  const positionName = election.positions.includes("President") ? "President" : election.positions[0];
  const regions = positionName ? await getPublicRegionalResults(election.id, positionName, 0) : [];

  const totalPublished = regions.reduce((sum, r) => sum + r.publishedStations, 0);
  const totalStations = regions.reduce((sum, r) => sum + r.totalStations, 0);
  const totalVotesCast = regions.reduce((sum, r) => sum + r.votesCast, 0);
  const totalRegisteredVoters = regions.reduce((sum, r) => sum + r.registeredVoters, 0);
  const nationalTurnoutPct = totalRegisteredVoters > 0 ? (totalVotesCast / totalRegisteredVoters) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-light">Turnout</h1>
        <p className="mt-1 text-sm text-neutral">
          {election.name}. Based only on officially published polling stations ({totalPublished} of{" "}
          {totalStations}).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>National turnout (published stations only)</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <p className="text-3xl font-semibold text-light">{nationalTurnoutPct.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-neutral">
            {totalVotesCast.toLocaleString("en-US")} votes cast of {totalRegisteredVoters.toLocaleString("en-US")}{" "}
            registered voters in published stations
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By region</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Region</th>
                <th className="py-2 font-medium">Turnout</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.unitName} className="border-t border-white/5">
                  <td className="py-2 text-light">{r.unitName}</td>
                  <td className="py-2 text-neutral">{r.turnoutPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
