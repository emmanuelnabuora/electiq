import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await db.user.findUnique({
          where: { email },
          include: { roles: { include: { role: true } } },
        });

        // Do not distinguish "no such user" from "wrong password" in the
        // response — but do audit the attempt either way.
        if (!user) {
          await recordAudit({ action: "LOGIN_FAILED", reason: `No such user: ${email}` });
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await recordAudit({
            actorId: user.id,
            action: "LOGIN_FAILED",
            reason: "Account locked",
          });
          return null;
        }

        if (!user.isActive) {
          await recordAudit({
            actorId: user.id,
            action: "LOGIN_FAILED",
            reason: "Account inactive",
          });
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
          });
          return null;
        }

        await db.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        await recordAudit({ actorId: user.id, action: "LOGIN" });

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
