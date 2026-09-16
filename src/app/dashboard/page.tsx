import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui-v2/StatCard";
import { EmptyState } from "@/components/ui-v2/EmptyState";
import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { getPollingStationLocationLabel } from "@/lib/location-label";
import { Vote, Building2, ClipboardList, ShieldAlert } from "lucide-react";

type ActivityItem = { type: string; location: string; timestamp: Date; dotColor: string };

export default async function DashboardPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ electionId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();

  const electionId = searchParams.electionId ?? (await getCurrentElectionId());
  const election = electionId
    ? await db.election.findUnique({ where: { id: electionId }, include: { country: true } })
    : null;

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

  const pollingStationCount = await db.pollingStation.count({
    where: { pollingCenter: { unit: { level: { countryId: election.countryId } } } },
  });

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const prev24h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [fieldReportsLast24h, fieldReportsPrev24h] = await Promise.all([
    db.fieldReport.count({ where: { electionId: election.id, submittedAt: { gte: last24h } } }),
    db.fieldReport.count({
      where: { electionId: election.id, submittedAt: { gte: prev24h, lt: last24h } },
    }),
  ]);
  const reportsTrendPct =
    fieldReportsPrev24h > 0
      ? Math.round(((fieldReportsLast24h - fieldReportsPrev24h) / fieldReportsPrev24h) * 100)
      : null;

  const [openIncidents, pendingIncidents] = await Promise.all([
    db.incident.count({ where: { electionId: election.id, status: { not: "RESOLVED" } } }),
    db.incident.count({ where: { electionId: election.id, status: "OPEN" } }),
  ]);

  // Recent activity: merge the last few of each real event type, sorted
  // by time. Genuinely small per-type queries (fine at this scale) --
  // no synthetic/example events are ever mixed in with the real ones.
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
    const location = i.pollingStationId
      ? (await getPollingStationLocationLabel(i.pollingStationId)) ?? "Unknown location"
      : "Unknown location";
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

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Elections" value={activeElections} icon={Vote} sublabel={election.name} />
        <StatCard label="Polling Stations" value={pollingStationCount.toLocaleString("en-US")} icon={Building2} />
        <StatCard
          label="Field Reports"
          value={fieldReportsLast24h}
          icon={ClipboardList}
          sublabel="Last 24 hours"
          trend={reportsTrendPct !== null ? { value: `${reportsTrendPct}%`, positive: reportsTrendPct >= 0 } : undefined}
        />
        <StatCard
          label="Incidents"
          value={openIncidents}
          icon={ShieldAlert}
          sublabel={pendingIncidents > 0 ? `${pendingIncidents} pending` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
    </AppShell>
  );
}
