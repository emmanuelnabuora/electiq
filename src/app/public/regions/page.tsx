import { getPublicElection, getPublicRegionalResults } from "@/lib/public/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PublicRegionsPage() {
  const election = await getPublicElection();
  if (!election) return <p className="text-sm text-neutral">No election configured yet.</p>;

  const positionName = election.positions.includes("President") ? "President" : election.positions[0];
  const regions = positionName ? await getPublicRegionalResults(election.id, positionName, 0) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-light">Results by Region</h1>
        <p className="mt-1 text-sm text-neutral">
          {election.name} — {positionName}. Only officially published polling stations are counted.
        </p>
      </div>

      <Card>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Region</th>
                <th className="py-2 font-medium">Published</th>
                <th className="py-2 font-medium">Turnout</th>
                <th className="py-2 font-medium">Votes Cast</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.unitName} className="border-t border-white/5">
                  <td className="py-2 text-light">{r.unitName}</td>
                  <td className="py-2">
                    <Badge tone={r.publishedStations === r.totalStations ? "success" : r.publishedStations > 0 ? "warning" : "neutral"}>
                      {r.publishedStations}/{r.totalStations}
                    </Badge>
                  </td>
                  <td className="py-2 text-neutral">{r.turnoutPct.toFixed(1)}%</td>
                  <td className="py-2 text-neutral">{r.votesCast.toLocaleString("en-US")}</td>
                </tr>
              ))}
              {regions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral">
                    No data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
