import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui-v2/StatCard";
import { FilterBar } from "@/components/ui-v2/FilterBar";
import { DataTable, type DataTableColumn } from "@/components/ui-v2/DataTable";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { requireSession } from "@/lib/session";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getWardUnitIdForAlert } from "@/lib/integrity/scope";
import { ShieldAlert, AlertTriangle, Eye, CheckCircle2 } from "lucide-react";

const SEVERITY_TONE = { LOW: "neutral", MEDIUM: "warning", HIGH: "warning", CRITICAL: "critical" } as const;
const STATUS_TONE = { OPEN: "critical", UNDER_REVIEW: "warning", RESOLVED: "success", DISMISSED: "neutral" } as const;

type AlertWithLocation = Awaited<ReturnType<typeof loadAlerts>>[number];

async function loadAlerts(riskTab: string, statusFilter: string, scope: Awaited<ReturnType<typeof resolveUserScope>>) {
  const where = {
    ...(riskTab === "high"
      ? { severity: { in: ["HIGH", "CRITICAL"] as ("HIGH" | "CRITICAL")[] } }
      : riskTab === "medium"
        ? { severity: "MEDIUM" as const }
        : riskTab === "low"
          ? { severity: "LOW" as const }
          : {}),
    ...(statusFilter !== "all" ? { status: statusFilter as "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED" } : {}),
  };

  const alerts = await db.integrityAlert.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });

  const withLocation = await Promise.all(
    alerts.map(async (a) => {
      const wardUnitId = await getWardUnitIdForAlert(a.entityType, a.entityId);
      const unit = wardUnitId ? await db.administrativeUnit.findUnique({ where: { id: wardUnitId } }) : null;
      return { ...a, wardUnitId, locationName: unit?.name ?? null };
    })
  );

  return scope.isNational
    ? withLocation
    : withLocation.filter((a) => a.wardUnitId && scope.unitIds.includes(a.wardUnitId));
}

export default async function IntegrityAlertsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ risk?: string; status?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "integrity", "read");
  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Integrity Alerts" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view integrity alerts (integrity.read).
        </p>
      </AppShell>
    );
  }

  const scope = await resolveUserScope(userId);
  const riskTab = searchParams.risk ?? "all";
  const statusFilter = searchParams.status ?? "all";
  const alerts = await loadAlerts(riskTab, statusFilter, scope);

  const openCount = alerts.filter((a) => a.status === "OPEN").length;
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL" && a.status !== "RESOLVED" && a.status !== "DISMISSED").length;
  const underReviewCount = alerts.filter((a) => a.status === "UNDER_REVIEW").length;
  const resolvedCount = alerts.filter((a) => a.status === "RESOLVED").length;

  const columns: DataTableColumn<AlertWithLocation>[] = [
    {
      header: "Risk Level",
      cell: (a) => <StatusBadge status={a.severity} tone={SEVERITY_TONE[a.severity]} />,
    },
    {
      header: "Description",
      cell: (a) => (
        <Link href={`/integrity/${a.id}`} className="font-medium text-eiq-blue hover:underline">
          {a.rule.replace(/_/g, " ")}
        </Link>
      ),
      className: "max-w-xs truncate px-4 py-3 text-eiq-text-primary",
    },
    {
      header: "Explanation",
      cell: (a) => a.explanation,
      className: "max-w-md truncate px-4 py-3 text-eiq-text-secondary",
    },
    { header: "Location", cell: (a) => a.locationName ?? "—" },
    { header: "Detected", cell: (a) => a.createdAt.toLocaleString("en-US") },
    {
      header: "Status",
      cell: (a) => <StatusBadge status={a.status} tone={STATUS_TONE[a.status]} />,
    },
    {
      header: "Actions",
      cell: (a) => (
        <Link href={`/integrity/${a.id}`} className="text-xs font-medium text-eiq-blue">
          View →
        </Link>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Integrity Alerts"
        subtitle="An alert flags a pattern requiring verification -- it is never a determination of fraud. Human review required before any finding is made."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open Alerts" value={openCount} icon={ShieldAlert} />
        <StatCard label="Critical" value={criticalCount} icon={AlertTriangle} />
        <StatCard label="Under Review" value={underReviewCount} icon={Eye} />
        <StatCard label="Resolved" value={resolvedCount} icon={CheckCircle2} />
      </div>

      <FilterBar
        param="risk"
        options={[
          { label: "All", value: "all" },
          { label: "High Risk", value: "high" },
          { label: "Medium Risk", value: "medium" },
          { label: "Low Risk", value: "low" },
        ]}
      />

      {/*
        Restored: the pre-redesign Integrity Alerts page filtered by
        status (OPEN/UNDER_REVIEW/RESOLVED/DISMISSED) as its only filter.
        The approved design's risk-tier tabs above were built as a
        genuinely new, additional way to filter, not a replacement for
        status filtering -- dropping it during the move would have been
        exactly the kind of silent capability loss the redesign was
        never supposed to cause.
      */}
      <FilterBar
        param="status"
        options={[
          { label: "All Statuses", value: "all" },
          { label: "Open", value: "OPEN" },
          { label: "Under Review", value: "UNDER_REVIEW" },
          { label: "Resolved", value: "RESOLVED" },
          { label: "Dismissed", value: "DISMISSED" },
        ]}
      />

      <DataTable columns={columns} rows={alerts} rowKey={(a) => a.id} emptyMessage="No integrity alerts within your scope." />
    </AppShell>
  );
}
