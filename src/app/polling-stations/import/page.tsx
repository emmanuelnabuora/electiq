import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { PollingStationImport } from "@/components/import/polling-station-import";

/**
 * Moved here from /command-center/polling-stations/import as part of
 * the master-spec redesign. PollingStationImport itself (the real
 * upload -> validate -> preview -> confirm workflow, Section 21) is
 * not restyled internally -- same reasoning as every other real
 * workflow component moved so far in this project: safer moved intact
 * than rewritten alongside other work.
 */
export default async function PollingStationImportPage() {
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "geography", "manage");

  if (!canManage) {
    return (
      <AppShell>
        <PageHeader title="Import Polling Stations" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to import polling infrastructure (geography.manage).
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Import Polling Stations"
        subtitle="Upload → Validate → Preview → Confirm. Nothing is imported until you review the preview and confirm."
      />
      <div className="mx-auto max-w-3xl">
        <PollingStationImport />
      </div>
    </AppShell>
  );
}
