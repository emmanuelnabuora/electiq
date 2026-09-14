import Link from "next/link";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { listAuditLogs, listAuditActorsAndActions } from "@/lib/actions/audit-logs";
import { Card, CardContent } from "@/components/ui/card";
import type { AuditAction } from "@/generated/prisma/client";

export default async function AuditLogsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ page?: string; action?: string; actorId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "audit", "read");

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view audit logs (<code>audit.read</code>).
        </CardContent>
      </Card>
    );
  }

  const page = Number(searchParams.page ?? "1") || 1;
  const action = (searchParams.action as AuditAction | undefined) || undefined;
  const actorId = searchParams.actorId || undefined;

  const [{ rows, total, totalPages }, { actors, actions }] = await Promise.all([
    listAuditLogs({ page, action, actorId }),
    listAuditActorsAndActions(),
  ]);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (action) params.set("action", action);
    if (actorId) params.set("actorId", actorId);
    return `?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-light">Audit Logs</h1>
          <p className="text-sm text-neutral">{total.toLocaleString("en-US")} recorded events.</p>
        </div>
        <Link href="/command-center/security" className="text-sm text-accent hover:underline">
          Verify chain integrity →
        </Link>
      </div>

      <Card>
        <CardContent className="py-3">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral">Action</label>
              <select name="action" defaultValue={action ?? ""} className="rounded-md border border-white/10 bg-navy-secondary px-2 py-1.5 text-sm text-light">
                <option value="">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral">Actor</label>
              <select name="actorId" defaultValue={actorId ?? ""} className="rounded-md border border-white/10 bg-navy-secondary px-2 py-1.5 text-sm text-light">
                <option value="">All actors</option>
                {actors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
              Filter
            </button>
            {(action || actorId) && (
              <Link href="/command-center/audit-logs" className="text-sm text-neutral hover:text-light">
                Clear
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">When</th>
                <th className="py-2 font-medium">Actor</th>
                <th className="py-2 font-medium">Action</th>
                <th className="py-2 font-medium">Entity</th>
                <th className="py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 align-top">
                  <td className="py-2 whitespace-nowrap text-neutral">
                    {r.createdAt.toLocaleString("en-US")}
                  </td>
                  <td className="py-2 text-light">{r.actor?.name ?? "System"}</td>
                  <td className="py-2 text-neutral">{r.action}</td>
                  <td className="py-2 text-neutral">
                    {r.entityType ? `${r.entityType}${r.entityId ? ` #${r.entityId.slice(0, 8)}` : ""}` : "—"}
                  </td>
                  <td className="py-2 text-neutral">{r.reason ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-neutral">
                    No matching audit events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            className={page <= 1 ? "pointer-events-none text-neutral/30" : "text-accent hover:underline"}
          >
            ← Previous
          </Link>
          <span className="text-neutral">
            Page {page} of {totalPages}
          </span>
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            className={page >= totalPages ? "pointer-events-none text-neutral/30" : "text-accent hover:underline"}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
