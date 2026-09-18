import Link from "next/link";
import { Upload, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui-v2/StatCard";
import { DataTable, type DataTableColumn } from "@/components/ui-v2/DataTable";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { createPollingStation } from "@/lib/actions/geography";
import { getCurrentElectionId } from "@/lib/elections/current";
import { getResultsAggregate } from "@/lib/results/aggregation";
import { Building2, CheckCircle2, AlertTriangle, MapPin } from "lucide-react";

const PAGE_SIZE = 20;

type StationRow = Awaited<ReturnType<typeof loadStations>>["stations"][number] & {
  hasOpenIncident: boolean;
  hasPublished: boolean;
};

async function loadStations(where: object, page: number) {
  const [total, stations] = await Promise.all([
    db.pollingStation.count({ where }),
    db.pollingStation.findMany({
      where,
      include: { pollingCenter: { include: { unit: { include: { parent: { include: { parent: true } } } } } } },
      orderBy: { code: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { total, stations };
}

export default async function PollingStationsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "elections", "read");
  const canManage = await authorize(userId, "geography", "manage");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Polling Stations" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view polling infrastructure (elections.read).
        </p>
      </AppShell>
    );
  }

  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = searchParams.q?.trim() ?? "";

  const where = q
    ? {
        OR: [
          { code: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { pollingCenter: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [{ total, stations }, wards, electionId] = await Promise.all([
    loadStations(where, page),
    canManage
      ? db.administrativeUnit.findMany({
          where: { level: { depth: 2 } },
          include: { parent: { include: { parent: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    getCurrentElectionId(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stationIds = stations.map((s) => s.id);

  // Real, derived status for just this page's stations -- not a
  // fabricated "operational status" field (none exists on
  // PollingStation), computed from actual Incident and
  // ResultSubmission records instead. "Issues" = at least one
  // unresolved incident tied to the station; "Reporting" = a
  // PUBLISHED submission exists for the current election's reference
  // position, the same reference position getResultsAggregate uses
  // everywhere else in this app.
  const [openIncidentStationIds, publishedStationIds, aggregate, totalCount, configuredCount, issueCount] =
    await Promise.all([
      db.incident
        .findMany({
          where: { pollingStationId: { in: stationIds }, status: { notIn: ["RESOLVED", "DISMISSED"] } },
          select: { pollingStationId: true },
          distinct: ["pollingStationId"],
        })
        .then((rows) => new Set(rows.map((r) => r.pollingStationId))),
      electionId
        ? db.resultSubmission
            .findMany({
              where: { pollingStationId: { in: stationIds }, electionId, status: "PUBLISHED" },
              select: { pollingStationId: true },
              distinct: ["pollingStationId"],
            })
            .then((rows) => new Set(rows.map((r) => r.pollingStationId)))
        : Promise.resolve(new Set<string>()),
      electionId ? getResultsAggregate(electionId) : Promise.resolve(null),
      db.pollingStation.count(),
      db.pollingCenter.count({ where: { latitude: { not: null }, longitude: { not: null } } }),
      db.incident
        .findMany({
          where: { status: { notIn: ["RESOLVED", "DISMISSED"] }, pollingStationId: { not: null } },
          select: { pollingStationId: true },
          distinct: ["pollingStationId"],
        })
        .then((rows) => rows.length),
    ]);

  const rows: StationRow[] = stations.map((s) => ({
    ...s,
    hasOpenIncident: openIncidentStationIds.has(s.id),
    hasPublished: publishedStationIds.has(s.id),
  }));

  const columns: DataTableColumn<StationRow>[] = [
    { header: "Station Code", cell: (s) => s.code },
    { header: "Polling Station", cell: (s) => s.name },
    {
      header: "County / Constituency / Ward",
      cell: (s) => {
        const ward = s.pollingCenter.unit;
        const constituency = ward.parent;
        const region = constituency?.parent;
        return `${region?.name ?? "—"} / ${constituency?.name ?? "—"} / ${ward.name}`;
      },
    },
    { header: "Registered Voters", cell: (s) => s.registeredVoters.toLocaleString("en-US") },
    {
      header: "Operational Status",
      cell: (s) => (
        <StatusBadge status={s.hasOpenIncident ? "Issue Reported" : "Operational"} tone={s.hasOpenIncident ? "warning" : "success"} />
      ),
    },
    {
      header: "Reporting Status",
      cell: (s) => (
        <StatusBadge status={s.hasPublished ? "Reported" : "Not Yet Reported"} tone={s.hasPublished ? "success" : "neutral"} />
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Polling Stations"
        subtitle={`${total.toLocaleString("en-US")} total`}
        actions={
          canManage ? (
            <Link
              href="/polling-stations/import"
              className="flex items-center gap-1.5 rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm font-medium text-eiq-text-primary"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Stations" value={totalCount.toLocaleString("en-US")} icon={Building2} />
        <StatCard label="Operational" value={(totalCount - issueCount).toLocaleString("en-US")} icon={CheckCircle2} />
        <StatCard label="Issues" value={issueCount.toLocaleString("en-US")} icon={AlertTriangle} sublabel="Have an unresolved incident" />
        <StatCard
          label="Configured"
          value={configuredCount.toLocaleString("en-US")}
          icon={MapPin}
          sublabel="Polling centers with coordinates"
        />
      </div>

      <form className="mb-4 flex gap-2" action="/polling-stations">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by code, station, or center name"
          className="flex-1 rounded-md border border-eiq-border px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm font-medium text-eiq-text-primary">
          Search
        </button>
      </form>

      <DataTable columns={columns} rows={rows} rowKey={(s) => s.id} emptyMessage="No polling stations match." />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-eiq-text-secondary">
          <Link
            href={`/polling-stations?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={page <= 1 ? "pointer-events-none opacity-40" : "hover:text-eiq-text-primary"}
          >
            Previous
          </Link>
          <span>
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/polling-stations?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={page >= totalPages ? "pointer-events-none opacity-40" : "hover:text-eiq-text-primary"}
          >
            Next
          </Link>
        </div>
      )}

      {canManage && (
        <div className="mt-6 rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Add a single polling station</h2>
          <form action={createPollingStation} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select name="wardId" required className="rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm text-eiq-text-primary md:col-span-3">
              <option value="">Select a ward…</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.parent?.parent?.name} / {w.parent?.name} / {w.name}
                </option>
              ))}
            </select>
            <input name="centerCode" placeholder="Polling center code" required className="rounded-md border border-eiq-border px-3 py-2 text-sm" />
            <input name="centerName" placeholder="Polling center name" required className="rounded-md border border-eiq-border px-3 py-2 text-sm" />
            <div />
            <input name="stationCode" placeholder="Polling station code" required className="rounded-md border border-eiq-border px-3 py-2 text-sm" />
            <input name="stationName" placeholder="Polling station name" required className="rounded-md border border-eiq-border px-3 py-2 text-sm" />
            <input name="registeredVoters" type="number" min={0} placeholder="Registered voters" required className="rounded-md border border-eiq-border px-3 py-2 text-sm" />
            <input name="latitude" type="number" step="any" placeholder="Latitude (optional)" className="rounded-md border border-eiq-border px-3 py-2 text-sm" />
            <input name="longitude" type="number" step="any" placeholder="Longitude (optional)" className="rounded-md border border-eiq-border px-3 py-2 text-sm" />
            <button type="submit" className="flex items-center gap-1.5 self-start rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              Add station
            </button>
          </form>
        </div>
      )}
    </AppShell>
  );
}
