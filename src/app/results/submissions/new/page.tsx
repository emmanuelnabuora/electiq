import { requireSession } from "@/lib/session";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { ResultSubmissionForm } from "@/components/results/result-submission-form";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Moved here from /command-center/results/submit as part of the UI
 * redesign. ResultSubmissionForm itself (multi-candidate vote entry,
 * station selection) is not restyled in this pass, for the same reason
 * as the submission detail page next to it: it's a real, safety-
 * critical data-entry form, and a rushed visual rewrite risked
 * introducing a bug into it. Wrapped in the new AppShell for
 * consistent navigation; the form's own inner styling is unchanged.
 */
export default async function SubmitResultPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ electionId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const canSubmit = await authorize(session.user.id, "results", "submit");

  if (!canSubmit) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-6 text-sm text-neutral">
            Your role does not include permission to submit results (<code>results.submit</code>).
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const election = await (searchParams.electionId
    ? db.election.findUnique({ where: { id: searchParams.electionId }, include: { positions: { include: { candidates: { include: { party: true } } } } } })
    : db.election.findFirst({
        where: { status: { not: "ARCHIVED" } },
        orderBy: { electionDate: "desc" },
        include: { positions: { include: { candidates: { include: { party: true } } } } },
      }));

  if (!election) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-6 text-sm text-neutral">No election configured yet.</CardContent>
        </Card>
      </AppShell>
    );
  }

  const scope = await resolveUserScope(session.user.id);

  const stations = await db.pollingStation.findMany({
    where: scope.isNational
      ? {}
      : { pollingCenter: { unitId: { in: scope.unitIds } } },
    include: { pollingCenter: { include: { unit: true } } },
    orderBy: { code: "asc" },
  });

  return (
    <AppShell>
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-light">Submit Result</h1>
      <p className="mb-6 text-sm text-neutral">
        {election.name}
        {!scope.isNational && " · limited to your assigned geography"}
      </p>
      <ResultSubmissionForm
        electionId={election.id}
        positions={election.positions.map((p) => ({
          id: p.id,
          name: p.name,
          candidates: p.candidates.map((c) => ({
            id: c.id,
            fullName: c.fullName,
            partyAbbreviation: c.party?.abbreviation ?? null,
          })),
        }))}
        stations={stations.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          registeredVoters: s.registeredVoters,
          location: `${s.pollingCenter.unit.name} · ${s.pollingCenter.name}`,
        }))}
      />
    </div>
    </AppShell>
  );
}
