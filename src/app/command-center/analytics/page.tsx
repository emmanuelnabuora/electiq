import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { compareElections } from "@/lib/analytics/election-comparison";
import { getRegionalSwing } from "@/lib/analytics/regional-swing";
import { getCompetitiveness } from "@/lib/analytics/competitiveness";
import { getRejectedBallotDistribution, getTurnoutDistribution } from "@/lib/analytics/distributions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DistributionBars } from "@/components/analytics/distribution-bars";

const COMPETITIVENESS_TONE = {
  SAFE: "success",
  LIKELY: "accent",
  COMPETITIVE: "warning",
  TOSS_UP: "critical",
} as const;

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
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view analytics (<code>results.read</code>).
        </CardContent>
      </Card>
    );
  }

  const elections = await db.election.findMany({ orderBy: { electionDate: "desc" } });
  const electionB = elections.find((e) => e.id === searchParams.electionBId) ?? elections[0];
  const electionA =
    elections.find((e) => e.id === searchParams.electionAId) ?? elections.find((e) => e.id !== electionB?.id) ?? elections[1];

  if (!electionA || !electionB) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Advanced Analytics needs at least two elections to compare. Only one is configured.
        </CardContent>
      </Card>
    );
  }

  const positionName = "President";
  const level = searchParams.level === "constituency" ? 1 : 0;

  const comparison = await compareElections(electionA.id, electionB.id, positionName);
  const leadingParty = comparison.electionB.partyShares[0]?.partyAbbreviation;
  const party = searchParams.party ?? leadingParty ?? "UFP";

  const [swing, competitiveness, rejectedDist, turnoutDist] = await Promise.all([
    getRegionalSwing(electionA.id, electionB.id, positionName, party, level as 0 | 1),
    getCompetitiveness(electionB.id, positionName, level as 0 | 1),
    getRejectedBallotDistribution(electionB.id, positionName),
    getTurnoutDistribution(electionB.id, positionName),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-light">Advanced Analytics</h1>
        <p className="text-sm text-neutral">
          Comparing <span className="text-light">{comparison.electionA.electionName}</span> to{" "}
          <span className="text-light">{comparison.electionB.electionName}</span> for {positionName}.
        </p>
      </div>

      <Card>
        <CardContent className="py-3 text-xs text-neutral">
          These are descriptive statistics only. A change between elections, a wide swing, or a close
          margin describes what happened — it does not by itself explain why. Figures for the current
          election reflect all reported results so far, not only published ones.
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Turnout comparison</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 py-4 text-sm">
            <div>
              <p className="text-xs text-neutral">{comparison.electionA.electionName}</p>
              <p className="text-2xl font-semibold text-light">{comparison.electionA.turnoutPct.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-neutral">{comparison.electionB.electionName}</p>
              <p className="text-2xl font-semibold text-light">{comparison.electionB.turnoutPct.toFixed(1)}%</p>
            </div>
            <div className="col-span-2 text-xs text-neutral">
              Change: {comparison.turnoutDeltaPct >= 0 ? "+" : ""}
              {comparison.turnoutDeltaPct.toFixed(1)} points
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Party performance — vote share change</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 py-4 text-sm">
            {comparison.partyShareDeltas.map((p) => (
              <div key={p.partyAbbreviation} className="flex items-center justify-between">
                <span className="text-light">{p.partyAbbreviation}</span>
                <span className="text-neutral">
                  {p.sharePctA.toFixed(1)}% → {p.sharePctB.toFixed(1)}%{" "}
                  <span className={p.deltaPct >= 0 ? "text-success" : "text-critical"}>
                    ({p.deltaPct >= 0 ? "+" : ""}
                    {p.deltaPct.toFixed(1)})
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regional swing — {party}</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Region</th>
                <th className="py-2 font-medium">{comparison.electionA.electionName}</th>
                <th className="py-2 font-medium">{comparison.electionB.electionName}</th>
                <th className="py-2 font-medium">Swing</th>
              </tr>
            </thead>
            <tbody>
              {swing.map((s) => (
                <tr key={s.unitId} className="border-t border-white/5">
                  <td className="py-2 text-light">{s.unitName}</td>
                  <td className="py-2 text-neutral">{s.sharePctA.toFixed(1)}%</td>
                  <td className="py-2 text-neutral">{s.sharePctB.toFixed(1)}%</td>
                  <td className={`py-2 ${s.swingPct >= 0 ? "text-success" : "text-critical"}`}>
                    {s.swingPct >= 0 ? "+" : ""}
                    {s.swingPct.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competitiveness — {comparison.electionB.electionName}</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Unit</th>
                <th className="py-2 font-medium">Leader</th>
                <th className="py-2 font-medium">Runner-up</th>
                <th className="py-2 font-medium">Margin</th>
                <th className="py-2 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {competitiveness.map((c) => (
                <tr key={c.unitId} className="border-t border-white/5">
                  <td className="py-2 text-light">{c.unitName}</td>
                  <td className="py-2 text-neutral">{c.leader}</td>
                  <td className="py-2 text-neutral">{c.runnerUp}</td>
                  <td className="py-2 text-neutral">{c.marginPct.toFixed(1)} pts</td>
                  <td className="py-2">
                    <Badge tone={COMPETITIVENESS_TONE[c.classification]}>{c.classification.replace("_", " ")}</Badge>
                  </td>
                </tr>
              ))}
              {competitiveness.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-neutral">
                    No reporting stations with at least two candidates counted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Turnout distribution</CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <DistributionBars stats={turnoutDist} unit="%" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rejected ballot rate distribution</CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <DistributionBars stats={rejectedDist} unit="%" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
