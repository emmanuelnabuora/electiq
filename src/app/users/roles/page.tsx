import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { listRolesWithPermissions } from "@/lib/actions/roles";
import { DataTable, type DataTableColumn } from "@/components/ui-v2/DataTable";

type RoleRow = Awaited<ReturnType<typeof listRolesWithPermissions>>[number];

export default async function RolesPage() {
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <AppShell>
        <PageHeader title="Roles" />
        <p className="text-sm text-eiq-text-secondary">You don't have permission to view roles.</p>
      </AppShell>
    );
  }

  const roles = await listRolesWithPermissions();

  const columns: DataTableColumn<RoleRow>[] = [
    {
      header: "Role",
      cell: (role) => (
        <Link href={`/users/roles/${role.id}`} className="font-medium text-eiq-blue hover:underline">
          {role.name}
        </Link>
      ),
    },
    { header: "Description", cell: (role) => role.description },
    { header: "Permissions", cell: (role) => role.permissions.length },
    { header: "Users", cell: (role) => role._count.userRoles },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Roles"
        subtitle="The set of roles is fixed -- creating a new role name requires a code change. What each role can do is fully editable here."
      />
      <DataTable columns={columns} rows={roles} rowKey={(r) => r.id} />
    </AppShell>
  );
}
