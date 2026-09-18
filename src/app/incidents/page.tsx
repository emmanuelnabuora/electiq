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

const SEVERITY_TONE = { LOW: "neutral", MEDIUM: "warning", HIGH: "warning", CRITICAL: "critical" } as const;
const STATUS_TONE = {
  OPEN: "critical",
  ACKNOWLEDGED: "warning",
  UNDER_REVIEW: "warning",
  RESOLVED: "success",
  DISMISSED: "neutral",
} as const;

type IncidentRow = Awaited<ReturnType<typeof loadIncidents>>[number];

async function loadIncidents(tab: string) {
  const where =
    tab === "open"
      ? { status: "OPEN" as const }
      : tab === "investigating"
        ? { status: { in: ["ACKNOWLEDGED", "UNDER_REVIEW"] as ("ACKNOWLEDGED" | "UNDER_REVIEW")[] } }
        : tab === "resolved"
          ? { status: { in: ["RESOLVED", "DISMISSED"] as ("RESOLVED" | "DISMISSED")[] } }
          : {};

  return db.incident.findMany({
    where,
    include: { pollingStation: { include: { pollingCenter: { include: { unit: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export default async function IncidentsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "incidents", "read");
  const canCreate = await authorize(userId, "incidents", "create");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Incidents" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view incidents (incidents.read).
        </p>
      </AppShell>
    );
  }

  const tab = searchParams.tab ?? "all";
  const incidents = await loadIncidents(tab);

  const columns: DataTableColumn<IncidentRow>[] = [
    {
      header: "Type",
      cell: (i) => (
        <Link href={`/incidents/${i.id}`} className="font-medium text-eiq-blue hover:underline">
          {i.title}
        </Link>
      ),
    },
    {
      header: "Location",
      cell: (i) => (
        <div>
          <p>{i.pollingStation?.pollingCenter.unit.name ?? "—"}</p>
          {i.pollingStation && <p className="text-xs text-eiq-text-secondary">{i.pollingStation.code}</p>}
        </div>
      ),
    },
    {
      header: "Severity",
      cell: (i) => <StatusBadge status={i.severity} tone={SEVERITY_TONE[i.severity]} />,
    },
    {
      header: "Status",
      cell: (i) => <StatusBadge status={i.status} tone={STATUS_TONE[i.status]} />,
    },
    {
      header: "Reported",
      cell: (i) => i.createdAt.toLocaleString("en-US"),
    },
    {
      header: "Actions",
      cell: (i) => (
        <Link href={`/incidents/${i.id}`} className="text-xs font-medium text-eiq-blue">
          View →
        </Link>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Incidents"
        actions={
          canCreate ? (
            <Link
              href="/incidents/new"
              className="flex items-center gap-1.5 rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Report Incident
            </Link>
          ) : undefined
        }
      />
      <FilterBar
        param="tab"
        options={[
          { label: "All", value: "all" },
          { label: "Open", value: "open" },
          { label: "Investigating", value: "investigating" },
          { label: "Resolved", value: "resolved" },
        ]}
      />
      <DataTable columns={columns} rows={incidents} rowKey={(i) => i.id} emptyMessage="No incidents reported." />
    </AppShell>
  );
}
