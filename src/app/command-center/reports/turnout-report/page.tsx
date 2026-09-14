import { requireSession } from "@/lib/session";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { getCurrentElectionId } from "@/lib/elections/current";
import { db } from "@/lib/db";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import { PrintButton } from "@/components/reports/print-button";

export default async function TurnoutReport() {
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "results", "read");
  if (!canRead) {
    return <p className="text-sm text-neutral">Your role does not include permission to view this report.</p>;
  }

  const electionId = await getCurrentElectionId();
  const election = electionId ? await db.election.findUnique({ where: { id: electionId } }) : null;
  if (!election) return <p className="text-sm text-neutral">No current election configured.</p>;

  const position = await db.electionPosition.findFirst({ where: { electionId: election.id } });
  if (!position) return <p className="text-sm text-neutral">This election has no positions configured.</p>;

  const rows = await getGeographicBreakdown(election.id, position.id, 0);
  const scope = await resolveUserScope(session.user.id);
  const scoped = scope.isNational ? rows : rows.filter((r) => scope.unitIds.includes(r.unitId));
  const sorted = [...scoped].sort((a, b) => a.unitName.localeCompare(b.unitName));

  const totalVotes = sorted.reduce((sum, r) => sum + r.votesCast, 0);
  const totalRegistered = sorted.reduce((sum, r) => sum + r.registeredVoters, 0);
  const overallTurnout = totalRegistered > 0 ? (totalVotes / totalRegistered) * 100 : 0;
  const generatedAt = new Date();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral print:hidden">
          Turnout is computed only over stations that have reported so far.
        </p>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-white/10 bg-panel p-8 text-light print:border-none print:bg-white print:p-0 print:text-black">
        <h1 className="text-2xl font-semibold">Turnout Report</h1>
        <p className="mt-1 text-sm opacity-70">
          {election.name} — {position.name}
        </p>
        <p className="mt-1 text-xs opacity-60">
          Generated {generatedAt.toLocaleString("en-US")} — PROVISIONAL, computed over reporting
          stations only
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 border-y border-white/10 py-4 sm:grid-cols-2 print:grid-cols-2 print:border-black/20">
          <div>
            <p className="text-xs opacity-60">Overall turnout</p>
            <p className="text-lg font-semibold">{overallTurnout.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs opacity-60">Votes cast</p>
            <p className="text-lg font-semibold">{totalVotes.toLocaleString("en-US")}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="opacity-60">
              <th className="py-1 font-medium">Region</th>
              <th className="py-1 font-medium">Reporting</th>
              <th className="py-1 font-medium">Turnout</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.unitId} className="border-t border-white/10 print:border-black/10">
                <td className="py-1">{r.unitName}</td>
                <td className="py-1 opacity-70">
                  {r.reportingStations}/{r.totalStations} ({r.reportingPct.toFixed(0)}%)
                </td>
                <td className="py-1">{r.turnoutPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
