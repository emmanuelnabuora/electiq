import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScenarioLab } from "@/components/scenarios/scenario-lab";

export default async function ScenariosPage() {
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "results", "read");

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to use the Scenario Lab (<code>results.read</code>).
        </CardContent>
      </Card>
    );
  }

  const electionId = await getCurrentElectionId();
  if (!electionId) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">No election configured yet.</CardContent>
      </Card>
    );
  }

  const election = await db.election.findUniqueOrThrow({ where: { id: electionId } });
  const parties = await db.party.findMany({ where: { electionId }, select: { abbreviation: true, name: true } });

  const positions = await db.electionPosition.findMany({ where: { electionId } });
  const positionName = positions.find((p) => p.name === "President")?.name ?? positions[0]?.name;

  if (!positionName) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">{election.name} has no positions configured.</CardContent>
      </Card>
    );
  }

  const history = await db.scenarioRun.findMany({
    where: { electionId },
    orderBy: { executedAt: "desc" },
    take: 20,
    include: { executedBy: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-light">Scenario Lab</h1>
        <p className="text-sm text-neutral">
          {election.name} — {positionName}. Every output here is a model estimate, never an official
          result.
        </p>
      </div>

      <ScenarioLab electionId={election.id} positionName={positionName} parties={parties} />

      <Card>
        <CardHeader>
          <CardTitle>Scenario history</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Model version</th>
                <th className="py-2 font-medium">Run by</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-white/5">
                  <td className="py-2">
                    <Badge>{h.scenarioType.replace("_", " ")}</Badge>
                  </td>
                  <td className="py-2 text-neutral">{h.modelVersion}</td>
                  <td className="py-2 text-neutral">{h.executedBy?.name ?? "—"}</td>
                  <td className="py-2 text-neutral">{h.executedAt.toLocaleString("en-US")}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral">
                    No scenarios run yet.
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
