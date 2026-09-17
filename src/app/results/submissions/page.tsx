import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui-v2/StatCard";
import { DataTable, type DataTableColumn } from "@/components/ui-v2/DataTable";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { requireSession } from "@/lib/session";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { Building2, CheckCircle2, ShieldCheck, Send, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "critical"> = {
  DRAFT: "neutral",
  SUBMITTED: "neutral",
  VALIDATION_FAILED: "critical",
  AWAITING_REVIEW: "warning",
  VERIFIED: "info",
  FLAGGED: "warning",
  DISPUTED: "critical",
  CORRECTED: "neutral",
  APPROVED: "info",
  PUBLISHED: "success",
};

type SubmissionRow = Awaited<ReturnType<typeof loadSubmissions>>[number];

async function loadSubmissions(electionId: string, status: string | undefined, unitIds: string[] | null) {
  const where: Prisma.ResultSubmissionWhereInput = {
    electionId,
    status: { not: "CORRECTED" },
    ...(status ? { status: status as never } : {}),
    ...(unitIds ? { pollingStation: { pollingCenter: { unitId: { in: unitIds } } } } : {}),
  };
  return db.resultSubmission.findMany({
    where,
    include: {
      position: true,
      pollingStation: { include: { pollingCenter: { include: { unit: true } } } },
      submittedBy: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export default async function ResultSubmissionsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ electionId?: string; status?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "results", "read");
  const canSubmit = await authorize(userId, "results", "submit");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Result Submissions" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view results (results.read).
        </p>
      </AppShell>
    );
  }

  const election = await (searchParams.electionId
    ? db.election.findUnique({ where: { id: searchParams.electionId } })
    : db.election.findFirst({ where: { status: { not: "ARCHIVED" } }, orderBy: { electionDate: "desc" } }));

  if (!election) {
    return (
      <AppShell>
        <PageHeader title="Result Submissions" />
        <p className="text-sm text-eiq-text-secondary">No election configured yet.</p>
      </AppShell>
    );
  }

  const scope = await resolveUserScope(userId);
  const [submissions, aggregate] = await Promise.all([
    loadSubmissions(election.id, searchParams.status, scope.isNational ? null : scope.unitIds),
    getResultsAggregate(election.id),
  ]);

  const columns: DataTableColumn<SubmissionRow>[] = [
    {
      header: "Polling Station",
      cell: (s) => (
        <div>
          <Link href={`/results/submissions/${s.id}`} className="font-medium text-eiq-blue hover:underline">
            {s.pollingStation.name}
          </Link>
          <p className="text-xs text-eiq-text-secondary">{s.pollingStation.pollingCenter.unit.name}</p>
        </div>
      ),
    },
    { header: "Position", cell: (s) => s.position.name },
    {
      header: "Status",
      cell: (s) => <StatusBadge status={s.status} tone={STATUS_TONE[s.status] ?? "neutral"} />,
    },
    { header: "Votes Cast", cell: (s) => s.votesCast.toLocaleString("en-US") },
    { header: "Version", cell: (s) => `v${s.version}` },
    { header: "Submitted By", cell: (s) => s.submittedBy?.name ?? "—" },
  ];

  const statusOptions = ["AWAITING_REVIEW", "VALIDATION_FAILED", "VERIFIED", "FLAGGED", "DISPUTED", "APPROVED", "PUBLISHED"];

  return (
    <AppShell>
      <PageHeader
        title="Result Submissions"
        subtitle={election.name}
        actions={
          canSubmit ? (
            <Link
              href="/results/submissions/new"
              className="flex items-center gap-1.5 rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Submit Result
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reporting" value={`${aggregate.reportingStations} / ${aggregate.totalStations}`} icon={Building2} sublabel={aggregate.referencePositionName ?? undefined} />
        <StatCard label="Votes Cast" value={aggregate.votesCast.toLocaleString("en-US")} icon={Send} />
        <StatCard label="Verified" value={aggregate.verifiedCount} icon={ShieldCheck} />
        <StatCard label="Published" value={aggregate.publishedCount} icon={CheckCircle2} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {statusOptions.map((s) => (
          <Link
            key={s}
            href={`/results/submissions?status=${s}${election ? `&electionId=${election.id}` : ""}`}
            className={
              searchParams.status === s
                ? "rounded-md bg-eiq-blue px-2.5 py-1 text-xs text-white"
                : "rounded-md bg-eiq-bg px-2.5 py-1 text-xs text-eiq-text-secondary hover:text-eiq-text-primary"
            }
          >
            {s.replace("_", " ")}
          </Link>
        ))}
        {searchParams.status && (
          <Link href={`/results/submissions${election ? `?electionId=${election.id}` : ""}`} className="rounded-md px-2.5 py-1 text-xs text-eiq-text-secondary hover:text-eiq-text-primary">
            Clear
          </Link>
        )}
      </div>

      <DataTable columns={columns} rows={submissions} rowKey={(s) => s.id} emptyMessage="No results submitted yet within your scope." />
    </AppShell>
  );
}
