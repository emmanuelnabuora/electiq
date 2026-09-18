import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/ui-v2/FilterBar";
import { DataTable, type DataTableColumn } from "@/components/ui-v2/DataTable";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";

type ElectionRow = Awaited<ReturnType<typeof loadElections>>[number];

async function loadElections(statusFilter: string) {
  const where =
    statusFilter === "active"
      ? { status: "ACTIVE" as const }
      : statusFilter === "completed"
        ? { status: "CLOSED" as const }
        : statusFilter === "archived"
          ? { status: "ARCHIVED" as const }
          : {};

  return db.election.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      country: true,
      positions: { select: { name: true } },
      _count: { select: { positions: true, parties: true, candidates: true } },
    },
  });
}

export default async function ElectionsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "elections", "read");
  const canCreate = await authorize(session.user.id, "elections", "create");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Elections" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view elections (elections.read).
        </p>
      </AppShell>
    );
  }

  const statusFilter = searchParams.status ?? "all";
  const elections = await loadElections(statusFilter);

  const columns: DataTableColumn<ElectionRow>[] = [
    {
      header: "Name",
      cell: (e) => (
        <Link href={`/elections/${e.id}`} className="font-medium text-eiq-blue hover:underline">
          {e.name}
        </Link>
      ),
    },
    {
      header: "Type",
      cell: (e) =>
        e.positions.length > 0 ? e.positions.map((p) => p.name).join(", ") : "—",
    },
    { header: "Country", cell: (e) => e.country.name },
    {
      header: "Status",
      cell: (e) => (
        <StatusBadge
          status={e.status}
          tone={e.status === "ACTIVE" ? "success" : e.status === "CLOSED" ? "info" : e.status === "ARCHIVED" ? "neutral" : "warning"}
        />
      ),
    },
    {
      header: "Election Date",
      cell: (e) => e.electionDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    },
    { header: "Parties", cell: (e) => e._count.parties },
    { header: "Candidates", cell: (e) => e._count.candidates },
    {
      header: "Actions",
      cell: (e) => (
        <Link href={`/elections/${e.id}`} className="text-xs font-medium text-eiq-blue">
          View →
        </Link>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Elections"
        actions={
          <div className="flex items-center gap-3">
            <Link href="/elections/candidates" className="text-sm font-medium text-eiq-blue">
              Candidates
            </Link>
            <Link href="/elections/parties" className="text-sm font-medium text-eiq-blue">
              Parties
            </Link>
            {canCreate ? (
              <Link
                href="/elections/new"
                className="flex items-center gap-1.5 rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                Create Election
              </Link>
            ) : undefined}
          </div>
        }
      />
      <FilterBar
        param="status"
        options={[
          { label: "All Elections", value: "all" },
          { label: "Active", value: "active" },
          { label: "Completed", value: "completed" },
          { label: "Archived", value: "archived" },
        ]}
      />
      <DataTable columns={columns} rows={elections} rowKey={(e) => e.id} emptyMessage="No elections configured yet." />
    </AppShell>
  );
}
