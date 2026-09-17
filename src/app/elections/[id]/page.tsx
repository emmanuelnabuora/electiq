import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  addPosition,
  addParty,
  addCandidate,
  deleteCandidate,
  updateCandidatePhoto,
  updateElectionStatus,
} from "@/lib/actions/elections";

const STATUSES = ["DRAFT", "CONFIGURED", "ACTIVE", "CLOSED", "ARCHIVED"] as const;

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "elections", "read");
  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Election" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view elections (elections.read).
        </p>
      </AppShell>
    );
  }

  const canUpdate = await authorize(userId, "elections", "update");

  const election = await db.election.findUnique({
    where: { id },
    include: {
      country: true,
      positions: { include: { candidates: { include: { party: true } } } },
      parties: true,
    },
  });

  if (!election) notFound();

  return (
    <AppShell>
      <PageHeader
        title={election.name}
        subtitle={`${election.country.name} · ${election.electionDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`}
        actions={
          canUpdate ? (
            <form action={updateElectionStatus} className="flex items-center gap-2">
              <input type="hidden" name="electionId" value={election.id} />
              <select
                name="status"
                defaultValue={election.status}
                className="rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm text-eiq-text-primary"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm text-eiq-text-primary">
                Update status
              </button>
            </form>
          ) : (
            <StatusBadge status={election.status} tone={election.status === "ACTIVE" ? "success" : "neutral"} />
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-eiq-text-primary">
            Positions ({election.positions.length})
          </h2>
          <div className="flex flex-col gap-2">
            {election.positions.map((p) => (
              <div key={p.id} className="rounded-md border border-eiq-border px-3 py-2 text-sm">
                <p className="text-eiq-text-primary">{p.name}</p>
                <p className="text-xs text-eiq-text-secondary">{p.candidates.length} candidate(s)</p>
              </div>
            ))}
            {election.positions.length === 0 && (
              <p className="text-sm text-eiq-text-secondary">No positions yet.</p>
            )}
            {canUpdate && (
              <form action={addPosition} className="mt-2 flex gap-2">
                <input type="hidden" name="electionId" value={election.id} />
                <input
                  name="name"
                  placeholder="e.g. Regional Governor"
                  required
                  className="flex-1 rounded-md border border-eiq-border px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-md border border-eiq-border px-3 py-2 text-sm text-eiq-text-primary">
                  Add
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-eiq-text-primary">Parties ({election.parties.length})</h2>
          <div className="flex flex-col gap-2">
            {election.parties.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-eiq-border px-3 py-2 text-sm">
                <span className="text-eiq-text-primary">{p.name}</span>
                <span className="rounded-full bg-eiq-bg px-2 py-0.5 text-xs font-medium text-eiq-text-secondary">
                  {p.abbreviation}
                </span>
              </div>
            ))}
            {election.parties.length === 0 && <p className="text-sm text-eiq-text-secondary">No parties yet.</p>}
            {canUpdate && (
              <form action={addParty} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="electionId" value={election.id} />
                <input name="name" placeholder="Party name" required className="rounded-md border border-eiq-border px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <input name="abbreviation" placeholder="Abbreviation" required className="w-32 rounded-md border border-eiq-border px-3 py-2 text-sm" />
                  <input name="colorHex" placeholder="#2563EB" className="w-32 rounded-md border border-eiq-border px-3 py-2 text-sm" />
                  <button type="submit" className="flex-1 rounded-md border border-eiq-border px-3 py-2 text-sm text-eiq-text-primary">
                    Add party
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-eiq-border bg-eiq-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-eiq-text-primary">Candidates</h2>
        <div className="flex flex-col gap-5">
          {election.positions.map((position) => (
            <div key={position.id}>
              <p className="mb-2 text-sm font-medium text-eiq-text-primary">{position.name}</p>
              <div className="flex flex-col gap-2">
                {position.candidates.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-eiq-border px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      {c.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photoUrl} alt={c.fullName} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-eiq-bg text-xs font-medium text-eiq-text-primary">
                          {initials(c.fullName)}
                        </span>
                      )}
                      <span className="text-eiq-text-primary">
                        {c.fullName}
                        {c.party && <span className="ml-2 text-eiq-text-secondary">({c.party.abbreviation})</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {canUpdate && (
                        <form action={updateCandidatePhoto} className="flex items-center gap-1.5">
                          <input type="hidden" name="candidateId" value={c.id} />
                          <input
                            name="photoUrl"
                            defaultValue={c.photoUrl ?? ""}
                            placeholder="https://... photo URL"
                            className="w-48 rounded-md border border-eiq-border px-2 py-1 text-xs"
                          />
                          <button type="submit" className="text-xs font-medium text-eiq-blue">
                            Save
                          </button>
                        </form>
                      )}
                      {canUpdate && (
                        <form action={deleteCandidate}>
                          <input type="hidden" name="candidateId" value={c.id} />
                          <input type="hidden" name="electionId" value={election.id} />
                          <button type="submit" className="text-xs font-medium text-eiq-critical">
                            Remove
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
                {position.candidates.length === 0 && (
                  <p className="text-sm text-eiq-text-secondary">No candidates yet.</p>
                )}
                {canUpdate && (
                  <form action={addCandidate} className="flex gap-2">
                    <input type="hidden" name="electionId" value={election.id} />
                    <input type="hidden" name="positionId" value={position.id} />
                    <input name="fullName" placeholder="Candidate name" required className="rounded-md border border-eiq-border px-3 py-2 text-sm" />
                    <input name="photoUrl" placeholder="https://... photo URL (optional)" className="w-56 rounded-md border border-eiq-border px-3 py-2 text-sm" />
                    <select
                      name="partyId"
                      defaultValue=""
                      className="rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm text-eiq-text-primary"
                    >
                      <option value="">No party</option>
                      {election.parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.abbreviation}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-md border border-eiq-border px-3 py-2 text-sm text-eiq-text-primary">
                      Add
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
