import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { decryptTotpSecret, verifyTotpCode, verifyBackupCode } from "@/lib/security/mfa";
import { checkLoginRateLimit } from "@/lib/security/login-rate-limit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function extractRequestMeta(req: { headers?: Record<string, string> } | undefined) {
  const headers = req?.headers ?? {};
  const forwardedFor = headers["x-forwarded-for"];
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const userAgent = headers["user-agent"] ?? null;
  return { ipAddress, userAgent };
}

export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 hour session
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mfaCode: { label: "MFA Code", type: "text" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const { ipAddress, userAgent } = extractRequestMeta(req);

        if (ipAddress && !checkLoginRateLimit(ipAddress)) {
          await recordAudit({ action: "LOGIN_FAILED", reason: "Rate limit exceeded", ipAddress });
          throw new Error("RATE_LIMITED");
        }

        const user = await db.user.findUnique({
          where: { email },
          include: { roles: { include: { role: true } } },
        });

        // Do not distinguish "no such user" from "wrong password" in the
        // response — but do audit the attempt either way.
        if (!user) {
          await recordAudit({ action: "LOGIN_FAILED", reason: `No such user: ${email}`, ipAddress });
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await recordAudit({ actorId: user.id, action: "LOGIN_FAILED", reason: "Account locked", ipAddress });
          return null;
        }

        if (!user.isActive) {
          await recordAudit({ actorId: user.id, action: "LOGIN_FAILED", reason: "Account inactive", ipAddress });
          return null;
        }

        const passwordValid = await bcrypt.compare(password, user.passwordHash);

        if (!passwordValid) {
          const failedLoginCount = user.failedLoginCount + 1;
          const shouldLock = failedLoginCount >= MAX_FAILED_ATTEMPTS;

          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount,
              lockedUntil: shouldLock
                ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                : user.lockedUntil,
            },
          });

          await recordAudit({
            actorId: user.id,
            action: shouldLock ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
            reason: shouldLock
              ? `Locked after ${failedLoginCount} failed attempts`
              : "Invalid password",
            ipAddress,
          });
          return null;
        }

        // Section 11 — MFA. Password is correct; if MFA is enabled on
        // this account, a second factor is required before the session
        // is issued. Throwing a distinct error (rather than returning
        // null) lets the login page tell "wrong password" apart from
        // "you need to enter your MFA code" and prompt accordingly.
        if (user.mfaEnabled) {
          const submittedCode = credentials?.mfaCode?.trim();
          if (!submittedCode) {
            throw new Error("MFA_REQUIRED");
          }

          let mfaValid = false;
          if (user.mfaSecretEncrypted) {
            const secret = decryptTotpSecret(user.mfaSecretEncrypted);
            mfaValid = await verifyTotpCode(secret, submittedCode);
          }

          if (!mfaValid && user.mfaBackupCodesHashed) {
            const hashedCodes = user.mfaBackupCodesHashed as string[];
            const consumedIndex = await verifyBackupCode(submittedCode, hashedCodes);
            if (consumedIndex !== null) {
              mfaValid = true;
              const remaining = hashedCodes.filter((_, i) => i !== consumedIndex);
              await db.user.update({
                where: { id: user.id },
                data: { mfaBackupCodesHashed: remaining },
              });
            }
          }

          if (!mfaValid) {
            await recordAudit({ actorId: user.id, action: "MFA_CHALLENGE_FAILED", ipAddress });
            throw new Error("MFA_INVALID");
          }

          await recordAudit({ actorId: user.id, action: "MFA_CHALLENGE_SUCCEEDED", ipAddress });
        }

        await db.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        await recordAudit({ actorId: user.id, action: "LOGIN", ipAddress });

        // Section 11 — session/device monitoring. A lightweight record of
        // this login's device/network context, purely informational: it
        // never auto-blocks anything, only lets the account owner (or an
        // admin reviewing their own account) see recent access.
        await db.userSession.create({
          data: { userId: user.id, ipAddress, userAgent },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles.map((r) => r.role.name),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.roles = user.roles;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.userId as string;
        (session.user as { roles?: string[] }).roles = token.roles as string[];
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.userId) {
        await recordAudit({ actorId: token.userId as string, action: "LOGOUT" });
      }
    },
  },
};
