import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { listRolesWithPermissions, listAllPermissions } from "@/lib/actions/roles";
import { Check } from "lucide-react";

export default async function PermissionsPage() {
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <AppShell>
        <PageHeader title="Permissions" />
        <p className="text-sm text-eiq-text-secondary">You don't have permission to view permissions.</p>
      </AppShell>
    );
  }

  const [roles, permissions] = await Promise.all([listRolesWithPermissions(), listAllPermissions()]);

  return (
    <AppShell>
      <PageHeader
        title="Permissions"
        subtitle="Every (resource, action) pair in the system and which roles currently grant it. Click a role name to edit its permissions."
      />
      <div className="overflow-x-auto rounded-lg border border-eiq-border bg-eiq-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-eiq-text-secondary">
              <th className="sticky left-0 bg-eiq-card py-2 pr-4 pl-4 font-medium">Permission</th>
              {roles.map((role) => (
                <th key={role.id} className="px-2 py-2 text-center font-medium">
                  <Link href={`/users/roles/${role.id}`} className="text-eiq-blue hover:underline">
                    {role.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.id} className="border-t border-eiq-border">
                <td className="sticky left-0 bg-eiq-card py-2 pr-4 pl-4 text-eiq-text-secondary" title={p.description}>
                  {p.resource}.{p.action}
                </td>
                {roles.map((role) => {
                  const granted = role.permissions.some((rp) => rp.permission.id === p.id);
                  return (
                    <td key={role.id} className="px-2 py-2 text-center">
                      {granted && <Check className="mx-auto h-3.5 w-3.5 text-eiq-success" />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
