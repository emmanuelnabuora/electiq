import { requireSession } from "@/lib/session";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default async function TurnoutPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ level?: string; positionId?: string; sort?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "results", "read");

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view turnout (<code>results.read</code>).
        </CardContent>
      </Card>
    );
  }

  const electionId = await getCurrentElectionId();
  const election = electionId ? await db.election.findUnique({ where: { id: electionId } }) : null;

  if (!election) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">No current election configured.</CardContent>
      </Card>
    );
  }

  const positions = await db.electionPosition.findMany({ where: { electionId: election.id } });
  const position = positions.find((p) => p.id === searchParams.positionId) ?? positions[0];

  if (!position) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">This election has no positions configured.</CardContent>
      </Card>
    );
  }

  const depth = searchParams.level === "constituency" ? 1 : 0;
  const rows = await getGeographicBreakdown(election.id, position.id, depth);

  const scope = await resolveUserScope(session.user.id);
  const scoped = scope.isNational ? rows : rows.filter((r) => scope.unitIds.includes(r.unitId));

  const sortDesc = searchParams.sort === "highest";
  const sorted = [...scoped].sort((a, b) => (sortDesc ? -1 : 1) * (a.turnoutPct - b.turnoutPct));

  const totalStations = sorted.reduce((sum, r) => sum + r.totalStations, 0);
  const reportingStations = sorted.reduce((sum, r) => sum + r.reportingStations, 0);
  const totalVotes = sorted.reduce((sum, r) => sum + r.votesCast, 0);
  const totalRegistered = sorted.reduce((sum, r) => sum + r.registeredVoters, 0);
  const overallTurnout = totalRegistered > 0 ? (totalVotes / totalRegistered) * 100 : 0;

  const levelParam = depth === 0 ? "region" : "constituency";
  const sortParam = sortDesc ? "highest" : "lowest";
  const otherSortParam = sortDesc ? "lowest" : "highest";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-light">Turnout</h1>
        <p className="text-sm text-neutral">
          {election.name} — {position.name}. Turnout is computed only over stations that have
          reported so far, not over every registered voter in a unit — a unit showing 40% turnout
          with only 40% of stations reporting is not yet a low-turnout signal.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex gap-1">
          <Link
            href={`?level=region&sort=${sortParam}`}
            className={depth === 0 ? "rounded bg-accent/15 px-2 py-1 text-accent" : "rounded px-2 py-1 text-neutral hover:bg-white/5"}
          >
            By region
          </Link>
          <Link
            href={`?level=constituency&sort=${sortParam}`}
            className={depth === 1 ? "rounded bg-accent/15 px-2 py-1 text-accent" : "rounded px-2 py-1 text-neutral hover:bg-white/5"}
          >
            By constituency
          </Link>
        </div>
        <Link href={`?level=${levelParam}&sort=${otherSortParam}`} className="text-accent hover:underline">
          Sort: {sortDesc ? "highest first" : "lowest first"}
        </Link>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-neutral">Reporting</p>
            <p className="text-lg font-semibold text-light">
              {reportingStations} / {totalStations}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral">Overall turnout</p>
            <p className="text-lg font-semibold text-light">{overallTurnout.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-neutral">Votes cast</p>
            <p className="text-lg font-semibold text-light">{totalVotes.toLocaleString("en-US")}</p>
          </div>
          <div>
            <p className="text-xs text-neutral">Registered (reporting stations)</p>
            <p className="text-lg font-semibold text-light">{totalRegistered.toLocaleString("en-US")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">{depth === 0 ? "Region" : "Constituency"}</th>
                <th className="py-2 font-medium">Reporting</th>
                <th className="py-2 font-medium">Votes cast</th>
                <th className="py-2 font-medium">Turnout</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.unitId} className="border-t border-white/5">
                  <td className="py-2 text-light">{r.unitName}</td>
                  <td className="py-2 text-neutral">
                    {r.reportingStations}/{r.totalStations} ({r.reportingPct.toFixed(0)}%)
                  </td>
                  <td className="py-2 text-neutral">{r.votesCast.toLocaleString("en-US")}</td>
                  <td className="py-2 text-neutral">{r.turnoutPct.toFixed(1)}%</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral">
                    No units within your assigned geography.
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
