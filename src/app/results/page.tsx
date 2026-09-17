import Link from "next/link";
import { Building2, CheckCircle2, Users, TrendingUp, Activity } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui-v2/StatCard";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { EmptyState } from "@/components/ui-v2/EmptyState";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { getCandidateStandings } from "@/lib/results/candidate-standings";
import { getCurrentElectionId } from "@/lib/elections/current";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function ResultsDashboardPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ electionId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "results", "read");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Results" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view results (results.read).
        </p>
      </AppShell>
    );
  }

  const electionId = searchParams.electionId ?? (await getCurrentElectionId());
  const election = electionId ? await db.election.findUnique({ where: { id: electionId } }) : null;

  if (!election) {
    return (
      <AppShell>
        <PageHeader title="Results" />
        <EmptyState message="No election configured yet." />
      </AppShell>
    );
  }

  const aggregate = await getResultsAggregate(election.id);
  const registeredVotersAgg = await db.pollingStation.aggregate({
    where: { pollingCenter: { unit: { level: { countryId: election.countryId } } } },
    _sum: { registeredVoters: true },
  });
  const registeredVoters = registeredVotersAgg._sum.registeredVoters ?? 0;
  const turnoutPct = registeredVoters > 0 ? (aggregate.votesCast / registeredVoters) * 100 : 0;
  const reportingPct = aggregate.totalStations > 0 ? (aggregate.reportingStations / aggregate.totalStations) * 100 : 0;

  const positions = aggregate.referencePositionName
    ? [{ name: aggregate.referencePositionName, id: await db.electionPosition
          .findFirst({ where: { electionId: election.id, name: aggregate.referencePositionName } })
          .then((p) => p?.id ?? "") }]
    : [];

  const standingsByPosition = await Promise.all(
    positions.map(async (p) => ({ position: p, standings: p.id ? await getCandidateStandings(election.id, p.id) : [] }))
  );

  return (
    <AppShell>
      <PageHeader
        title={election.name}
        subtitle={
          election.status === "ACTIVE"
            ? undefined
            : `Status: ${election.status}`
        }
        actions={
          election.status === "ACTIVE" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-eiq-critical/10 px-3 py-1 text-xs font-semibold text-eiq-critical">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-eiq-critical" /> LIVE
            </span>
          ) : (
            <StatusBadge status={election.status} tone="neutral" />
          )
        }
      />

      <p className="mb-4 text-xs text-eiq-text-secondary">
        Provisional, operational figures -- includes results still being verified or approved, not
        only certified/published ones. This view is for internal awareness, not an official
        declaration; the public portal shows PUBLISHED-only totals separately.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Polling Stations" value={aggregate.totalStations.toLocaleString("en-US")} icon={Building2} />
        <StatCard label="Reporting" value={`${reportingPct.toFixed(0)}%`} icon={CheckCircle2} sublabel={`${aggregate.reportingStations} / ${aggregate.totalStations}`} />
        <StatCard label="Valid Votes" value={aggregate.votesCast.toLocaleString("en-US")} icon={Users} />
        <StatCard label="Voter Turnout" value={`${turnoutPct.toFixed(1)}%`} icon={TrendingUp} />
        <StatCard label="Election Status" value={election.status} icon={Activity} />
      </div>

      {standingsByPosition.map(({ position, standings }) => (
        <div key={position.name} className="mb-4 rounded-xl border border-eiq-border bg-eiq-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-eiq-text-primary">Results by Candidate — {position.name}</h2>
          {standings.length === 0 ? (
            <EmptyState message="No results recorded yet for this position." />
          ) : (
            <div className="flex flex-col gap-4">
              {standings.map((s) => {
                const maxShare = Math.max(...standings.map((x) => x.sharePct), 1);
                return (
                  <div key={s.candidateId} className="flex items-center gap-3">
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.photoUrl} alt={s.fullName} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-eiq-blue/10 text-xs font-medium text-eiq-blue">
                        {initials(s.fullName)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-eiq-text-primary">
                          {s.fullName}
                          {s.partyAbbreviation && <span className="ml-2 text-xs text-eiq-text-secondary">{s.partyAbbreviation}</span>}
                        </p>
                        <p className="shrink-0 text-sm font-semibold text-eiq-text-primary">{s.sharePct.toFixed(1)}%</p>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-eiq-bg">
                        <div className="h-full rounded-full bg-eiq-blue" style={{ width: `${(s.sharePct / maxShare) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-eiq-text-secondary">{s.votes.toLocaleString("en-US")} votes</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div className="rounded-xl border border-eiq-border bg-eiq-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-eiq-text-primary">Reporting status</h2>
          <Link href="/results/submissions" className="text-xs font-medium text-eiq-blue">
            View all submissions →
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-eiq-text-secondary">Verified</p>
            <p className="font-semibold text-eiq-text-primary">{aggregate.verifiedCount}</p>
          </div>
          <div>
            <p className="text-xs text-eiq-text-secondary">Approved</p>
            <p className="font-semibold text-eiq-text-primary">{aggregate.approvedCount}</p>
          </div>
          <div>
            <p className="text-xs text-eiq-text-secondary">Published</p>
            <p className="font-semibold text-eiq-text-primary">{aggregate.publishedCount}</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
