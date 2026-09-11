import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { verifyAuditChain } from "@/lib/security/audit-chain";
import { checkSecurityConfig } from "@/lib/security/env-check";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MfaSetup } from "@/components/security/mfa-setup";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export default async function SecurityPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const sessions = await db.userSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const canReadAudit = await authorize(userId, "audit", "read");
  const chainResult = canReadAudit ? await verifyAuditChain() : null;
  const configWarnings = canReadAudit ? checkSecurityConfig() : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-light">Security</h1>
        <p className="text-sm text-neutral">Multi-factor authentication, recent sessions, and audit integrity.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Multi-factor authentication</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <MfaSetup mfaEnabled={user.mfaEnabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">IP address</th>
                <th className="py-2 font-medium">Device</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="py-2 text-light">{s.ipAddress ?? "Unknown"}</td>
                  <td className="max-w-xs truncate py-2 text-neutral">{s.userAgent ?? "Unknown"}</td>
                  <td className="py-2 text-neutral">{s.createdAt.toLocaleString("en-US")}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-neutral">
                    No sessions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-neutral">
            This is informational only — a device or location you don&apos;t recognize is worth a
            second look, but this page never blocks access on its own.
          </p>
        </CardContent>
      </Card>

      {canReadAudit && chainResult && (
        <Card>
          <CardHeader>
            <CardTitle>Audit log integrity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 py-4 text-sm">
            <p className="flex items-center gap-2">
              {chainResult.valid ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-success" />
                  <span className="text-success">Chain verified — no tampering detected</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-critical" />
                  <span className="text-critical">
                    Chain broken at {chainResult.brokenAt.length} record(s) — investigate immediately
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-neutral">
              {chainResult.totalChecked} records checked, {chainResult.unchained} written before this
              feature existed (not part of the chain).
            </p>
          </CardContent>
        </Card>
      )}

      {canReadAudit && configWarnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration warnings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 py-4">
            {configWarnings.map((w) => (
              <div key={w.key} className="flex items-center gap-2 text-sm">
                <Badge tone={w.severity === "critical" ? "critical" : "warning"}>{w.severity}</Badge>
                <span className="text-neutral">{w.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
