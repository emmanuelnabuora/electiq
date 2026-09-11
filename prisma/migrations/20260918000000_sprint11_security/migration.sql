-- ElectIQ Sprint 11 — Enterprise Security
-- Hand-authored and verified against a live PostgreSQL 16 instance (see
-- README's "About the Prisma setup").

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MFA_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MFA_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MFA_CHALLENGE_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MFA_CHALLENGE_FAILED';

ALTER TABLE "users" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "mfaSecretEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "mfaBackupCodesHashed" JSONB;

ALTER TABLE "audit_logs" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "previousHash" TEXT;

CREATE TABLE "user_sessions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "user_sessions_userId_createdAt_idx" ON "user_sessions"("userId", "createdAt");
