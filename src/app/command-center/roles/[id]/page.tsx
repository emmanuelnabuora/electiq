import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { getRoleDetail } from "@/lib/actions/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RolePermissionEditor } from "@/components/admin/role-permission-editor";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          You don't have permission to view this role.
        </CardContent>
      </Card>
    );
  }

  const { role, allPermissions } = await getRoleDetail(id);

  return (
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
  );
}
