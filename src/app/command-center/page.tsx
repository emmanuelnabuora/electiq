import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { LiveResultsPanel } from "@/components/command-center/live-results-panel";
import { KpiCard } from "@/components/command-center/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Landmark,
  Map,
  Layers,
  Vote,
  TrendingUp,
  FileCheck2,
  ShieldAlert,
} from "lucide-react";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

/**
 * The depth-0 administrative level's own name (e.g. "County" for Kenya,
 * "Region" for the demo country) is real, stated data -- unlike the
 * "Regions" label this replaced, which was hardcoded and would say
 * "Regions" even for a Kenya-based election that actually has counties.
 * Simple English pluralization covers both real level names in this
 * database without needing a full inflection library for two words.
 */
function pluralizeLevelName(name: string | null | undefined): string {
  if (!name) return "Regions";
  return name.endsWith("y") ? `${name.slice(0, -1)}ies` : `${name}s`;
}

export default async function CommandCenterPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ electionId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const userId = session.user.id;

  // Server-side authorization — never inferred from what the sidebar shows.
  const canReadElections = await authorize(userId, "elections", "read");
  const canReadAudit = await authorize(userId, "audit", "read");
  const canReadIntegrity = await authorize(userId, "integrity", "read");

  const election = canReadElections
    ? await (searchParams.electionId
        ? db.election.findUnique({
            where: { id: searchParams.electionId },
            include: { country: true, positions: true, parties: true, candidates: true },
          })
        : db.election.findFirst({
            where: { status: { not: "ARCHIVED" } },
            orderBy: { electionDate: "desc" },
            include: { country: true, positions: true, parties: true, candidates: true },
          }))
    : null;

  const [pollingStationAgg, pollingCenterCount, regionLevel, regionCount, constituencyCount] =
    canReadElections && election
      ? await Promise.all([
          db.pollingStation.aggregate({
            where: { pollingCenter: { unit: { level: { countryId: election.countryId } } } },
            _sum: { registeredVoters: true },
            _count: true,
          }),
          db.pollingCenter.count({ where: { unit: { level: { countryId: election.countryId } } } }),
          db.administrativeLevel.findFirst({ where: { depth: 0, countryId: election.countryId } }),
          db.administrativeLevel
            .findFirst({ where: { depth: 0, countryId: election.countryId } })
            .then((level) =>
              level ? db.administrativeUnit.count({ where: { levelId: level.id } }) : 0
            ),
          db.administrativeLevel
            .findFirst({ where: { depth: 1, countryId: election.countryId } })
            .then((level) =>
              level ? db.administrativeUnit.count({ where: { levelId: level.id } }) : 0
            ),
        ])
      : [null, 0, null, 0, 0];

  const recentAudit = canReadAudit
    ? await db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true, email: true } } },
      })
    : [];

  const resultsAggregate = election ? await getResultsAggregate(election.id) : null;
  const turnoutPct =
    resultsAggregate && resultsAggregate.reportingStations > 0 && pollingStationAgg?._sum.registeredVoters
      ? (resultsAggregate.votesCast / pollingStationAgg._sum.registeredVoters) * 100
      : null;

  const integrityCounts = canReadIntegrity
    ? await db.integrityAlert.groupBy({
        by: ["status", "severity"],
        _count: { _all: true },
      })
    : [];
  const openAlerts = integrityCounts
    .filter((c) => c.status === "OPEN" || c.status === "UNDER_REVIEW")
    .reduce((sum, c) => sum + c._count._all, 0);
  const criticalOpenAlerts = integrityCounts
    .filter((c) => (c.status === "OPEN" || c.status === "UNDER_REVIEW") && c.severity === "CRITICAL")
    .reduce((sum, c) => sum + c._count._all, 0);

  const now = new Date().toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Command Center</p>
          <h1 className="mt-1 text-2xl font-semibold text-light">
            {election ? election.name : "No election configured"}
          </h1>
          <p className="mt-1 text-sm text-neutral">
            Real-time election monitoring, verification, and intelligence.
          </p>
        </div>
        <p className="whitespace-nowrap text-xs text-neutral">{now}</p>
      </div>

      {!canReadElections && (
        <Card>
          <CardContent className="py-6 text-sm text-neutral">
            Your role does not include permission to view election data
            (<code>elections.read</code>). Access was denied server-side.
          </CardContent>
        </Card>
      )}

      {canReadElections && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard
              label="Registered Voters"
              value={formatNumber(pollingStationAgg?._sum.registeredVoters ?? 0)}
              icon={Users}
              tone="blue"
            />
            <KpiCard
              label="Polling Stations"
              value={formatNumber(pollingStationAgg?._count ?? 0)}
              hint={`${formatNumber(pollingCenterCount)} polling centers`}
              icon={Landmark}
              tone="purple"
            />
            <KpiCard
              label={pluralizeLevelName(regionLevel?.name)}
              value={formatNumber(regionCount)}
              icon={Map}
              tone="teal"
            />
            <KpiCard
              label="Constituencies"
              value={formatNumber(constituencyCount)}
              icon={Layers}
              tone="teal"
            />
            <KpiCard
              label="Votes Cast"
              value={resultsAggregate ? formatNumber(resultsAggregate.votesCast) : "—"}
              hint={resultsAggregate ? `${resultsAggregate.reportingStations} / ${resultsAggregate.totalStations} stations reporting` : undefined}
              icon={Vote}
              tone="green"
            />
            <KpiCard
              label="Turnout"
              value={turnoutPct !== null ? `${turnoutPct.toFixed(1)}%` : "—"}
              hint={resultsAggregate?.referencePositionName ?? undefined}
              icon={TrendingUp}
              tone="green"
            />
            <KpiCard
              label="Verified Results"
              value={resultsAggregate ? formatNumber(resultsAggregate.verifiedCount) : "—"}
              hint={resultsAggregate ? `${resultsAggregate.publishedCount} published` : undefined}
              icon={FileCheck2}
              tone="blue"
            />
            <KpiCard
              label="Integrity Alerts"
              value={canReadIntegrity ? formatNumber(openAlerts) : "—"}
              hint={canReadIntegrity ? `${criticalOpenAlerts} unresolved critical` : undefined}
              icon={ShieldAlert}
              tone="red"
              locked={!canReadIntegrity}
              lockedHint="Requires integrity.read permission"
            />
          </div>

          {election && (
            <Card>
              <CardHeader>
                <CardTitle>Election Configuration</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 py-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-neutral">Positions</p>
                  <p className="text-sm text-light">
                    {election.positions.map((p) => p.name).join(", ") || "None configured"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral">Parties</p>
                  <p className="text-sm text-light">
                    {election.parties.map((p) => p.abbreviation).join(", ") || "None configured"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral">Candidates</p>
                  <p className="text-sm text-light">{election.candidates.length} registered</p>
                </div>
              </CardContent>
            </Card>
          )}

          {election && <LiveResultsPanel electionId={election.id} />}
        </>
      )}

      {canReadAudit && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Audit Events</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-neutral">
                  <th className="py-2 font-medium">Action</th>
                  <th className="py-2 font-medium">Actor</th>
                  <th className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.map((entry) => (
                  <tr key={entry.id} className="border-t border-white/5">
                    <td className="py-2 text-light">{entry.action}</td>
                    <td className="py-2 text-neutral">
                      {entry.actor?.name ?? entry.reason ?? "—"}
                    </td>
                    <td className="py-2 text-neutral">
                      {entry.createdAt.toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
                {recentAudit.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-neutral">
                      No audit events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
