import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { FieldOperationsMap } from "@/components/field/FieldOperationsMapLoader";
import Link from "next/link";

export default async function FieldOperationsMapPage() {
  const session = await requireSession();
  const canView = await authorize(session.user.id, "field", "manage");

  if (!canView) {
    return (
      <AppShell>
        <PageHeader title="Field Operations" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view the field operations map (field.manage).
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Field Operations"
        actions={
          <Link href="/field-operations/assignments" className="text-sm font-medium text-eiq-blue">
            Manage assignments →
          </Link>
        }
      />
      <div className="h-[calc(100vh-180px)]">
        <FieldOperationsMap />
      </div>
    </AppShell>
  );
}
