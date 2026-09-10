import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { PollingStationImport } from "@/components/import/polling-station-import";

export default async function PollingStationImportPage() {
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "geography", "manage");

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to import polling infrastructure (
          <code>geography.manage</code>).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-light">Import Polling Stations</h1>
      <p className="mb-6 text-sm text-neutral">
        Upload → Validate → Preview → Confirm. Nothing is imported until you review the preview and
        confirm.
      </p>
      <PollingStationImport />
    </div>
  );
}
