import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui-v2/StatCard";
import { EmptyState } from "@/components/ui-v2/EmptyState";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { getPollingStationLocationLabel } from "@/lib/location-label";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { getCandidateStandings } from "@/lib/results/candidate-standings";
import { getGeographicBreakdown } from "@/lib/results/geographic-breakdown";
import { getReportingTrend } from "@/lib/results/reporting-trend";
import { Vote, Building2, ClipboardList, ShieldAlert, Users, Map, Layers, TrendingUp, FileCheck2 } from "lucide-react";
import { CandidateStandingsChart } from "@/components/dashboard/CandidateStandingsChart";
import { ReportingTrendChart } from "@/components/dashboard/ReportingTrendChart";

type ActivityItem = { type: string; location: string; timestamp: Date; dotColor: string };

/**
 * Real, stated level name (e.g. "County" for Kenya, "Region" for the
 * demo country) rather than a hardcoded "Regions" label -- restored
 * from the original Command Center dashboard's own pluralizeLevelName
 * helper, carried over unchanged.
 */
function pluralizeLevelName(name: string | null | undefined): string {
  if (!name) return "Regions";
  return name.endsWith("y") ? `${name.slice(0, -1)}ies` : `${name}s`;
}

export default async function DashboardPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ electionId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const userId = session.user.id;

  // Server-side authorization -- never inferred from what the sidebar
  // shows. Restored from the original Command Center dashboard: that
  // page correctly gated its election data behind elections.read, and
  // separately locked the Integrity Alerts card behind integrity.read
  // rather than either hiding it or showing a number the viewer isn't
  // authorized to see. This screen's earlier version (Screen 1 of the
  // redesign) had dropped that gating entirely -- restored here.
  const canReadElections = await authorize(userId, "elections", "read");
  const canReadAudit = await authorize(userId, "audit", "read");
  const canReadIntegrity = await authorize(userId, "integrity", "read");

  const electionId = searchParams.electionId ?? (await getCurrentElectionId());
  const election =
    canReadElections && electionId
      ? await db.election.findUnique({ where: { id: electionId }, include: { country: true, positions: true, parties: true, candidates: true } })
      : null;

  if (!canReadElections) {
    return (
      <AppShell>
        <PageHeader title="Dashboard" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view election data (elections.read).
        </p>
      </AppShell>
    );
  }

  if (!election) {
    return (
      <AppShell>
        <PageHeader title="Dashboard" subtitle="No election configured yet." />
        <EmptyState message="Configure an election to see live figures here." />
      </AppShell>
    );
  }

  const activeElections = await db.election.count({
    where: { countryId: election.countryId, status: "ACTIVE" },
  });

  const [pollingStationAgg, pollingCenterCount, regionLevel, regionCount, constituencyCount] = await Promise.all([
    db.pollingStation.aggregate({
      where: { pollingCenter: { unit: { level: { countryId: election.countryId } } } },
      _sum: { registeredVoters: true },
      _count: true,
    }),
    db.pollingCenter.count({ where: { unit: { level: { countryId: election.countryId } } } }),
    db.administrativeLevel.findFirst({ where: { depth: 0, countryId: election.countryId } }),
    db.administrativeLevel
      .findFirst({ where: { depth: 0, countryId: election.countryId } })
      .then((level) => (level ? db.administrativeUnit.count({ where: { levelId: level.id } }) : 0)),
    db.administrativeLevel
      .findFirst({ where: { depth: 1, countryId: election.countryId } })
      .then((level) => (level ? db.administrativeUnit.count({ where: { levelId: level.id } }) : 0)),
  ]);

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const prev24h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [fieldReportsLast24h, fieldReportsPrev24h] = await Promise.all([
    db.fieldReport.count({ where: { electionId: election.id, submittedAt: { gte: last24h } } }),
    db.fieldReport.count({ where: { electionId: election.id, submittedAt: { gte: prev24h, lt: last24h } } }),
  ]);
  const reportsTrendPct =
    fieldReportsPrev24h > 0 ? Math.round(((fieldReportsLast24h - fieldReportsPrev24h) / fieldReportsPrev24h) * 100) : null;

  const [openIncidents, pendingIncidents] = await Promise.all([
    db.incident.count({ where: { electionId: election.id, status: { not: "RESOLVED" } } }),
    db.incident.count({ where: { electionId: election.id, status: "OPEN" } }),
  ]);

  const resultsAggregate = await getResultsAggregate(election.id);
  const registeredVoters = pollingStationAgg._sum.registeredVoters ?? 0;
  const turnoutPct =
    resultsAggregate.reportingStations > 0 && registeredVoters > 0
      ? (resultsAggregate.votesCast / registeredVoters) * 100
      : null;

  const integrityCounts = canReadIntegrity
    ? await db.integrityAlert.groupBy({ by: ["status", "severity"], _count: { _all: true } })
    : [];
  const openAlerts = integrityCounts
    .filter((c) => c.status === "OPEN" || c.status === "UNDER_REVIEW")
    .reduce((sum, c) => sum + c._count._all, 0);
  const criticalOpenAlerts = integrityCounts
    .filter((c) => (c.status === "OPEN" || c.status === "UNDER_REVIEW") && c.severity === "CRITICAL")
    .reduce((sum, c) => sum + c._count._all, 0);

  // Restored from the original dashboard's LiveResultsPanel: candidate
  // standings, a reporting trend, and regional/constituency breakdowns
  // for the same reference position getResultsAggregate already uses.
  // Computed directly server-side here rather than via the old 20-second
  // client polling loop against a dedicated API route -- that route
  // (/api/command-center) and its polling component were deleted during
  // the Internal UI Consolidation Phase once confirmed unused elsewhere;
  // the underlying query functions they called were never touched and
  // are reused unchanged below.
  const referencePosition = resultsAggregate.referencePositionName
    ? await db.electionPosition.findFirst({ where: { electionId: election.id, name: resultsAggregate.referencePositionName } })
    : null;

  const [standings, regional, constituencies, trend] = referencePosition
    ? await Promise.all([
        getCandidateStandings(election.id, referencePosition.id),
        getGeographicBreakdown(election.id, referencePosition.id, 0),
        getGeographicBreakdown(election.id, referencePosition.id, 1),
        getReportingTrend(election.id, referencePosition.id),
      ])
    : [[], [], [], []];

  const recentAudit = canReadAudit
    ? await db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true, email: true } } },
      })
    : [];

  const [recentReports, recentIncidents, recentPublished, recentCheckIns] = await Promise.all([
    db.fieldReport.findMany({
      where: { electionId: election.id },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: { submittedAt: true, assignment: { select: { pollingStationId: true } } },
    }),
    db.incident.findMany({
      where: { electionId: election.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { createdAt: true, pollingStationId: true, title: true },
    }),
    db.resultSubmission.findMany({
      where: { electionId: election.id, status: "PUBLISHED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { updatedAt: true, pollingStationId: true },
    }),
    db.observerAssignment.findMany({
      where: {
        pollingStation: { pollingCenter: { unit: { level: { countryId: election.countryId } } } },
        checkedInAt: { not: null },
      },
      orderBy: { checkedInAt: "desc" },
      take: 5,
      select: { checkedInAt: true, pollingStationId: true },
    }),
  ]);

  const activityItems: ActivityItem[] = [];
  for (const r of recentReports) {
    const location = (await getPollingStationLocationLabel(r.assignment.pollingStationId)) ?? "Unknown location";
    activityItems.push({ type: "Field report submitted", location, timestamp: r.submittedAt, dotColor: "bg-eiq-info" });
  }
  for (const i of recentIncidents) {
    const location = i.pollingStationId ? (await getPollingStationLocationLabel(i.pollingStationId)) ?? "Unknown location" : "Unknown location";
    activityItems.push({ type: `Incident: ${i.title}`, location, timestamp: i.createdAt, dotColor: "bg-eiq-critical" });
  }
  for (const p of recentPublished) {
    const location = (await getPollingStationLocationLabel(p.pollingStationId)) ?? "Unknown location";
    activityItems.push({ type: "Results published", location, timestamp: p.updatedAt, dotColor: "bg-eiq-success" });
  }
  for (const c of recentCheckIns) {
    if (!c.checkedInAt) continue;
    const location = (await getPollingStationLocationLabel(c.pollingStationId)) ?? "Unknown location";
    activityItems.push({ type: "Observer check-in", location, timestamp: c.checkedInAt, dotColor: "bg-eiq-success" });
  }
  activityItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const topActivity = activityItems.slice(0, 8);

  function timeAgo(date: Date): string {
    const mins = Math.round((now.getTime() - date.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    return `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? "" : "s"} ago`;
  }

  return (
    <AppShell>
      <PageHeader
        title={`Good ${now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, ${session.user.name?.split(" ")[0] ?? "there"}`}
        subtitle={`Secure elections. Trusted results. ${election.country.name}.`}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Elections" value={activeElections} icon={Vote} sublabel={election.name} />
        <StatCard label="Polling Stations" value={pollingStationAgg._count.toLocaleString("en-US")} icon={Building2} sublabel={`${pollingCenterCount.toLocaleString("en-US")} polling centers`} />
        <StatCard
          label="Field Reports"
          value={fieldReportsLast24h}
          icon={ClipboardList}
          sublabel="Last 24 hours"
          trend={reportsTrendPct !== null ? { value: `${reportsTrendPct}%`, positive: reportsTrendPct >= 0 } : undefined}
        />
        <StatCard label="Incidents" value={openIncidents} icon={ShieldAlert} sublabel={pendingIncidents > 0 ? `${pendingIncidents} pending` : undefined} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Registered Voters" value={registeredVoters.toLocaleString("en-US")} icon={Users} />
        <StatCard label={pluralizeLevelName(regionLevel?.name)} value={regionCount.toLocaleString("en-US")} icon={Map} />
        <StatCard label="Constituencies" value={constituencyCount.toLocaleString("en-US")} icon={Layers} />
        <StatCard
          label="Votes Cast"
          value={resultsAggregate.votesCast.toLocaleString("en-US")}
          icon={Vote}
          sublabel={`${resultsAggregate.reportingStations} / ${resultsAggregate.totalStations} stations reporting`}
        />
        <StatCard label="Voter Turnout" value={turnoutPct !== null ? `${turnoutPct.toFixed(1)}%` : "—"} icon={TrendingUp} sublabel={resultsAggregate.referencePositionName ?? undefined} />
        <StatCard label="Verified Results" value={resultsAggregate.verifiedCount.toLocaleString("en-US")} icon={FileCheck2} sublabel={`${resultsAggregate.publishedCount} published`} />
        <StatCard
          label="Integrity Alerts"
          value={canReadIntegrity ? openAlerts.toLocaleString("en-US") : "—"}
          icon={ShieldAlert}
          sublabel={canReadIntegrity ? `${criticalOpenAlerts} unresolved critical` : undefined}
          locked={!canReadIntegrity}
          lockedHint="Requires integrity.read permission"
        />
      </div>

      <div className="mb-6 rounded-lg border border-eiq-border bg-eiq-card p-4">
        <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Election Configuration</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-eiq-text-secondary">Positions</p>
            <p className="text-sm text-eiq-text-primary">{election.positions.map((p) => p.name).join(", ") || "None configured"}</p>
          </div>
          <div>
            <p className="text-xs text-eiq-text-secondary">Parties</p>
            <p className="text-sm text-eiq-text-primary">{election.parties.map((p) => p.abbreviation).join(", ") || "None configured"}</p>
          </div>
          <div>
            <p className="text-xs text-eiq-text-secondary">Candidates</p>
            <p className="text-sm text-eiq-text-primary">{election.candidates.length} registered</p>
          </div>
        </div>
      </div>

      {referencePosition && (
        <>
          <p className="mb-2 text-xs text-eiq-text-secondary">
            Live figures — {resultsAggregate.reportingStations} / {resultsAggregate.totalStations} stations reporting for{" "}
            {referencePosition.name}. Unverified until each result is individually approved and published.
          </p>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
              <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Candidate Standings — {referencePosition.name}</h2>
              <CandidateStandingsChart standings={standings} />
            </div>
            <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
              <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Reporting Trend</h2>
              <ReportingTrendChart trend={trend} />
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <GeoTable title="Regional Results" rows={regional} />
            <GeoTable title="Constituency Results" rows={constituencies} />
          </div>
        </>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Field Activity (Last 24 Hours)</h2>
          <EmptyState message="Interactive map view is planned for a follow-up pass -- not built in this round to avoid presenting a fake map in its place." />
        </div>

        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Recent Activity</h2>
          {topActivity.length === 0 ? (
            <EmptyState message="No recent field activity for this election yet." />
          ) : (
            <ul className="flex flex-col gap-3">
              {topActivity.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.dotColor}`} />
                  <div>
                    <p className="text-sm text-eiq-text-primary">{item.type}</p>
                    <p className="text-xs text-eiq-text-secondary">
                      {item.location} · {timeAgo(item.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {canReadAudit && (
        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Recent Audit Events</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-eiq-text-secondary">
                  <th className="py-2 font-medium">Action</th>
                  <th className="py-2 font-medium">Actor</th>
                  <th className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.map((entry) => (
                  <tr key={entry.id} className="border-t border-eiq-border">
                    <td className="py-2 text-eiq-text-primary">{entry.action}</td>
                    <td className="py-2 text-eiq-text-secondary">{entry.actor?.name ?? entry.reason ?? "—"}</td>
                    <td className="py-2 text-eiq-text-secondary">{entry.createdAt.toLocaleString("en-US")}</td>
                  </tr>
                ))}
                {recentAudit.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-eiq-text-secondary">
                      No audit events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function GeoTable({ title, rows }: { title: string; rows: Awaited<ReturnType<typeof getGeographicBreakdown>> }) {
  return (
    <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
      <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-eiq-text-secondary">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Reporting</th>
              <th className="py-2 font-medium">Turnout</th>
              <th className="py-2 font-medium">Votes Cast</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.unitId} className="border-t border-eiq-border">
                <td className="py-2 text-eiq-text-primary">{r.unitName}</td>
                <td className="py-2 text-eiq-text-secondary">
                  {r.reportingStations}/{r.totalStations}
                </td>
                <td className="py-2 text-eiq-text-secondary">{r.turnoutPct.toFixed(1)}%</td>
                <td className="py-2 text-eiq-text-secondary">{r.votesCast.toLocaleString("en-US")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-eiq-text-secondary">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
