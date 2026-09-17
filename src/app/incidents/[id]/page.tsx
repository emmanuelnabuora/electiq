import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getWardUnitIdForIncident } from "@/lib/field/scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { acknowledgeIncident, resolveIncident, dismissIncident } from "@/lib/actions/incidents";
import { IncidentEvidenceUpload } from "@/components/field/incident-evidence-upload";
import { AppShell } from "@/components/layout/AppShell";

const SEVERITY_TONE = { LOW: "neutral", MEDIUM: "warning", HIGH: "warning", CRITICAL: "critical" } as const;
const STATUS_TONE = { OPEN: "critical", ACKNOWLEDGED: "warning", UNDER_REVIEW: "warning", RESOLVED: "success", DISMISSED: "neutral" } as const;

/**
 * Moved here from /command-center/incidents/[id] as part of the UI
 * redesign. Not restyled internally in this pass, same reasoning as
 * the results verify/publish and field-assignments pages: real
 * acknowledge/resolve/dismiss review workflow plus evidence upload,
 * safer moved than rewritten alongside several other screens in one
 * pass. Wrapped in the new AppShell for consistent navigation. Already
 * uses neutral terminology throughout (Report / Acknowledge / Resolve
 * / Dismiss / Review notes) -- checked directly, no "fraud" language
 * anywhere to remove.
 */
export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "incidents", "read");
  if (!canRead) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-6 text-sm text-neutral">
            Your role does not include permission to view incidents (<code>incidents.read</code>).
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const incident = await db.incident.findUnique({
    where: { id },
    include: {
      pollingStation: true,
      reportedBy: { select: { name: true } },
      evidence: true,
    },
  });
  if (!incident) notFound();

  const wardUnitId = await getWardUnitIdForIncident(incident.id);
  const canReview = await authorize(userId, "incidents", "review", wardUnitId ?? undefined);
  const canUploadEvidence = await authorize(userId, "incidents", "create");

  return (
    <AppShell>
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-light">{incident.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral">{incident.description}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={SEVERITY_TONE[incident.severity]}>{incident.severity}</Badge>
          <Badge tone={STATUS_TONE[incident.status]}>{incident.status.replace("_", " ")}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 py-4 text-sm md:grid-cols-3">
          <div><p className="text-xs text-neutral">Polling station</p><p className="text-light">{incident.pollingStation?.code ?? "Not station-specific"}</p></div>
          <div><p className="text-xs text-neutral">Reported by</p><p className="text-light">{incident.reportedBy?.name ?? "—"}</p></div>
          <div><p className="text-xs text-neutral">Reported at</p><p className="text-light">{incident.createdAt.toLocaleString("en-US")}</p></div>
          {incident.reviewNotes && (
            <div className="md:col-span-3">
              <p className="text-xs text-neutral">Review notes</p>
              <p className="text-light">{incident.reviewNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 py-4">
          {incident.evidence.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <a href={`/api/incidents/evidence/${e.id}`} className="text-accent hover:underline">
                {e.fileName}
              </a>
              <span className="text-xs text-neutral">{(e.sizeBytes / 1024).toFixed(0)} KB · sha256:{e.sha256.slice(0, 12)}…</span>
            </div>
          ))}
          {incident.evidence.length === 0 && <p className="text-sm text-neutral">No evidence uploaded.</p>}
          {canUploadEvidence && <IncidentEvidenceUpload incidentId={incident.id} />}
        </CardContent>
      </Card>

      {canReview && incident.status !== "RESOLVED" && incident.status !== "DISMISSED" && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 py-4">
            {incident.status === "OPEN" && (
              <form action={acknowledgeIncident}>
                <input type="hidden" name="incidentId" value={incident.id} />
                <Button type="submit" variant="secondary">Acknowledge</Button>
              </form>
            )}
            <form action={resolveIncident} className="flex flex-col gap-2">
              <input type="hidden" name="incidentId" value={incident.id} />
              <textarea name="reviewNotes" rows={2} required placeholder="What was done about this incident" className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light" />
              <div className="flex gap-2">
                <Button type="submit">Mark resolved</Button>
                <Button type="submit" formAction={dismissIncident} variant="secondary">Dismiss</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
    </AppShell>
  );
}
