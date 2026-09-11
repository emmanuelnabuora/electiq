-- ElectIQ Sprint 5 — Election Integrity
-- Hand-authored and verified against a live PostgreSQL 16 instance (see
-- README's "About the Prisma setup").

CREATE TYPE "IntegrityRule" AS ENUM (
  'TURNOUT_GT_REGISTERED', 'VOTES_GT_VALID', 'CANDIDATE_TOTAL_MISMATCH',
  'DUPLICATE_RESULT', 'MISSING_RESULT_DOCUMENT', 'GPS_MISMATCH',
  'HIGH_REJECTED_BALLOT_RATE', 'UNUSUAL_TURNOUT_VARIANCE',
  'MULTIPLE_SUBMISSIONS', 'LATE_CORRECTION'
);

CREATE TYPE "IntegritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IntegrityAlertStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRITY_ALERT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRITY_ALERT_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRITY_ALERT_RESOLVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRITY_ALERT_DISMISSED';

CREATE TABLE "integrity_alerts" (
  "id" TEXT PRIMARY KEY,
  "rule" "IntegrityRule" NOT NULL,
  "severity" "IntegritySeverity" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "status" "IntegrityAlertStatus" NOT NULL DEFAULT 'OPEN',
  "assignedToId" TEXT,
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "integrity_alerts_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "integrity_alerts_rule_entityType_entityId_status_idx" ON "integrity_alerts"("rule", "entityType", "entityId", "status");
CREATE INDEX "integrity_alerts_status_severity_idx" ON "integrity_alerts"("status", "severity");
