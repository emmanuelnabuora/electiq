import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { getObserverProfile } from "@/lib/field/scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { assignObserver, acceptAssignment, checkIn } from "@/lib/actions/field";
import { FieldReportForm } from "@/components/field/field-report-form";
import { AppShell } from "@/components/layout/AppShell";

const STATUS_TONE = {
  ASSIGNED: "neutral",
  ACCEPTED: "accent",
  CHECKED_IN: "success",
  COMPLETED: "success",
  CANCELLED: "critical",
} as const;

/**
 * Moved here from /command-center/field as part of the UI redesign.
 * This drives real observer accept/check-in/report-submission actions
 * and admin assignment creation -- not restyled internally in this
 * pass, for the same reason as the results verify/approve/publish page:
 * real workflow logic, safer to move without rewriting alongside
 * several other screens. Wrapped in the new AppShell for consistent
 * navigation.
 */
export default async function FieldAssignmentsPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const canManage = await authorize(userId, "field", "manage");
  const observer = await getObserverProfile(userId);

  const currentElectionId = await getCurrentElectionId();
  const election = currentElectionId ? await db.election.findUnique({ where: { id: currentElectionId } }) : null;

  const myAssignments = observer
    ? await db.observerAssignment.findMany({
        where: { observerId: observer.id },
        include: { pollingStation: { include: { pollingCenter: { include: { unit: true } } } } },
        orderBy: { assignedAt: "desc" },
      })
    : [];

  const allAssignments = canManage
    ? await db.observerAssignment.findMany({
        include: {
          observer: { include: { user: { select: { name: true, email: true } } } },
          pollingStation: true,
        },
        orderBy: { assignedAt: "desc" },
        take: 100,
      })
    : [];

  const observerUsers = canManage
    ? await db.userRole.findMany({
        where: { role: { name: "OBSERVER" } },
        include: { user: { select: { id: true, name: true, email: true } } },
      })
    : [];

  const stations = canManage
    ? await db.pollingStation.findMany({ orderBy: { code: "asc" }, take: 200 })
    : [];

  if (!observer && !canManage) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-6 text-sm text-neutral">
            Field operations are available to accredited observers and to roles with{" "}
            <code>field.manage</code>. You have neither on this account.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-light">Field Operations</h1>
        <p className="text-sm text-neutral">
          Observer assignments, polling-station check-in, and field reporting.
        </p>
      </div>

      {observer && (
        <div className="flex flex-col gap-4">
          {myAssignments.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{a.pollingStation.name} ({a.pollingStation.code})</CardTitle>
                  <Badge tone={STATUS_TONE[a.status]}>{a.status.replace("_", " ")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 py-4">
                <p className="text-sm text-neutral">
                  {a.pollingStation.pollingCenter.unit.name} · {a.pollingStation.pollingCenter.name}
                </p>

                {a.status === "ASSIGNED" && (
                  <form action={acceptAssignment}>
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <Button type="submit">Accept assignment</Button>
                  </form>
                )}

                {a.status === "ACCEPTED" && (
                  <form action={checkIn}>
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <Button type="submit">Check in</Button>
                  </form>
                )}

                {(a.status === "CHECKED_IN" || a.status === "COMPLETED") && election && (
                  <FieldReportForm assignmentId={a.id} electionId={election.id} />
                )}
              </CardContent>
            </Card>
          ))}
          {myAssignments.length === 0 && (
            <Card>
              <CardContent className="py-6 text-sm text-neutral">
                No assignments yet.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {canManage && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Assign an observer</CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <form action={assignObserver} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  name="userId"
                  required
                  className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
                >
                  <option value="">Select an observer…</option>
                  {observerUsers.map((ur) => (
                    <option key={ur.user.id} value={ur.user.id}>
                      {ur.user.name} ({ur.user.email})
                    </option>
                  ))}
                </select>
                <select
                  name="pollingStationId"
                  required
                  className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
                >
                  <option value="">Select a polling station…</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
                <input name="organization" placeholder="Organization (optional)" className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light" />
                <input name="accreditationNumber" placeholder="Accreditation number (optional)" className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light" />
                <Button type="submit">Assign</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All assignments</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-neutral">
                    <th className="py-2 font-medium">Observer</th>
                    <th className="py-2 font-medium">Station</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {allAssignments.map((a) => (
                    <tr key={a.id} className="border-t border-white/5">
                      <td className="py-2 text-light">{a.observer.user.name}</td>
                      <td className="py-2 text-neutral">{a.pollingStation.code}</td>
                      <td className="py-2">
                        <Badge tone={STATUS_TONE[a.status]}>{a.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="py-2 text-neutral">{a.assignedAt.toLocaleDateString("en-US")}</td>
                    </tr>
                  ))}
                  {allAssignments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-neutral">
                        No assignments yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </AppShell>
  );
}
