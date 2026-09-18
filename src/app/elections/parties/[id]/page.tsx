import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui-v2/StatusBadge";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { updatePartyRegistrationStatus, setPartyGeographicCoverage } from "@/lib/actions/elections";

const STATUS_TONE = { PENDING: "warning", REGISTERED: "success", SUSPENDED: "critical" } as const;

export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "elections", "read");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Party" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view parties (elections.read).
        </p>
      </AppShell>
    );
  }

  const canUpdate = await authorize(session.user.id, "elections", "update");

  const party = await db.party.findUnique({
    where: { id },
    include: {
      election: { include: { country: true } },
      candidates: { include: { position: true } },
      coverage: true,
    },
  });

  if (!party) notFound();

  // Top-level administrative units (counties/regions) for this party's
  // country -- the real, explicit set an admin can mark as "covered".
  const topLevel = await db.administrativeLevel.findFirst({
    where: { depth: 0, countryId: party.election.country.id },
  });
  const allUnits = topLevel
    ? await db.administrativeUnit.findMany({ where: { levelId: topLevel.id }, orderBy: { name: "asc" } })
    : [];
  const coveredUnitIds = new Set(party.coverage.map((c) => c.unitId));

  return (
    <AppShell>
      <PageHeader
        title={party.name}
        subtitle={`${party.abbreviation} · ${party.election.name}`}
        actions={
          <Link href="/elections/parties" className="text-sm font-medium text-eiq-blue">
            ← Back to Parties
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Registration</h2>
          <div className="mb-3">
            <StatusBadge status={party.registrationStatus} tone={STATUS_TONE[party.registrationStatus]} />
          </div>
          {canUpdate ? (
            <form action={updatePartyRegistrationStatus} className="flex items-center gap-2">
              <input type="hidden" name="partyId" value={party.id} />
              <input type="hidden" name="electionId" value={party.election.id} />
              <select
                name="registrationStatus"
                defaultValue={party.registrationStatus}
                className="rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm text-eiq-text-primary"
              >
                <option value="PENDING">Pending</option>
                <option value="REGISTERED">Registered</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
              <button type="submit" className="rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white">
                Update
              </button>
            </form>
          ) : null}
          <p className="mt-3 text-xs text-eiq-text-secondary">
            A candidate running under this party cannot be approved while this party's status is not
            REGISTERED.
          </p>
        </div>

        <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
          <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">Candidates ({party.candidates.length})</h2>
          <div className="flex flex-col gap-2">
            {party.candidates.map((c) => (
              <Link key={c.id} href={`/elections/candidates/${c.id}`} className="text-sm text-eiq-blue hover:underline">
                {c.fullName} <span className="text-eiq-text-secondary">— {c.position.name}</span>
              </Link>
            ))}
            {party.candidates.length === 0 && <p className="text-sm text-eiq-text-secondary">No candidates yet.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-eiq-border bg-eiq-card p-4">
        <h2 className="mb-3 text-sm font-medium text-eiq-text-primary">
          Geographic Coverage {topLevel ? `(${topLevel.name}s)` : ""}
        </h2>
        {allUnits.length === 0 ? (
          <p className="text-sm text-eiq-text-secondary">
            No administrative boundaries are configured for this election's country yet.
          </p>
        ) : canUpdate ? (
          <form action={setPartyGeographicCoverage} className="flex flex-col gap-3">
            <input type="hidden" name="partyId" value={party.id} />
            <input type="hidden" name="electionId" value={party.election.id} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {allUnits.map((unit) => (
                <label key={unit.id} className="flex items-center gap-2 text-sm text-eiq-text-primary">
                  <input type="checkbox" name="unitIds" value={unit.id} defaultChecked={coveredUnitIds.has(unit.id)} />
                  {unit.name}
                </label>
              ))}
            </div>
            <button type="submit" className="self-start rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white">
              Save coverage
            </button>
          </form>
        ) : (
          <p className="text-sm text-eiq-text-primary">
            {party.coverage.length > 0
              ? allUnits.filter((u) => coveredUnitIds.has(u.id)).map((u) => u.name).join(", ")
              : "Not yet set"}
          </p>
        )}
      </div>
    </AppShell>
  );
}
