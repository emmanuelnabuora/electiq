import Link from "next/link";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { listRolesWithPermissions } from "@/lib/actions/roles";
import { Card, CardContent } from "@/components/ui/card";

export default async function RolesPage() {
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          You don't have permission to view roles.
        </CardContent>
      </Card>
    );
  }

  const roles = await listRolesWithPermissions();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-light">Roles</h1>
        <p className="text-sm text-neutral">
          The set of roles is fixed — creating a new role name requires a code change. What each
          role can do is fully editable here.
        </p>
      </div>
      <Card>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 font-medium">Permissions</th>
                <th className="py-2 font-medium">Users</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t border-white/5">
                  <td className="py-2">
                    <Link href={`/command-center/roles/${role.id}`} className="text-accent hover:underline">
                      {role.name}
                    </Link>
                  </td>
                  <td className="py-2 text-neutral">{role.description}</td>
                  <td className="py-2 text-neutral">{role.permissions.length}</td>
                  <td className="py-2 text-neutral">{role._count.userRoles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
