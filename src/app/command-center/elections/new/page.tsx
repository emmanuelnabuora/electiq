import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { ElectionWizard } from "@/components/elections/election-wizard";

export default async function NewElectionPage() {
  const session = await requireSession();
  const canCreate = await authorize(session.user.id, "elections", "create");

  if (!canCreate) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to create elections (
          <code>elections.create</code>).
        </CardContent>
      </Card>
    );
  }

  const countries = await db.country.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-light">Election Setup Wizard</h1>
      <p className="mb-6 text-sm text-neutral">
        Configure a new election in a few steps. You can add parties and candidates afterward.
      </p>
      <ElectionWizard countries={countries.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
