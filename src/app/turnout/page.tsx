import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui-v2/StatCard";
import { EmptyState } from "@/components/ui-v2/EmptyState";
import { requireSession } from "@/lib/session";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import { getReportingTrend } from "@/lib/results/reporting-trend";
import { TurnoutTrendChart } from "@/components/dashboard/TurnoutTrendChart";
import { Users, Vote, TrendingUp, Building2 } from "lucide-react";

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
      <AppShell>
        <PageHeader title="Turnout" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view turnout (results.read).
        </p>
      </AppShell>
    );
  }

  const electionId = await getCurrentElectionId();
  const election = electionId ? await db.election.findUnique({ where: { id: electionId } }) : null;

  if (!election) {
    return (
      <AppShell>
        <PageHeader title="Turnout" />
        <EmptyState message="No current election configured." />
      </AppShell>
    );
  }

  const positions = await db.electionPosition.findMany({ where: { electionId: election.id } });
  const position = positions.find((p) => p.id === searchParams.positionId) ?? positions[0];

  if (!position) {
    return (
      <AppShell>
        <PageHeader title="Turnout" subtitle={election.name} />
        <EmptyState message="This election has no positions configured." />
      </AppShell>
    );
  }

  const depth = searchParams.level === "constituency" ? 1 : 0;
  const [rows, trend] = await Promise.all([
    getGeographicBreakdown(election.id, position.id, depth),
    getReportingTrend(election.id, position.id),
  ]);

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
    <AppShell>
      <PageHeader
        title="Turnout"
        subtitle={`${election.name} — ${position.name}. Turnout is computed only over stations that have reported so far, not over every registered voter in a unit.`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Registered Voters" value={totalRegistered.toLocaleString("en-US")} icon={Users} />
        <StatCard label="Votes Cast" value={totalVotes.toLocaleString("en-US")} icon={Vote} />
        <StatCard label="Turnout Rate" value={`${overallTurnout.toFixed(1)}%`} icon={TrendingUp} />
        <StatCard label="Reporting Stations" value={`${reportingStations} / ${totalStations}`} icon={Building2} />
      </div>

      <div className="mb-6 rounded-lg border border-eiq-border bg-eiq-card p-4">
        <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Turnout Over Time</h2>
        <TurnoutTrendChart trend={trend} totalRegisteredVoters={totalRegistered} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex gap-1">
          <Link
            href={`?level=region&sort=${sortParam}`}
            className={depth === 0 ? "rounded-md bg-eiq-blue/10 px-2.5 py-1 text-eiq-blue" : "rounded-md px-2.5 py-1 text-eiq-text-secondary hover:bg-eiq-bg"}
          >
            By county
          </Link>
          <Link
            href={`?level=constituency&sort=${sortParam}`}
            className={depth === 1 ? "rounded-md bg-eiq-blue/10 px-2.5 py-1 text-eiq-blue" : "rounded-md px-2.5 py-1 text-eiq-text-secondary hover:bg-eiq-bg"}
          >
            By constituency
          </Link>
        </div>
        <Link href={`?level=${levelParam}&sort=${otherSortParam}`} className="text-eiq-blue hover:underline">
          Sort: {sortDesc ? "highest first" : "lowest first"}
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-eiq-border bg-eiq-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-eiq-border text-xs text-eiq-text-secondary">
              <th className="px-4 py-3 font-medium">{depth === 0 ? "County" : "Constituency"}</th>
              <th className="px-4 py-3 font-medium">Reporting</th>
              <th className="px-4 py-3 font-medium">Votes Cast</th>
              <th className="px-4 py-3 font-medium">Turnout</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.unitId} className="border-b border-eiq-border last:border-0">
                <td className="px-4 py-3 text-eiq-text-primary">{r.unitName}</td>
                <td className="px-4 py-3 text-eiq-text-secondary">
                  {r.reportingStations}/{r.totalStations} ({r.reportingPct.toFixed(0)}%)
                </td>
                <td className="px-4 py-3 text-eiq-text-secondary">{r.votesCast.toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-eiq-text-secondary">{r.turnoutPct.toFixed(1)}%</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-eiq-text-secondary">
                  No units within your assigned geography.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
