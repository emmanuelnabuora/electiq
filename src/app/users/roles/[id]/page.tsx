import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { getRoleDetail } from "@/lib/actions/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RolePermissionEditor } from "@/components/admin/role-permission-editor";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Moved here from /command-center/roles/[id] as part of the route
 * consolidation. RolePermissionEditor itself is not restyled -- it's
 * the highest-blast-radius admin action in the app (changes what every
 * user holding a role can do, immediately, with a hard lockout guard),
 * and it's already been carefully built and tested; a cosmetic rewrite
 * risks that guard, so it's moved unchanged and wrapped in the new
 * AppShell for consistent navigation only.
 */
export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-6 text-sm text-neutral">
            You don't have permission to view this role.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const { role, allPermissions } = await getRoleDetail(id);

  return (
    <AppShell>
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-light">{role.name}</h1>
        <p className="text-sm text-neutral">{role.description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <RolePermissionEditor
            roleId={role.id}
            allPermissions={allPermissions}
            grantedPermissionIds={role.permissions.map((rp) => rp.permission.id)}
          />
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
