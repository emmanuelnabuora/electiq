import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getWardUnitIdForAlert } from "@/lib/integrity/scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { claimAlert, resolveAlert, dismissAlert } from "@/lib/actions/integrity";
import { AppShell } from "@/components/layout/AppShell";

const SEVERITY_TONE = { LOW: "neutral", MEDIUM: "warning", HIGH: "warning", CRITICAL: "critical" } as const;
const STATUS_TONE = { OPEN: "critical", UNDER_REVIEW: "warning", RESOLVED: "success", DISMISSED: "neutral" } as const;

/**
 * Moved here from /command-center/integrity/[id] as part of the UI
 * redesign. Not restyled internally, same reasoning as every other
 * review-workflow page moved so far. Already uses careful, neutral
 * language throughout (checked directly: "not a conclusion of
 * wrongdoing" in its own review-notes prompt) -- nothing to change for
 * the "never label as fraud" requirement. Fixed one real stale link:
 * this page linked to a result submission at its old
 * /command-center/results/[id] location, which moved to
 * /results/submissions/[id] in the Screen 3 pass.
 */
export default async function IntegrityAlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "integrity", "read");
  if (!canRead) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-6 text-sm text-neutral">
            Your role does not include permission to view integrity alerts (<code>integrity.read</code>).
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const alert = await db.integrityAlert.findUnique({
    where: { id },
    include: { assignedTo: { select: { name: true } } },
  });
  if (!alert) notFound();

  const wardUnitId = await getWardUnitIdForAlert(alert.entityType, alert.entityId);
  const canReview = await authorize(userId, "integrity", "review", wardUnitId ?? undefined);

  let linkedSubmission: {
    id: string;
    version: number;
    pollingStation: { name: string };
    position: { name: string };
  } | null = null;
  if (alert.entityType === "ResultSubmission") {
    linkedSubmission = await db.resultSubmission.findUnique({
      where: { id: alert.entityId },
      select: { id: true, version: true, pollingStation: { select: { name: true } }, position: { select: { name: true } } },
    });
  }

  return (
    <AppShell>
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-light">{alert.rule.replace(/_/g, " ")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral">{alert.explanation}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</Badge>
          <Badge tone={STATUS_TONE[alert.status]}>{alert.status.replace("_", " ")}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <pre className="overflow-x-auto rounded-md bg-navy-secondary p-3 text-xs text-light">
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked record</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 py-4 text-sm">
            <p className="text-neutral">
              Entity: <span className="text-light">{alert.entityType}</span>
            </p>
            {linkedSubmission ? (
              <a
                href={`/results/submissions/${linkedSubmission.id}`}
                className="text-accent hover:underline"
              >
                {linkedSubmission.pollingStation.name} — {linkedSubmission.position.name} (version{" "}
                {linkedSubmission.version})
              </a>
            ) : (
              <p className="text-neutral">Entity ID: {alert.entityId}</p>
            )}
            <p className="text-neutral">Raised: {alert.createdAt.toLocaleString("en-US")}</p>
            {alert.assignedTo && <p className="text-neutral">Assigned to: {alert.assignedTo.name}</p>}
            {alert.reviewNotes && (
              <div className="mt-2 rounded-md border border-white/5 p-2">
                <p className="text-xs text-neutral">Review notes</p>
                <p className="text-light">{alert.reviewNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {canReview && alert.status !== "RESOLVED" && alert.status !== "DISMISSED" && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 py-4">
            {alert.status === "OPEN" && (
              <form action={claimAlert}>
                <input type="hidden" name="alertId" value={alert.id} />
                <Button type="submit" variant="secondary">
                  Claim for review
                </Button>
              </form>
            )}
            <form action={resolveAlert} className="flex flex-col gap-2">
              <input type="hidden" name="alertId" value={alert.id} />
              <label className="text-xs text-neutral">Review notes (required)</label>
              <textarea
                name="reviewNotes"
                rows={2}
                required
                placeholder="What was checked and what was found — not a conclusion of wrongdoing."
                className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
              />
              <div className="flex gap-2">
                <Button type="submit">Mark resolved</Button>
                <Button type="submit" formAction={dismissAlert} variant="secondary">
                  Dismiss
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
    </AppShell>
  );
}
