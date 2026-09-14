"use client";

import { useState } from "react";
import { KeyRound, Ban, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createApiKey, revokeApiKey, listApiKeys } from "@/lib/actions/api-keys";

type Keys = Awaited<ReturnType<typeof listApiKeys>>;

export function ApiKeyManagement({ keys }: { keys: Keys }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await createApiKey(formData);
      setNewKey(result.rawKey);
      setShowCreate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create API key.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setError(null);
    const formData = new FormData();
    formData.set("keyId", keyId);
    try {
      await revokeApiKey(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke key.");
    }
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Card>
          <CardContent className="py-3 text-sm text-critical">{error}</CardContent>
        </Card>
      )}

      {newKey && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm font-medium text-success">Key created — copy it now, it won't be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md bg-navy-secondary px-3 py-2 text-sm text-light">
                {newKey}
              </code>
              <Button variant="secondary" onClick={copyKey}>
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setShowCreate((v) => !v)}>
          <KeyRound className="h-4 w-4" />
          New API Key
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="py-4">
            <form action={handleCreate} className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="e.g. Media partner dashboard" required />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Key</th>
                <th className="py-2 font-medium">Created by</th>
                <th className="py-2 font-medium">Last used</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-white/5">
                  <td className="py-2 text-light">{k.name}</td>
                  <td className="py-2 font-mono text-xs text-neutral">{k.keyPrefix}…</td>
                  <td className="py-2 text-neutral">{k.createdBy?.name ?? "—"}</td>
                  <td className="py-2 text-neutral">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString("en-US") : "Never"}
                  </td>
                  <td className="py-2">
                    {k.revokedAt ? <Badge tone="critical">Revoked</Badge> : <Badge tone="success">Active</Badge>}
                  </td>
                  <td className="py-2 text-right">
                    {!k.revokedAt && (
                      <Button variant="secondary" onClick={() => handleRevoke(k.id)}>
                        <Ban className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-neutral">
                    No API keys yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
