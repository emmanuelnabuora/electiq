import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addPosition,
  addParty,
  addCandidate,
  deleteCandidate,
  updateElectionStatus,
} from "@/lib/actions/elections";

const STATUSES = ["DRAFT", "CONFIGURED", "ACTIVE", "CLOSED", "ARCHIVED"] as const;

export default async function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "elections", "read");
  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view elections (<code>elections.read</code>).
        </CardContent>
      </Card>
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-light">{election.name}</h1>
          <p className="text-sm text-neutral">
            {election.country.name} ·{" "}
            {election.electionDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        {canUpdate ? (
          <form action={updateElectionStatus} className="flex items-center gap-2">
            <input type="hidden" name="electionId" value={election.id} />
            <select
              name="status"
              defaultValue={election.status}
              className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Update status
            </Button>
          </form>
        ) : (
          <Badge>{election.status}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Positions ({election.positions.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 py-4">
            {election.positions.map((p) => (
              <div key={p.id} className="rounded-md border border-white/5 px-3 py-2 text-sm">
                <p className="text-light">{p.name}</p>
                <p className="text-xs text-neutral">{p.candidates.length} candidate(s)</p>
              </div>
            ))}
            {election.positions.length === 0 && (
              <p className="text-sm text-neutral">No positions yet.</p>
            )}
            {canUpdate && (
              <form action={addPosition} className="mt-2 flex gap-2">
                <input type="hidden" name="electionId" value={election.id} />
                <Input name="name" placeholder="e.g. Regional Governor" required />
                <Button type="submit" variant="secondary">
                  Add
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parties ({election.parties.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 py-4">
            {election.parties.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-white/5 px-3 py-2 text-sm"
              >
                <span className="text-light">{p.name}</span>
                <Badge>{p.abbreviation}</Badge>
              </div>
            ))}
            {election.parties.length === 0 && (
              <p className="text-sm text-neutral">No parties yet.</p>
            )}
            {canUpdate && (
              <form action={addParty} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="electionId" value={election.id} />
                <Input name="name" placeholder="Party name" required />
                <div className="flex gap-2">
                  <Input name="abbreviation" placeholder="Abbreviation" required className="w-32" />
                  <Input name="colorHex" placeholder="#2F80ED" className="w-32" />
                  <Button type="submit" variant="secondary" className="flex-1">
                    Add party
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 py-4">
          {election.positions.map((position) => (
            <div key={position.id}>
              <p className="mb-2 text-sm font-medium text-light">{position.name}</p>
              <div className="flex flex-col gap-2">
                {position.candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-md border border-white/5 px-3 py-2 text-sm"
                  >
                    <span className="text-light">
                      {c.fullName}
                      {c.party && <span className="ml-2 text-neutral">({c.party.abbreviation})</span>}
                    </span>
                    {canUpdate && (
                      <form action={deleteCandidate}>
                        <input type="hidden" name="candidateId" value={c.id} />
                        <input type="hidden" name="electionId" value={election.id} />
                        <Button type="submit" variant="ghost">
                          Remove
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
                {position.candidates.length === 0 && (
                  <p className="text-sm text-neutral">No candidates yet.</p>
                )}
                {canUpdate && (
                  <form action={addCandidate} className="flex gap-2">
                    <input type="hidden" name="electionId" value={election.id} />
                    <input type="hidden" name="positionId" value={position.id} />
                    <Input name="fullName" placeholder="Candidate name" required />
                    <select
                      name="partyId"
                      defaultValue=""
                      className="rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
                    >
                      <option value="">No party</option>
                      {election.parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.abbreviation}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="secondary">
                      Add
                    </Button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
