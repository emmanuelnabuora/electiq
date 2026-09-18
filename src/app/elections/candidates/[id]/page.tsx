import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { updateCandidateNominationStatus, uploadCandidateDocument } from "@/lib/actions/elections";
import { FileText, Download } from "lucide-react";

const STATUS_TONE = {
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "critical",
  WITHDRAWN: "neutral",
} as const;

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "elections", "read");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Candidate" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view candidates (elections.read).
        </p>
      </AppShell>
    );
  }

  const canUpdate = await authorize(session.user.id, "elections", "update");

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: {
      election: true,
      position: true,
      party: { include: { coverage: { include: { unit: true } } } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!candidate) notFound();

  return (
    <AppShell>
      <PageHeader
        title={candidate.fullName}
        subtitle={`${candidate.position.name} · ${candidate.election.name}`}
        actions={
          <Link href="/elections/candidates" className="text-sm font-medium text-eiq-blue">
            ← Back to Candidates
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Nomination</h2>
          <div className="mb-3 flex items-center gap-3">
            <StatusBadge status={candidate.nominationStatus.replace("_", " ")} tone={STATUS_TONE[candidate.nominationStatus]} />
            <StatusBadge
              status={candidate.nominationStatus === "APPROVED" ? "Ballot Ready" : "Not Ballot Ready"}
              tone={candidate.nominationStatus === "APPROVED" ? "success" : "neutral"}
            />
          </div>
          {candidate.party && candidate.party.registrationStatus !== "REGISTERED" && (
            <p className="mb-3 text-xs text-eiq-warning">
              This candidate's party ({candidate.party.abbreviation}) is not currently REGISTERED --
              approval will be blocked until the party's registration status is updated.
            </p>
          )}
          {canUpdate ? (
            <form action={updateCandidateNominationStatus} className="flex flex-col gap-2">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <input type="hidden" name="electionId" value={candidate.electionId} />
              <select
                name="nominationStatus"
                defaultValue={candidate.nominationStatus}
                className="rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm text-eiq-text-primary"
              >
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
              <textarea
                name="nominationNotes"
                defaultValue={candidate.nominationNotes ?? ""}
                placeholder="Review notes (optional)"
                rows={3}
                className="rounded-md border border-eiq-border px-3 py-2 text-sm"
              />
              <button type="submit" className="self-start rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white">
                Update nomination status
              </button>
            </form>
          ) : (
            candidate.nominationNotes && <p className="text-sm text-eiq-text-secondary">{candidate.nominationNotes}</p>
          )}
        </div>

        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Details</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div>
              <p className="text-xs text-eiq-text-secondary">Party</p>
              <p className="text-eiq-text-primary">{candidate.party?.name ?? "Independent"}</p>
            </div>
            <div>
              <p className="text-xs text-eiq-text-secondary">Geographic Scope</p>
              <p className="text-eiq-text-primary">
                {candidate.party
                  ? candidate.party.coverage.length > 0
                    ? candidate.party.coverage.map((c) => c.unit.name).join(", ")
                    : "Not yet set for this party"
                  : "National (Independent)"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
        <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Nomination Documents ({candidate.documents.length})</h2>
        <div className="flex flex-col gap-2">
          {candidate.documents.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-eiq-text-secondary" />
              <a href={`/api/candidates/documents/${d.id}`} className="text-eiq-blue hover:underline" target="_blank">
                {d.fileName}
              </a>
              <span className="text-xs text-eiq-text-secondary">
                {(d.sizeBytes / 1024).toFixed(0)} KB · sha256:{d.sha256.slice(0, 12)}…
              </span>
              <Download className="h-3.5 w-3.5 text-eiq-text-secondary" />
            </div>
          ))}
          {candidate.documents.length === 0 && (
            <p className="text-sm text-eiq-text-secondary">No documents uploaded yet.</p>
          )}
          {canUpdate && (
            <form action={uploadCandidateDocument} className="mt-2 flex items-center gap-2">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <input type="hidden" name="electionId" value={candidate.electionId} />
              <input type="file" name="file" required className="text-sm" />
              <button type="submit" className="rounded-md border border-eiq-border px-3 py-1.5 text-sm text-eiq-text-primary">
                Upload
              </button>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
