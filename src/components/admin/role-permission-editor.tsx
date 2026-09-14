"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateRolePermissions } from "@/lib/actions/roles";

type Permission = { id: string; resource: string; action: string; description: string };

export function RolePermissionEditor({
  roleId,
  allPermissions,
  grantedPermissionIds,
}: {
  roleId: string;
  allPermissions: Permission[];
  grantedPermissionIds: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(false);
    formData.set("roleId", roleId);
    try {
      await updateRolePermissions(formData);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update permissions.");
    } finally {
      setLoading(false);
    }
  }

  const byResource = new Map<string, Permission[]>();
  for (const p of allPermissions) {
    const list = byResource.get(p.resource) ?? [];
    list.push(p);
    byResource.set(p.resource, list);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      {Array.from(byResource.entries()).map(([resource, perms]) => (
        <div key={resource}>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral">{resource}</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {perms.map((p) => (
              <label key={p.id} className="flex items-start gap-2 text-sm text-light" title={p.description}>
                <input
                  type="checkbox"
                  name="permissionIds"
                  value={p.id}
                  defaultChecked={grantedPermissionIds.includes(p.id)}
                  className="mt-0.5"
                />
                <span>{p.action}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-critical">{error}</p>}
      {success && <p className="text-sm text-success">Saved.</p>}

      <div>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save permissions"}
        </Button>
      </div>
    </form>
  );
}
