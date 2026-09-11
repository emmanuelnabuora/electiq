import Link from "next/link";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { createPollingStation } from "@/lib/actions/geography";

const PAGE_SIZE = 20;

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
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view polling infrastructure (
          <code>elections.read</code>).
        </CardContent>
      </Card>
    );
  }

  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = searchParams.q?.trim() ?? "";

  // Never send the whole table to the browser (Section 24) — page and,
  // when searching, filter server-side before anything is sent down.
  const where = q
    ? {
        OR: [
          { code: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { pollingCenter: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [total, stations, wards] = await Promise.all([
    db.pollingStation.count({ where }),
    db.pollingStation.findMany({
      where,
      include: { pollingCenter: { include: { unit: { include: { parent: { include: { parent: true } } } } } } },
      orderBy: { code: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    canManage
      ? db.administrativeUnit.findMany({
          where: { level: { depth: 2 } },
          include: { parent: { include: { parent: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-light">Polling Stations</h1>
          <p className="text-sm text-neutral">{total.toLocaleString("en-US")} total</p>
        </div>
        {canManage && (
          <Link href="/command-center/polling-stations/import">
            <Button>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </Link>
        )}
      </div>

      <form className="flex gap-2" action="/command-center/polling-stations">
        <Input name="q" defaultValue={q} placeholder="Search by code, station, or center name" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Code</th>
                <th className="py-2 font-medium">Station</th>
                <th className="py-2 font-medium">Polling Center</th>
                <th className="py-2 font-medium">Ward / Constituency / Region</th>
                <th className="py-2 font-medium">Registered Voters</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => {
                const ward = s.pollingCenter.unit;
                const constituency = ward.parent;
                const region = constituency?.parent;
                return (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2 text-neutral">{s.code}</td>
                    <td className="py-2 text-light">{s.name}</td>
                    <td className="py-2 text-neutral">{s.pollingCenter.name}</td>
                    <td className="py-2 text-neutral">
                      {ward.name} / {constituency?.name ?? "—"} / {region?.name ?? "—"}
                    </td>
                    <td className="py-2 text-neutral">
                      {s.registeredVoters.toLocaleString("en-US")}
                    </td>
                  </tr>
                );
              })}
              {stations.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-neutral">
                    No polling stations match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-neutral">
          <Link
            href={`/command-center/polling-stations?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={page <= 1 ? "pointer-events-none opacity-40" : "hover:text-light"}
          >
            Previous
          </Link>
          <span>
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/command-center/polling-stations?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={page >= totalPages ? "pointer-events-none opacity-40" : "hover:text-light"}
          >
            Next
          </Link>
        </div>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add a single polling station</CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <form action={createPollingStation} className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                name="wardId"
                required
                className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light md:col-span-3"
              >
                <option value="">Select a ward…</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.parent?.parent?.name} / {w.parent?.name} / {w.name}
                  </option>
                ))}
              </select>
              <Input name="centerCode" placeholder="Polling center code" required />
              <Input name="centerName" placeholder="Polling center name" required />
              <div />
              <Input name="stationCode" placeholder="Polling station code" required />
              <Input name="stationName" placeholder="Polling station name" required />
              <Input name="registeredVoters" type="number" min={0} placeholder="Registered voters" required />
              <Input name="latitude" type="number" step="any" placeholder="Latitude (optional)" />
              <Input name="longitude" type="number" step="any" placeholder="Longitude (optional)" />
              <Button type="submit">Add station</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
