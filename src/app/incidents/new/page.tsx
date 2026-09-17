import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCurrentElectionId } from "@/lib/elections/current";
import { reportIncident } from "@/lib/actions/incidents";

export default async function NewIncidentPage() {
  const session = await requireSession();
  const canCreate = await authorize(session.user.id, "incidents", "create");

  if (!canCreate) {
    return (
      <AppShell>
        <PageHeader title="Report Incident" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to report incidents (incidents.create).
        </p>
      </AppShell>
    );
  }

  const currentElectionId = await getCurrentElectionId();
  const election = currentElectionId ? await db.election.findUnique({ where: { id: currentElectionId } }) : null;

  if (!election) {
    return (
      <AppShell>
        <PageHeader title="Report Incident" />
        <p className="text-sm text-eiq-text-secondary">No election configured yet.</p>
      </AppShell>
    );
  }

  const stations = await db.pollingStation.findMany({ orderBy: { code: "asc" }, take: 200 });

  return (
    <AppShell>
      <PageHeader
        title="Report Incident"
        subtitle="Describe what happened factually. This creates a review signal, not a determination -- use neutral language; a verified authorized person makes any final finding."
      />
      <div className="max-w-2xl rounded-xl border border-eiq-border bg-eiq-card p-5 shadow-sm">
        <form action={reportIncident} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input type="hidden" name="electionId" value={election.id} />
          <input
            name="title"
            placeholder="Short title"
            required
            className="rounded-md border border-eiq-border px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            name="description"
            placeholder="What happened"
            required
            rows={4}
            className="rounded-md border border-eiq-border px-3 py-2 text-sm md:col-span-2"
          />
          <select name="severity" required className="rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm text-eiq-text-primary">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select name="pollingStationId" className="rounded-md border border-eiq-border bg-eiq-card px-3 py-2 text-sm text-eiq-text-primary">
            <option value="">No specific polling station</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-eiq-blue px-3 py-2 text-sm font-medium text-white md:col-span-2">
            Report incident
          </button>
        </form>
      </div>
    </AppShell>
  );
}
