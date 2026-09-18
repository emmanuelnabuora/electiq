import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { StatCard } from "@/components/ui-v2/StatCard";
import { EmptyState } from "@/components/ui-v2/EmptyState";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { compareElections } from "@/lib/analytics/election-comparison";
import { getRegionalSwing } from "@/lib/analytics/regional-swing";
import { getCompetitiveness } from "@/lib/analytics/competitiveness";
import { getRejectedBallotDistribution, getTurnoutDistribution } from "@/lib/analytics/distributions";
import { DistributionBars } from "@/components/analytics/distribution-bars";
import { ShieldAlert, AlertTriangle, ClipboardList, CheckCircle2 } from "lucide-react";

const COMPETITIVENESS_TONE = { SAFE: "success", LIKELY: "info", COMPETITIVE: "warning", TOSS_UP: "critical" } as const;

export default async function AnalyticsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ electionAId?: string; electionBId?: string; party?: string; level?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "results", "read");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Analytics" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view analytics (results.read).
        </p>
      </AppShell>
    );
  }

  const elections = await db.election.findMany({ orderBy: { electionDate: "desc" } });
  const electionB = elections.find((e) => e.id === searchParams.electionBId) ?? elections[0];
  const electionA =
    elections.find((e) => e.id === searchParams.electionAId) ?? elections.find((e) => e.id !== electionB?.id) ?? elections[1];

  // Real, descriptive administration metrics -- Incident and Integrity
  // Alert counts, always available regardless of whether two elections
  // exist to compare. Scoped to the current (most recent) election so
  // this doesn't mix incidents/alerts across unrelated elections.
  const currentElection = electionB ?? elections[0];
  const [openIncidents, criticalIncidents, openAlerts, criticalAlerts] = currentElection
    ? await Promise.all([
        db.incident.count({ where: { electionId: currentElection.id, status: { notIn: ["RESOLVED", "DISMISSED"] } } }),
        db.incident.count({
          where: { electionId: currentElection.id, severity: "CRITICAL", status: { notIn: ["RESOLVED", "DISMISSED"] } },
        }),
        db.integrityAlert.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
        db.integrityAlert.count({ where: { severity: "CRITICAL", status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      ])
    : [0, 0, 0, 0];

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        subtitle="Descriptive statistics only -- a change between elections, a wide swing, or a close margin describes what happened, not why. Never used to predict outcomes or rank candidates."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open Incidents" value={openIncidents} icon={ClipboardList} sublabel={currentElection?.name} />
        <StatCard label="Critical Incidents" value={criticalIncidents} icon={AlertTriangle} />
        <StatCard label="Open Integrity Alerts" value={openAlerts} icon={ShieldAlert} sublabel="All elections" />
        <StatCard label="Critical Alerts" value={criticalAlerts} icon={CheckCircle2} />
      </div>

      {!electionA || !electionB ? (
        <EmptyState message="Election-to-election comparison needs at least two elections configured. Only one is available." />
      ) : (
        <AnalyticsComparison electionA={electionA} electionB={electionB} searchParams={searchParams} />
      )}
    </AppShell>
  );
}

async function AnalyticsComparison({
  electionA,
  electionB,
  searchParams,
}: {
  electionA: { id: string };
  electionB: { id: string };
  searchParams: { party?: string; level?: string };
}) {
  const positions = await db.electionPosition.findMany({ where: { electionId: electionB.id } });
  const positionName = positions.find((p) => p.name === "President")?.name ?? positions[0]?.name;

  if (!positionName) {
    return <EmptyState message="This election has no positions configured." />;
  }

  const level = searchParams.level === "constituency" ? 1 : 0;
  const comparison = await compareElections(electionA.id, electionB.id, positionName);
  const leadingParty = comparison.electionB.partyShares[0]?.partyAbbreviation;
  const firstRealParty = await db.party.findFirst({ where: { electionId: electionB.id }, orderBy: { name: "asc" } });
  const party = searchParams.party ?? leadingParty ?? firstRealParty?.abbreviation;

  if (!party) {
    return <EmptyState message={`${comparison.electionB.electionName} has no parties configured.`} />;
  }

  const [swing, competitiveness, rejectedDist, turnoutDist] = await Promise.all([
    getRegionalSwing(electionA.id, electionB.id, positionName, party, level as 0 | 1),
    getCompetitiveness(electionB.id, positionName, level as 0 | 1),
    getRejectedBallotDistribution(electionB.id, positionName),
    getTurnoutDistribution(electionB.id, positionName),
  ]);

  return (
    <>
      <p className="mb-4 text-sm text-eiq-text-secondary">
        Comparing <span className="text-eiq-text-primary">{comparison.electionA.electionName}</span> to{" "}
        <span className="text-eiq-text-primary">{comparison.electionB.electionName}</span> for {positionName}.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Turnout Comparison</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-eiq-text-secondary">{comparison.electionA.electionName}</p>
              <p className="text-2xl font-semibold text-eiq-text-primary">{comparison.electionA.turnoutPct.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-eiq-text-secondary">{comparison.electionB.electionName}</p>
              <p className="text-2xl font-semibold text-eiq-text-primary">{comparison.electionB.turnoutPct.toFixed(1)}%</p>
            </div>
            <div className="col-span-2 text-xs text-eiq-text-secondary">
              Change: {comparison.turnoutDeltaPct >= 0 ? "+" : ""}
              {comparison.turnoutDeltaPct.toFixed(1)} points
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Party Performance — Vote Share Change</h2>
          <div className="flex flex-col gap-2 text-sm">
            {comparison.partyShareDeltas.map((p) => (
              <div key={p.partyAbbreviation} className="flex items-center justify-between">
                <span className="text-eiq-text-primary">{p.partyAbbreviation}</span>
                <span className="text-eiq-text-secondary">
                  {p.sharePctA.toFixed(1)}% → {p.sharePctB.toFixed(1)}%{" "}
                  <span className={p.deltaPct >= 0 ? "text-eiq-success" : "text-eiq-critical"}>
                    ({p.deltaPct >= 0 ? "+" : ""}
                    {p.deltaPct.toFixed(1)})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto rounded-lg border border-eiq-border bg-eiq-card">
        <div className="border-b border-eiq-border p-4">
          <h2 className="text-sm font-medium text-eiq-text-primary">Regional Swing — {party}</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-eiq-border text-xs text-eiq-text-secondary">
              <th className="px-4 py-3 font-medium">Region</th>
              <th className="px-4 py-3 font-medium">{comparison.electionA.electionName}</th>
              <th className="px-4 py-3 font-medium">{comparison.electionB.electionName}</th>
              <th className="px-4 py-3 font-medium">Swing</th>
            </tr>
          </thead>
          <tbody>
            {swing.map((s) => (
              <tr key={s.unitId} className="border-b border-eiq-border last:border-0">
                <td className="px-4 py-3 text-eiq-text-primary">{s.unitName}</td>
                <td className="px-4 py-3 text-eiq-text-secondary">{s.sharePctA.toFixed(1)}%</td>
                <td className="px-4 py-3 text-eiq-text-secondary">{s.sharePctB.toFixed(1)}%</td>
                <td className={`px-4 py-3 ${s.swingPct >= 0 ? "text-eiq-success" : "text-eiq-critical"}`}>
                  {s.swingPct >= 0 ? "+" : ""}
                  {s.swingPct.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-6 overflow-x-auto rounded-lg border border-eiq-border bg-eiq-card">
        <div className="border-b border-eiq-border p-4">
          <h2 className="text-sm font-medium text-eiq-text-primary">Competitiveness — {comparison.electionB.electionName}</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-eiq-border text-xs text-eiq-text-secondary">
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Leader</th>
              <th className="px-4 py-3 font-medium">Runner-up</th>
              <th className="px-4 py-3 font-medium">Margin</th>
              <th className="px-4 py-3 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody>
            {competitiveness.map((c) => (
              <tr key={c.unitId} className="border-b border-eiq-border last:border-0">
                <td className="px-4 py-3 text-eiq-text-primary">{c.unitName}</td>
                <td className="px-4 py-3 text-eiq-text-secondary">{c.leader}</td>
                <td className="px-4 py-3 text-eiq-text-secondary">{c.runnerUp}</td>
                <td className="px-4 py-3 text-eiq-text-secondary">{c.marginPct.toFixed(1)} pts</td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.classification.replace("_", " ")} tone={COMPETITIVENESS_TONE[c.classification]} />
                </td>
              </tr>
            ))}
            {competitiveness.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-eiq-text-secondary">
                  No reporting stations with at least two candidates counted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Turnout Distribution</h2>
          <DistributionBars stats={turnoutDist} unit="%" />
        </div>
        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Rejected Ballot Rate Distribution</h2>
          <DistributionBars stats={rejectedDist} unit="%" />
        </div>
      </div>
    </>
  );
}
