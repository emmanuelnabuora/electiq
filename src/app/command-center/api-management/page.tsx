import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { listApiKeys } from "@/lib/actions/api-keys";
import { Card, CardContent } from "@/components/ui/card";
import { ApiKeyManagement } from "@/components/admin/api-key-management";

export default async function ApiManagementPage() {
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          You don't have permission to manage API keys.
        </CardContent>
      </Card>
    );
  }

  const keys = await listApiKeys();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-light">API Management</h1>
        <p className="text-sm text-neutral">
          Keys grant a higher rate limit (300 req/min vs. 30 for anonymous callers) on the public
          API at <code>/api/public/*</code> — they don't unlock any endpoint that wasn't already
          open, every public API route has been unauthenticated by design since Sprint 10. Present
          a key via the <code>X-API-Key</code> header.
        </p>
      </div>
      <ApiKeyManagement keys={keys} />
    </div>
  );
}
