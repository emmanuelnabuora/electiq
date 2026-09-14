import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { getCurrentElectionId } from "@/lib/elections/current";
import { db } from "@/lib/db";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { getCandidateStandings } from "@/lib/results/candidate-standings";
import { PrintButton } from "@/components/reports/print-button";

export default async function ResultsSummaryReport() {
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "results", "read");
  if (!canRead) {
    return <p className="text-sm text-neutral">Your role does not include permission to view this report.</p>;
  }

  const electionId = await getCurrentElectionId();
  const election = electionId ? await db.election.findUnique({ where: { id: electionId } }) : null;
  if (!election) return <p className="text-sm text-neutral">No current election configured.</p>;

  const positions = await db.electionPosition.findMany({ where: { electionId: election.id } });
  const aggregate = await getResultsAggregate(election.id);
  const standingsByPosition = await Promise.all(
    positions.map(async (p) => ({ position: p, standings: await getCandidateStandings(election.id, p.id) }))
  );

  const generatedAt = new Date();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral print:hidden">
          Provisional — reflects submissions as of the moment this page was generated, not a
          certified result.
        </p>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-white/10 bg-panel p-8 text-light print:border-none print:bg-white print:p-0 print:text-black">
        <h1 className="text-2xl font-semibold">Results Summary</h1>
        <p className="mt-1 text-sm opacity-70">{election.name}</p>
        <p className="mt-1 text-xs opacity-60">
          Generated {generatedAt.toLocaleString("en-US")} — PROVISIONAL, not an official result
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 border-y border-white/10 py-4 sm:grid-cols-3 print:grid-cols-3 print:border-black/20">
          <div>
            <p className="text-xs opacity-60">Reporting</p>
            <p className="text-lg font-semibold">
              {aggregate.reportingStations} / {aggregate.totalStations}
            </p>
          </div>
          <div>
            <p className="text-xs opacity-60">Verified</p>
            <p className="text-lg font-semibold">{aggregate.verifiedCount}</p>
          </div>
          <div>
            <p className="text-xs opacity-60">Published</p>
            <p className="text-lg font-semibold">{aggregate.publishedCount}</p>
          </div>
        </div>

        {standingsByPosition.map(({ position, standings }) => (
          <div key={position.id} className="mt-6">
            <h2 className="text-lg font-medium">{position.name}</h2>
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="opacity-60">
                  <th className="py-1 font-medium">Candidate</th>
                  <th className="py-1 font-medium">Party</th>
                  <th className="py-1 font-medium">Votes</th>
                  <th className="py-1 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => (
                  <tr key={s.candidateId} className="border-t border-white/10 print:border-black/10">
                    <td className="py-1">{s.fullName}</td>
                    <td className="py-1 opacity-70">{s.partyAbbreviation ?? "—"}</td>
                    <td className="py-1">{s.votes.toLocaleString("en-US")}</td>
                    <td className="py-1">{s.sharePct.toFixed(1)}%</td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-center opacity-60">
                      No votes recorded yet for this position.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
