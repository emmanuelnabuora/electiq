import Link from "next/link";
import { requireSession } from "@/lib/session";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";

const STATUS_TONE = {
  DRAFT: "neutral",
  SUBMITTED: "neutral",
  VALIDATION_FAILED: "critical",
  AWAITING_REVIEW: "warning",
  VERIFIED: "accent",
  FLAGGED: "warning",
  DISPUTED: "critical",
  CORRECTED: "neutral",
  APPROVED: "accent",
  PUBLISHED: "success",
} as const;

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: { electionId?: string; status?: string };
}) {
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "results", "read");
  const canSubmit = await authorize(userId, "results", "submit");

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view results (<code>results.read</code>).
        </CardContent>
      </Card>
    );
  }

  const election = await (searchParams.electionId
    ? db.election.findUnique({ where: { id: searchParams.electionId } })
    : db.election.findFirst({ orderBy: { createdAt: "desc" } }));

  if (!election) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">No election configured yet.</CardContent>
      </Card>
    );
  }

  const scope = await resolveUserScope(userId);

  const where: Prisma.ResultSubmissionWhereInput = {
    electionId: election.id,
    status: { not: "CORRECTED" },
    ...(searchParams.status ? { status: searchParams.status as never } : {}),
    ...(scope.isNational
      ? {}
      : { pollingStation: { pollingCenter: { unitId: { in: scope.unitIds } } } }),
  };

  const [submissions, aggregate] = await Promise.all([
    db.resultSubmission.findMany({
      where,
      include: {
        position: true,
        pollingStation: { include: { pollingCenter: { include: { unit: true } } } },
        submittedBy: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    getResultsAggregate(election.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-light">Results</h1>
          <p className="text-sm text-neutral">{election.name}</p>
        </div>
        {canSubmit && (
          <Link href="/command-center/results/submit">
            <Button>
              <Plus className="h-4 w-4" />
              Submit Result
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wide text-neutral">Reporting</p>
            <p className="mt-1 text-2xl font-semibold text-light">
              {aggregate.reportingStations} / {aggregate.totalStations}
            </p>
            <p className="text-xs text-neutral">{aggregate.referencePositionName ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wide text-neutral">Votes Cast</p>
            <p className="mt-1 text-2xl font-semibold text-light">
              {aggregate.votesCast.toLocaleString("en-US")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wide text-neutral">Verified</p>
            <p className="mt-1 text-2xl font-semibold text-light">{aggregate.verifiedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wide text-neutral">Published</p>
            <p className="mt-1 text-2xl font-semibold text-light">{aggregate.publishedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {[
          "AWAITING_REVIEW",
          "VALIDATION_FAILED",
          "VERIFIED",
          "FLAGGED",
          "DISPUTED",
          "APPROVED",
          "PUBLISHED",
        ].map((s) => (
          <Link
            key={s}
            href={`/command-center/results?status=${s}${election ? `&electionId=${election.id}` : ""}`}
            className={`rounded-md px-2.5 py-1 text-xs ${
              searchParams.status === s
                ? "bg-accent text-white"
                : "bg-white/5 text-neutral hover:text-light"
            }`}
          >
            {s.replace("_", " ")}
          </Link>
        ))}
        {searchParams.status && (
          <Link
            href={`/command-center/results${election ? `?electionId=${election.id}` : ""}`}
            className="rounded-md px-2.5 py-1 text-xs text-neutral hover:text-light"
          >
            Clear
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Polling Station</th>
                <th className="py-2 font-medium">Position</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Votes Cast</th>
                <th className="py-2 font-medium">Version</th>
                <th className="py-2 font-medium">Submitted By</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="py-2">
                    <Link
                      href={`/command-center/results/${s.id}`}
                      className="text-light hover:text-accent"
                    >
                      {s.pollingStation.name}
                    </Link>
                    <p className="text-xs text-neutral">{s.pollingStation.pollingCenter.unit.name}</p>
                  </td>
                  <td className="py-2 text-neutral">{s.position.name}</td>
                  <td className="py-2">
                    <Badge tone={STATUS_TONE[s.status]}>{s.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="py-2 text-neutral">{s.votesCast.toLocaleString("en-US")}</td>
                  <td className="py-2 text-neutral">v{s.version}</td>
                  <td className="py-2 text-neutral">{s.submittedBy?.name ?? "—"}</td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-neutral">
                    No results submitted yet within your scope.
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
