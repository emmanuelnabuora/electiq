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
import { Flag, CheckCircle2, Clock } from "lucide-react";

const STATUS_TONE = { PENDING: "warning", REGISTERED: "success", SUSPENDED: "critical" } as const;

type PartyRow = Awaited<ReturnType<typeof loadParties>>[number];

async function loadParties(electionId: string, statusFilter: string) {
  return db.party.findMany({
    where: {
      electionId,
      ...(statusFilter !== "all" ? { registrationStatus: statusFilter as never } : {}),
    },
    include: {
      coverage: { include: { unit: true } },
      _count: { select: { candidates: true } },
    },
    orderBy: { name: "asc" },
  });
}

export default async function PartiesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ status?: string; electionId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "elections", "read");
  const canUpdate = await authorize(session.user.id, "elections", "update");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Parties" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view parties (elections.read).
        </p>
      </AppShell>
    );
  }

  const electionId = searchParams.electionId ?? (await getCurrentElectionId());
  const election = electionId ? await db.election.findUnique({ where: { id: electionId } }) : null;

  if (!election) {
    return (
      <AppShell>
        <PageHeader title="Parties" />
        <EmptyState message="No election configured yet." />
      </AppShell>
    );
  }

  const statusFilter = searchParams.status ?? "all";
  const parties = await loadParties(election.id, statusFilter);
  const allParties = await loadParties(election.id, "all");
  const registeredCount = allParties.filter((p) => p.registrationStatus === "REGISTERED").length;
  const pendingCount = allParties.filter((p) => p.registrationStatus === "PENDING").length;

  const columns: DataTableColumn<PartyRow>[] = [
    {
      header: "Party",
      cell: (p) => (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full border border-eiq-border" style={{ backgroundColor: p.colorHex ?? "#94A3B8" }} />
          <Link href={`/elections/parties/${p.id}`} className="font-medium text-eiq-blue hover:underline">
            {p.name}
          </Link>
        </div>
      ),
    },
    { header: "Abbreviation", cell: (p) => p.abbreviation },
    {
      header: "Registration Status",
      cell: (p) => <StatusBadge status={p.registrationStatus} tone={STATUS_TONE[p.registrationStatus]} />,
    },
    { header: "Candidates", cell: (p) => p._count.candidates },
    {
      header: "Geographic Coverage",
      cell: (p) => (p.coverage.length > 0 ? p.coverage.map((c) => c.unit.name).join(", ") : "Not yet set"),
    },
    {
      header: "Actions",
      cell: (p) => (
        <Link href={`/elections/parties/${p.id}`} className="text-xs font-medium text-eiq-blue">
          Manage →
        </Link>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Parties"
        subtitle={election.name}
        actions={
          canUpdate ? (
            <Link
              href={`/elections/${election.id}`}
              className="flex items-center gap-1.5 rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add Party
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total Parties" value={allParties.length} icon={Flag} />
        <StatCard label="Registered" value={registeredCount} icon={CheckCircle2} />
        <StatCard label="Pending" value={pendingCount} icon={Clock} />
      </div>

      <FilterBar
        param="status"
        options={[
          { label: "All", value: "all" },
          { label: "Pending", value: "PENDING" },
          { label: "Registered", value: "REGISTERED" },
          { label: "Suspended", value: "SUSPENDED" },
        ]}
      />

      <DataTable columns={columns} rows={parties} rowKey={(p) => p.id} emptyMessage="No parties match this filter." />
    </AppShell>
  );
}
