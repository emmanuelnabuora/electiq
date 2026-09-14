import Link from "next/link";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { listRolesWithPermissions, listAllPermissions } from "@/lib/actions/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

export default async function PermissionsPage() {
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          You don't have permission to view permissions.
        </CardContent>
      </Card>
    );
  }

  const [roles, permissions] = await Promise.all([listRolesWithPermissions(), listAllPermissions()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-light">Permissions</h1>
        <p className="text-sm text-neutral">
          Every (resource, action) pair in the system and which roles currently grant it. Click a
          role name to edit its permissions.
        </p>
      </div>
      <Card>
        <CardContent className="overflow-x-auto py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="sticky left-0 bg-panel py-2 pr-4 font-medium">Permission</th>
                {roles.map((role) => (
                  <th key={role.id} className="px-2 py-2 text-center font-medium">
                    <Link href={`/command-center/roles/${role.id}`} className="text-accent hover:underline">
                      {role.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="sticky left-0 bg-panel py-2 pr-4 text-neutral" title={p.description}>
                    {p.resource}.{p.action}
                  </td>
                  {roles.map((role) => {
                    const granted = role.permissions.some((rp) => rp.permission.id === p.id);
                    return (
                      <td key={role.id} className="px-2 py-2 text-center">
                        {granted && <Check className="mx-auto h-3.5 w-3.5 text-success" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
