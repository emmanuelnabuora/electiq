"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { startMfaEnrollment, confirmMfaEnrollment, disableMfa } from "@/lib/actions/mfa";

export function MfaSetup({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [enrolling, setEnrolling] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(mfaEnabled);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const result = await startMfaEnrollment();
      setSecret(result.secret);
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setEnrolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start MFA enrollment.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!secret) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("secret", secret);
      formData.set("code", code);
      const result = await confirmMfaEnrollment(formData);
      setBackupCodes(result.backupCodes);
      setEnabled(true);
      setEnrolling(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm MFA enrollment.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("password", password);
      await disableMfa(formData);
      setEnabled(false);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable MFA.");
    } finally {
      setLoading(false);
    }
  }

  if (backupCodes) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <ShieldCheck className="h-4 w-4" />
            MFA enabled
          </p>
          <p className="text-sm text-neutral">
            Save these backup codes somewhere safe — each one can be used once if you lose access to
            your authenticator app. They will not be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-md bg-navy-secondary p-3 font-mono text-sm text-light">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <Button onClick={() => setBackupCodes(null)}>Done</Button>
        </CardContent>
      </Card>
    );
  }

  if (enabled) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <ShieldCheck className="h-4 w-4" />
            MFA is enabled on your account
          </p>
          <form onSubmit={handleDisable} className="flex flex-col gap-2">
            <Label htmlFor="disable-password">Enter your password to disable MFA</Label>
            <Input
              id="disable-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-critical">{error}</p>}
            <Button type="submit" variant="secondary" disabled={loading}>
              <ShieldOff className="h-4 w-4" />
              {loading ? "Disabling…" : "Disable MFA"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (enrolling && secret && qrCodeDataUrl) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="text-sm text-light">Scan this code with your authenticator app:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeDataUrl} alt="MFA enrollment QR code" className="h-40 w-40 self-center rounded-md bg-white p-2" />
          <p className="text-center text-xs text-neutral">
            Can&apos;t scan? Enter this key manually: <span className="font-mono text-light">{secret}</span>
          </p>
          <form onSubmit={handleConfirm} className="flex flex-col gap-2">
            <Label htmlFor="confirm-code">Enter the 6-digit code from your app</Label>
            <Input
              id="confirm-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
            />
            {error && <p className="text-sm text-critical">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Verifying…" : "Confirm and enable MFA"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <p className="text-sm text-neutral">
          Multi-factor authentication adds a second step at login using an authenticator app (Google
          Authenticator, Authy, 1Password, etc.).
        </p>
        {error && <p className="text-sm text-critical">{error}</p>}
        <Button onClick={handleStart} disabled={loading}>
          <ShieldCheck className="h-4 w-4" />
          {loading ? "Starting…" : "Set up MFA"}
        </Button>
      </CardContent>
    </Card>
  );
}
