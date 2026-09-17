import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { listApiKeys } from "@/lib/actions/api-keys";
import { ApiKeyManagement } from "@/components/admin/api-key-management";
import { MAX_REQUESTS_PER_WINDOW, API_KEY_MAX_REQUESTS_PER_WINDOW } from "@/lib/public/rate-limit";

export default async function ApiManagementPage() {
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <AppShell>
        <PageHeader title="API Management" />
        <p className="text-sm text-eiq-text-secondary">You don't have permission to manage API keys.</p>
      </AppShell>
    );
  }

  const keys = await listApiKeys();

  return (
    <AppShell>
      <PageHeader
        title="API Management"
        subtitle={`Keys grant a higher rate limit (${API_KEY_MAX_REQUESTS_PER_WINDOW} req/min vs. ${MAX_REQUESTS_PER_WINDOW} for anonymous callers) on the public API at /api/public/* -- they don't unlock any endpoint that wasn't already open. Present a key via the X-API-Key header.`}
      />
      <ApiKeyManagement keys={keys} />
    </AppShell>
  );
}
