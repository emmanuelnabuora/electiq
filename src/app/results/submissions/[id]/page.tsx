import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { verifyResult, approveResult, publishResult } from "@/lib/actions/results";
import { EvidenceUpload } from "@/components/results/evidence-upload";
import { AppShell } from "@/components/layout/AppShell";

const STATUS_TONE = {
  DRAFT: "neutral",
  SUBMITTED: "neutral",
  VALIDATION_FAILED: "critical",
  AWAITING_REVIEW: "warning",
  VERIFIED: "accent",
  FLAGGED: "warning",
  DISPUTED: "critical",
  CORRECTED: "neutral",
  APPROVED: "accent",
  PUBLISHED: "success",
} as const;

/**
 * Moved here from /command-center/results/[id] as part of the UI
 * redesign. Deliberately NOT restyled internally in this pass -- this
 * page drives the actual verify/approve/publish decision workflow for
 * a real result submission, plus evidence upload and version history.
 * Rewriting its conditional rendering quickly alongside a large batch
 * of other screens risked introducing a real bug into a safety-critical
 * pipeline, which is worse than leaving it visually inconsistent for
 * now. It's wrapped in the new AppShell so navigation is consistent;
 * everything inside the shell still uses the old dark-theme
 * Card/Badge/Button components, which still work correctly, just don't
 * visually match yet.
 */
export default async function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "results", "read");
  if (!canRead) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-6 text-sm text-neutral">
            Your role does not include permission to view results (<code>results.read</code>).
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const submission = await db.resultSubmission.findUnique({
    where: { id },
    include: {
      election: true,
      position: true,
      pollingStation: { include: { pollingCenter: { include: { unit: { include: { parent: { include: { parent: true } } } } } } } },
      submittedBy: { select: { name: true } },
      candidateResults: { include: { candidate: { include: { party: true } } } },
      verifications: { include: { verifier: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      documents: true,
    },
  });

  if (!submission) notFound();

  const wardUnitId = submission.pollingStation.pollingCenter.unitId;
  const [canVerify, canApprove, canPublish, canSubmit] = await Promise.all([
    authorize(userId, "results", "verify", wardUnitId),
    authorize(userId, "results", "approve", wardUnitId),
    authorize(userId, "results", "publish", wardUnitId),
    authorize(userId, "results", "submit", wardUnitId),
  ]);

  const versions = await db.resultSubmission.findMany({
    where: {
      electionId: submission.electionId,
      positionId: submission.positionId,
      pollingStationId: submission.pollingStationId,
    },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true, updatedAt: true },
  });

  const ward = submission.pollingStation.pollingCenter.unit;
  const constituency = ward.parent;
  const region = constituency?.parent;

  return (
    <AppShell>
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-light">
            {submission.pollingStation.name} — {submission.position.name}
          </h1>
          <p className="text-sm text-neutral">
            {ward.name} / {constituency?.name ?? "—"} / {region?.name ?? "—"} · Version {submission.version}
          </p>
        </div>
        <Badge tone={STATUS_TONE[submission.status]}>{submission.status.replace("_", " ")}</Badge>
      </div>

      {submission.status === "VALIDATION_FAILED" && (
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-medium text-critical">Failed automated validation</p>
            <ul className="list-inside list-disc text-sm text-critical">
              {((submission.validationErrors as string[] | null) ?? []).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {canSubmit && (
              <p className="mt-2 text-xs text-neutral">
                Submit a corrected version from the Submit Result page to replace this one.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Counts</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 py-4 text-sm">
            <div><p className="text-xs text-neutral">Registered voters</p><p className="text-light">{submission.registeredVoters.toLocaleString("en-US")}</p></div>
            <div><p className="text-xs text-neutral">Ballots issued</p><p className="text-light">{submission.ballotsIssued.toLocaleString("en-US")}</p></div>
            <div><p className="text-xs text-neutral">Votes cast</p><p className="text-light">{submission.votesCast.toLocaleString("en-US")}</p></div>
            <div><p className="text-xs text-neutral">Valid votes</p><p className="text-light">{submission.validVotes.toLocaleString("en-US")}</p></div>
            <div><p className="text-xs text-neutral">Rejected ballots</p><p className="text-light">{submission.rejectedBallots.toLocaleString("en-US")}</p></div>
            <div><p className="text-xs text-neutral">Submitted by</p><p className="text-light">{submission.submittedBy?.name ?? "—"}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Candidate votes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 py-4">
            {submission.candidateResults.map((cr) => (
              <div key={cr.id} className="flex items-center justify-between text-sm">
                <span className="text-light">
                  {cr.candidate.fullName}
                  {cr.candidate.party && <span className="ml-1 text-xs text-neutral">({cr.candidate.party.abbreviation})</span>}
                </span>
                <span className="text-neutral">{cr.votes.toLocaleString("en-US")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {(canVerify || canApprove || canPublish) && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 py-4">
            {canVerify && submission.status === "AWAITING_REVIEW" && (
              <form action={verifyResult} className="flex flex-col gap-2">
                <input type="hidden" name="submissionId" value={submission.id} />
                <label className="text-xs text-neutral">Verification notes (optional)</label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
                />
                <div className="flex gap-2">
                  <Button type="submit" name="decision" value="VERIFIED">Verify</Button>
                  <Button type="submit" name="decision" value="FLAGGED" variant="secondary">Flag for review</Button>
                  <Button type="submit" name="decision" value="DISPUTED" variant="secondary">Dispute</Button>
                </div>
              </form>
            )}
            {canApprove && submission.status === "VERIFIED" && (
              <form action={approveResult}>
                <input type="hidden" name="submissionId" value={submission.id} />
                <Button type="submit">Approve</Button>
              </form>
            )}
            {canPublish && submission.status === "APPROVED" && (
              <form action={publishResult}>
                <input type="hidden" name="submissionId" value={submission.id} />
                <Button type="submit">Publish</Button>
              </form>
            )}
            {!(
              (canVerify && submission.status === "AWAITING_REVIEW") ||
              (canApprove && submission.status === "VERIFIED") ||
              (canPublish && submission.status === "APPROVED")
            ) && <p className="text-sm text-neutral">No action available for this status with your role.</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Version history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 py-4 text-sm">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between">
                <a href={`/results/submissions/${v.id}`} className={v.id === submission.id ? "text-light" : "text-accent hover:underline"}>
                  Version {v.version}
                </a>
                <Badge tone={STATUS_TONE[v.status]}>{v.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 py-4 text-sm">
            {submission.verifications.map((v) => (
              <div key={v.id} className="border-b border-white/5 pb-2 last:border-0">
                <div className="flex items-center justify-between">
                  <Badge tone={STATUS_TONE[v.decision]}>{v.decision}</Badge>
                  <span className="text-xs text-neutral">{v.createdAt.toLocaleString("en-US")}</span>
                </div>
                <p className="mt-1 text-neutral">{v.verifier?.name ?? "—"}{v.notes && ` — ${v.notes}`}</p>
              </div>
            ))}
            {submission.verifications.length === 0 && (
              <p className="text-neutral">Not yet reviewed.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 py-4">
          {submission.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <a href={`/api/results/documents/${d.id}`} className="text-accent hover:underline">
                {d.fileName}
              </a>
              <span className="text-xs text-neutral">
                {(d.sizeBytes / 1024).toFixed(0)} KB · sha256:{d.sha256.slice(0, 12)}…
              </span>
            </div>
          ))}
          {submission.documents.length === 0 && <p className="text-sm text-neutral">No evidence uploaded yet.</p>}
          {canSubmit && <EvidenceUpload submissionId={submission.id} />}
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
