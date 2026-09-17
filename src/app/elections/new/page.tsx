import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ElectionWizard } from "@/components/elections/election-wizard";

/**
 * The shell around this page (AppShell, PageHeader) uses the new light
 * theme. ElectionWizard itself is not yet restyled -- it's a
 * self-contained multi-step client component with its own dark-theme
 * styling, and a full visual rebuild of its several steps was out of
 * scope for this pass. Noted here directly rather than left implicit:
 * this is the one place in the redesigned Elections flow where the
 * inner content still looks like the old theme.
 */
export default async function NewElectionPage() {
  const session = await requireSession();
  const canCreate = await authorize(session.user.id, "elections", "create");

  if (!canCreate) {
    return (
      <AppShell>
        <PageHeader title="Create Election" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to create elections (elections.create).
        </p>
      </AppShell>
    );
  }

  const countries = await db.country.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell>
      <PageHeader
        title="Election Setup Wizard"
        subtitle="Configure a new election in a few steps. You can add parties and candidates afterward."
      />
      <div className="mx-auto max-w-2xl">
        <ElectionWizard countries={countries.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </AppShell>
  );
}
