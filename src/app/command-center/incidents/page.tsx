import Link from "next/link";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reportIncident } from "@/lib/actions/incidents";

const SEVERITY_TONE = { LOW: "neutral", MEDIUM: "warning", HIGH: "warning", CRITICAL: "critical" } as const;
const STATUS_TONE = { OPEN: "critical", ACKNOWLEDGED: "warning", UNDER_REVIEW: "warning", RESOLVED: "success", DISMISSED: "neutral" } as const;

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "incidents", "read");
  const canCreate = await authorize(userId, "incidents", "create");

  if (!canRead && !canCreate) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view or report incidents.
        </CardContent>
      </Card>
    );
  }

  const currentElectionId = await getCurrentElectionId();
  const election = currentElectionId ? await db.election.findUnique({ where: { id: currentElectionId } }) : null;

  const incidents = canRead
    ? await db.incident.findMany({
        where: searchParams.status ? { status: searchParams.status as never } : {},
        include: { pollingStation: true, reportedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  const stations = canCreate ? await db.pollingStation.findMany({ orderBy: { code: "asc" }, take: 200 }) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-light">Incidents</h1>
        <p className="text-sm text-neutral">Field-reported operational incidents.</p>
      </div>

      {canRead && (
        <>
          <div className="flex gap-2">
            {["OPEN", "ACKNOWLEDGED", "UNDER_REVIEW", "RESOLVED", "DISMISSED"].map((s) => (
              <Link
                key={s}
                href={`/command-center/incidents?status=${s}`}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  searchParams.status === s ? "bg-accent text-white" : "bg-white/5 text-neutral hover:text-light"
                }`}
              >
                {s.replace("_", " ")}
              </Link>
            ))}
            {searchParams.status && (
              <Link href="/command-center/incidents" className="rounded-md px-2.5 py-1 text-xs text-neutral hover:text-light">
                Clear
              </Link>
            )}
          </div>

          <Card>
            <CardContent className="py-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-neutral">
                    <th className="py-2 font-medium">Title</th>
                    <th className="py-2 font-medium">Station</th>
                    <th className="py-2 font-medium">Severity</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((i) => (
                    <tr key={i.id} className="border-t border-white/5">
                      <td className="py-2">
                        <Link href={`/command-center/incidents/${i.id}`} className="text-light hover:text-accent">
                          {i.title}
                        </Link>
                      </td>
                      <td className="py-2 text-neutral">{i.pollingStation?.code ?? "—"}</td>
                      <td className="py-2">
                        <Badge tone={SEVERITY_TONE[i.severity]}>{i.severity}</Badge>
                      </td>
                      <td className="py-2">
                        <Badge tone={STATUS_TONE[i.status]}>{i.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="py-2 text-neutral">{i.createdAt.toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                  {incidents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-neutral">
                        No incidents reported.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {canCreate && election && (
        <Card>
          <CardContent className="py-4">
            <p className="mb-3 text-sm font-medium text-light">Report an incident</p>
            <form action={reportIncident} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input type="hidden" name="electionId" value={election.id} />
              <input name="title" placeholder="Short title" required className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light md:col-span-2" />
              <textarea name="description" placeholder="What happened" required rows={3} className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light md:col-span-2" />
              <select name="severity" required className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
              <select name="pollingStationId" className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light">
                <option value="">No specific polling station</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
              <Button type="submit" className="md:col-span-2">
                Report incident
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
