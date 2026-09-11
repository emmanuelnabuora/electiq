"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      mfaCode: mfaRequired ? mfaCode : undefined,
      redirect: false,
    });

    setSubmitting(false);

    if (result?.error === "MFA_REQUIRED") {
      setMfaRequired(true);
      return;
    }
    if (result?.error === "MFA_INVALID") {
      setError("That code is incorrect. Check your authenticator app, or use a backup code.");
      return;
    }
    if (result?.error === "RATE_LIMITED") {
      setError("Too many login attempts from this network. Try again in a few minutes.");
      return;
    }
    if (result?.error) {
      setError("Email or password is incorrect, or the account is locked.");
      return;
    }

    router.push("/command-center");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-primary px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15">
            <ShieldCheck className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-light">ElectIQ</h1>
            <p className="text-sm text-neutral">Election Intelligence Platform</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {!mfaRequired && (
                <>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@electiq.example"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </>
              )}

              {mfaRequired && (
                <div>
                  <Label htmlFor="mfaCode">Authentication code</Label>
                  <p className="mb-2 text-xs text-neutral">
                    Enter the 6-digit code from your authenticator app, or a backup code.
                  </p>
                  <Input
                    id="mfaCode"
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-critical">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Signing in…" : mfaRequired ? "Verify" : "Sign in"}
              </Button>

              {mfaRequired && (
                <button
                  type="button"
                  onClick={() => {
                    setMfaRequired(false);
                    setMfaCode("");
                    setError(null);
                  }}
                  className="text-xs text-neutral hover:text-light"
                >
                  ← Back
                </button>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-neutral">
          Every sign-in attempt is recorded to the audit log.
        </p>
        <p className="mt-2 text-center text-xs">
          <Link href="/public" className="text-accent hover:underline">
            View public election results →
          </Link>
        </p>
      </div>
    </main>
  );
}
