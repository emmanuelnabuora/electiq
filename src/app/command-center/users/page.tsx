import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { listUsersWithRoles, listAllRoles } from "@/lib/actions/users";
import { UserManagement } from "@/components/admin/user-management";
import { Card, CardContent } from "@/components/ui/card";

export default async function UsersPage() {
  const session = await requireSession();
  const canManage = await authorize(session.user.id, "users", "manage");

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          You don't have permission to manage users.
        </CardContent>
      </Card>
    );
  }

  const [users, roles] = await Promise.all([listUsersWithRoles(), listAllRoles()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-light">Users</h1>
        <p className="text-sm text-neutral">
          Create accounts, assign roles, and manage account status. Changes here take effect
          immediately.
        </p>
      </div>
      <UserManagement users={users} roles={roles} currentUserId={session.user.id} />
    </div>
  );
}
