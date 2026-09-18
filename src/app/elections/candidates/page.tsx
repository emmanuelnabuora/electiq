import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui-v2/StatCard";
import { FilterBar } from "@/components/ui-v2/FilterBar";
import { DataTable, type DataTableColumn } from "@/components/ui-v2/DataTable";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { EmptyState } from "@/components/ui-v2/EmptyState";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { Users2, CheckCircle2, Clock, XCircle } from "lucide-react";

const STATUS_TONE = {
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "critical",
  WITHDRAWN: "neutral",
} as const;

type CandidateRow = Awaited<ReturnType<typeof loadCandidates>>[number];

async function loadCandidates(electionId: string, statusFilter: string) {
  return db.candidate.findMany({
    where: {
      electionId,
      ...(statusFilter !== "all" ? { nominationStatus: statusFilter as never } : {}),
    },
    include: {
      position: true,
      party: { include: { coverage: { include: { unit: true } } } },
      _count: { select: { documents: true } },
    },
    orderBy: { fullName: "asc" },
  });
}

function geographicScope(candidate: CandidateRow): string {
  if (!candidate.party) return "National (Independent)";
  if (candidate.party.coverage.length === 0) return "Not yet set";
  return candidate.party.coverage.map((c) => c.unit.name).join(", ");
}

export default async function CandidatesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ status?: string; position?: string; party?: string; electionId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "elections", "read");
  const canUpdate = await authorize(session.user.id, "elections", "update");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Candidates" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view candidates (elections.read).
        </p>
      </AppShell>
    );
  }

  const electionId = searchParams.electionId ?? (await getCurrentElectionId());
  const election = electionId ? await db.election.findUnique({ where: { id: electionId } }) : null;

  if (!election) {
    return (
      <AppShell>
        <PageHeader title="Candidates" />
        <EmptyState message="No election configured yet." />
      </AppShell>
    );
  }

  const statusFilter = searchParams.status ?? "all";
  let candidates = await loadCandidates(election.id, statusFilter);

  if (searchParams.position) {
    candidates = candidates.filter((c) => c.positionId === searchParams.position);
  }
  if (searchParams.party) {
    candidates = candidates.filter((c) => c.partyId === searchParams.party);
  }

  const allCandidates = await loadCandidates(election.id, "all");
  const approvedCount = allCandidates.filter((c) => c.nominationStatus === "APPROVED").length;
  const pendingCount = allCandidates.filter((c) => c.nominationStatus === "PENDING_REVIEW").length;
  const rejectedWithdrawnCount = allCandidates.filter(
    (c) => c.nominationStatus === "REJECTED" || c.nominationStatus === "WITHDRAWN"
  ).length;

  const columns: DataTableColumn<CandidateRow>[] = [
    {
      header: "Candidate",
      cell: (c) => (
        <Link href={`/elections/candidates/${c.id}`} className="font-medium text-eiq-blue hover:underline">
          {c.fullName}
        </Link>
      ),
    },
    { header: "Position", cell: (c) => c.position.name },
    { header: "Party / Independent", cell: (c) => c.party?.abbreviation ?? "Independent" },
    { header: "Geographic Scope", cell: (c) => geographicScope(c) },
    {
      header: "Nomination Status",
      cell: (c) => <StatusBadge status={c.nominationStatus.replace("_", " ")} tone={STATUS_TONE[c.nominationStatus]} />,
    },
    {
      header: "Ballot Readiness",
      cell: (c) => (
        <StatusBadge
          status={c.nominationStatus === "APPROVED" ? "Ready" : "Not Ready"}
          tone={c.nominationStatus === "APPROVED" ? "success" : "neutral"}
        />
      ),
    },
    { header: "Documents", cell: (c) => c._count.documents },
    {
      header: "Actions",
      cell: (c) => (
        <Link href={`/elections/candidates/${c.id}`} className="text-xs font-medium text-eiq-blue">
          Manage →
        </Link>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Candidates"
        subtitle={election.name}
        actions={
          canUpdate ? (
            <Link
              href={`/elections/${election.id}`}
              className="flex items-center gap-1.5 rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add Candidate
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Candidates" value={allCandidates.length} icon={Users2} />
        <StatCard label="Approved" value={approvedCount} icon={CheckCircle2} />
        <StatCard label="Pending Review" value={pendingCount} icon={Clock} />
        <StatCard label="Rejected / Withdrawn" value={rejectedWithdrawnCount} icon={XCircle} />
      </div>

      <FilterBar
        param="status"
        options={[
          { label: "All", value: "all" },
          { label: "Pending Review", value: "PENDING_REVIEW" },
          { label: "Approved", value: "APPROVED" },
          { label: "Rejected", value: "REJECTED" },
          { label: "Withdrawn", value: "WITHDRAWN" },
        ]}
      />

      <DataTable columns={columns} rows={candidates} rowKey={(c) => c.id} emptyMessage="No candidates match this filter." />
    </AppShell>
  );
}
