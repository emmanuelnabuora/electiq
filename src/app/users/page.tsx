import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/ui-v2/FilterBar";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { listUsersWithRoles, listAllRoles } from "@/lib/actions/users";
import { UserManagement } from "@/components/admin/user-management";

/**
 * Real role names -> the 4 named tabs the approved design asks for.
 * Not an invented taxonomy: every name here is a real RoleName enum
 * value that actually exists in this database (see prisma/schema.prisma).
 * MEDIA_USER, AUDITOR, and PARTY_AGENT don't map cleanly to any of the
 * 4 named categories, so they simply don't appear under a specific tab
 * -- they're still visible under "All Users", which is the honest
 * behavior here rather than forcing every role into one of the 4 boxes.
 */
const TAB_ROLE_MAP: Record<string, string[]> = {
  administrators: ["SUPER_ADMIN", "ELECTION_COMMISSIONER", "NATIONAL_RETURNING_OFFICER"],
  "field-officers": ["REGIONAL_OFFICER", "CONSTITUENCY_OFFICER", "POLLING_OFFICER"],
  observers: ["OBSERVER"],
  analysts: ["ANALYST"],
};

export default async function UsersPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <AppShell>
        <PageHeader title="Users & Roles" />
        <p className="text-sm text-eiq-text-secondary">You don't have permission to manage users.</p>
      </AppShell>
    );
  }

  const [allUsers, roles] = await Promise.all([listUsersWithRoles(), listAllRoles()]);

  const tab = searchParams.tab ?? "all";
  const allowedRoleNames = TAB_ROLE_MAP[tab];
  const users = allowedRoleNames
    ? allUsers.filter((u) => u.roles.some((ur) => allowedRoleNames.includes(ur.role.name)))
    : allUsers;

  return (
    <AppShell>
      <PageHeader
        title="Users & Roles"
        subtitle="Create accounts, assign roles, and manage account status. Changes here take effect immediately."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/users/roles" className="text-sm font-medium text-eiq-blue">
              Manage Roles
            </Link>
            <Link href="/users/permissions" className="text-sm font-medium text-eiq-blue">
              Permissions
            </Link>
          </div>
        }
      />

      <FilterBar
        param="tab"
        options={[
          { label: "All Users", value: "all" },
          { label: "Administrators", value: "administrators" },
          { label: "Field Officers", value: "field-officers" },
          { label: "Observers", value: "observers" },
          { label: "Analysts", value: "analysts" },
        ]}
      />

      <UserManagement users={users} roles={roles} currentUserId={session.user.id} />
    </AppShell>
  );
}
