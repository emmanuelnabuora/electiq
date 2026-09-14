"use client";

import { useState } from "react";
import { UserPlus, Lock, Unlock, ShieldCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listUsersWithRoles,
  listAllRoles,
  createUser,
  setUserActive,
  unlockUser,
  updateUserRoles,
} from "@/lib/actions/users";

type Users = Awaited<ReturnType<typeof listUsersWithRoles>>;
type Roles = Awaited<ReturnType<typeof listAllRoles>>;

export function UserManagement({
  users,
  roles,
  currentUserId,
}: {
  users: Users;
  roles: Roles;
  currentUserId: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await createUser(formData);
      setShowCreate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create user.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(userId: string, nextActive: boolean) {
    setError(null);
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("active", String(nextActive));
    try {
      await setUserActive(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update account status.");
    }
  }

  async function handleUnlock(userId: string) {
    setError(null);
    const formData = new FormData();
    formData.set("userId", userId);
    try {
      await unlockUser(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock account.");
    }
  }

  async function handleUpdateRoles(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await updateUserRoles(formData);
      setEditingUserId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update roles.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Card>
          <CardContent className="py-3 text-sm text-critical">{error}</CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setShowCreate((v) => !v)}>
          <UserPlus className="h-4 w-4" />
          New User
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="py-4">
            <form action={handleCreate} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" name="password" type="password" minLength={12} required />
                <p className="mt-1 text-xs text-neutral">At least 12 characters.</p>
              </div>
              <div>
                <Label>Roles</Label>
                <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm text-light">
                      <input type="checkbox" name="roleIds" value={role.id} />
                      {role.name}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-light">
                <input type="checkbox" name="isNational" />
                Grant national scope (no geographic restriction)
              </label>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating…" : "Create user"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Roles</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">MFA</th>
                <th className="py-2 font-medium">Last login</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <>
                  <tr key={u.id} className="border-t border-white/5 align-top">
                    <td className="py-2">
                      <div className="text-light">{u.name}</div>
                      <div className="text-xs text-neutral">{u.email}</div>
                    </td>
                    <td className="py-2 text-neutral">
                      {u.roles.map((ur) => ur.role.name).join(", ")}
                    </td>
                    <td className="py-2">
                      {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                        <Badge tone="critical">Locked</Badge>
                      ) : u.isActive ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="neutral">Inactive</Badge>
                      )}
                    </td>
                    <td className="py-2">
                      {u.mfaEnabled ? (
                        <ShieldCheck className="h-4 w-4 text-success" />
                      ) : (
                        <span className="text-xs text-neutral">Off</span>
                      )}
                    </td>
                    <td className="py-2 text-neutral">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-US") : "Never"}
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          onClick={() => setEditingUserId(editingUserId === u.id ? null : u.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                          <Button variant="secondary" onClick={() => handleUnlock(u.id)}>
                            <Unlock className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {u.id !== currentUserId && (
                          <Button
                            variant="secondary"
                            onClick={() => handleToggleActive(u.id, !u.isActive)}
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingUserId === u.id && (
                    <tr key={`${u.id}-edit`} className="border-t border-white/5 bg-white/[0.02]">
                      <td colSpan={6} className="py-3">
                        <form action={handleUpdateRoles} className="flex flex-col gap-2 px-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <p className="text-xs text-neutral">Editing roles for {u.name}</p>
                          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                            {roles.map((role) => (
                              <label key={role.id} className="flex items-center gap-2 text-sm text-light">
                                <input
                                  type="checkbox"
                                  name="roleIds"
                                  value={role.id}
                                  defaultChecked={u.roles.some((ur) => ur.role.id === role.id)}
                                />
                                {role.name}
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" disabled={loading}>
                              Save roles
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setEditingUserId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
