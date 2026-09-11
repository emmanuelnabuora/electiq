import Link from "next/link";
import { requireSession } from "@/lib/session";
import { authorize, resolveUserScope } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getWardUnitIdForAlert } from "@/lib/integrity/scope";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SEVERITY_TONE = {
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "warning",
  CRITICAL: "critical",
} as const;

const STATUS_TONE = {
  OPEN: "critical",
  UNDER_REVIEW: "warning",
  RESOLVED: "success",
  DISMISSED: "neutral",
} as const;

export default async function IntegrityAlertsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ status?: string; severity?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "integrity", "read");
  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view integrity alerts (<code>integrity.read</code>).
        </CardContent>
      </Card>
    );
  }

  const scope = await resolveUserScope(userId);

  const alerts = await db.integrityAlert.findMany({
    where: {
      ...(searchParams.status ? { status: searchParams.status as never } : {}),
      ...(searchParams.severity ? { severity: searchParams.severity as never } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  const scopedAlerts = scope.isNational
    ? alerts
    : (
        await Promise.all(
          alerts.map(async (a) => {
            const wardUnitId = await getWardUnitIdForAlert(a.entityType, a.entityId);
            return wardUnitId && scope.unitIds.includes(wardUnitId) ? a : null;
          })
        )
      ).filter((a): a is NonNullable<typeof a> => a !== null);

  const openCount = scopedAlerts.filter((a) => a.status === "OPEN").length;
  const criticalCount = scopedAlerts.filter(
    (a) => a.severity === "CRITICAL" && a.status !== "RESOLVED" && a.status !== "DISMISSED"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-light">Integrity Alerts</h1>
        <p className="text-sm text-neutral">
          {openCount} open · {criticalCount} unresolved critical. An alert flags a pattern requiring
          verification — it is never a determination of fraud.
        </p>
      </div>

      <div className="flex gap-2">
        {["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"].map((s) => (
          <Link
            key={s}
            href={`/command-center/integrity?status=${s}`}
            className={`rounded-md px-2.5 py-1 text-xs ${
              searchParams.status === s ? "bg-accent text-white" : "bg-white/5 text-neutral hover:text-light"
            }`}
          >
            {s.replace("_", " ")}
          </Link>
        ))}
        {searchParams.status && (
          <Link href="/command-center/integrity" className="rounded-md px-2.5 py-1 text-xs text-neutral hover:text-light">
            Clear
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Rule</th>
                <th className="py-2 font-medium">Severity</th>
                <th className="py-2 font-medium">Explanation</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Raised</th>
              </tr>
            </thead>
            <tbody>
              {scopedAlerts.map((a) => (
                <tr key={a.id} className="border-t border-white/5">
                  <td className="py-2">
                    <Link href={`/command-center/integrity/${a.id}`} className="text-light hover:text-accent">
                      {a.rule.replace(/_/g, " ")}
                    </Link>
                  </td>
                  <td className="py-2">
                    <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
                  </td>
                  <td className="py-2 max-w-md truncate text-neutral">{a.explanation}</td>
                  <td className="py-2">
                    <Badge tone={STATUS_TONE[a.status]}>{a.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="py-2 text-neutral">{a.createdAt.toLocaleString("en-US")}</td>
                </tr>
              ))}
              {scopedAlerts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-neutral">
                    No integrity alerts within your scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
