-- ElectIQ Sprint 6 — Field Operations
-- Hand-authored and verified against a live PostgreSQL 16 instance (see
-- README's "About the Prisma setup").

CREATE TYPE "FieldAssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "FieldReportType" AS ENUM ('OPENING', 'TURNOUT', 'COUNTING', 'CLOSING', 'GENERAL');
CREATE TYPE "FieldReportStatus" AS ENUM ('QUEUED', 'SUBMITTED', 'REJECTED');
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'OBSERVER_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FIELD_ASSIGNMENT_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FIELD_CHECK_IN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FIELD_REPORT_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TURNOUT_SNAPSHOT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INCIDENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INCIDENT_EVIDENCE_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INCIDENT_ACKNOWLEDGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INCIDENT_RESOLVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INCIDENT_DISMISSED';

CREATE TABLE "observers" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "organization" TEXT,
  "accreditationNumber" TEXT,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "observers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "observer_assignments" (
  "id" TEXT PRIMARY KEY,
  "observerId" TEXT NOT NULL,
  "pollingStationId" TEXT NOT NULL,
  "status" "FieldAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "checkedInAt" TIMESTAMP(3),
  "checkInLatitude" DOUBLE PRECISION,
  "checkInLongitude" DOUBLE PRECISION,
  CONSTRAINT "observer_assignments_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "observers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "observer_assignments_pollingStationId_fkey" FOREIGN KEY ("pollingStationId") REFERENCES "polling_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "observer_assignments_observerId_pollingStationId_key" ON "observer_assignments"("observerId", "pollingStationId");

CREATE TABLE "field_reports" (
  "id" TEXT PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "type" "FieldReportType" NOT NULL,
  "status" "FieldReportStatus" NOT NULL DEFAULT 'SUBMITTED',
  "content" JSONB NOT NULL,
  "gpsLatitude" DOUBLE PRECISION,
  "gpsLongitude" DOUBLE PRECISION,
  "clientReportId" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_reports_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "observer_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "field_reports_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "field_reports_assignmentId_clientReportId_key" ON "field_reports"("assignmentId", "clientReportId");

CREATE TABLE "turnout_snapshots" (
  "id" TEXT PRIMARY KEY,
  "electionId" TEXT NOT NULL,
  "pollingStationId" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "votersProcessed" INTEGER NOT NULL,
  "registeredVoters" INTEGER NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'FIELD',
  "notes" TEXT,
  CONSTRAINT "turnout_snapshots_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "turnout_snapshots_pollingStationId_fkey" FOREIGN KEY ("pollingStationId") REFERENCES "polling_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "turnout_snapshots_electionId_observedAt_idx" ON "turnout_snapshots"("electionId", "observedAt");

CREATE TABLE "incidents" (
  "id" TEXT PRIMARY KEY,
  "electionId" TEXT NOT NULL,
  "pollingStationId" TEXT,
  "reportedById" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
  "gpsLatitude" DOUBLE PRECISION,
  "gpsLongitude" DOUBLE PRECISION,
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "incidents_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incidents_pollingStationId_fkey" FOREIGN KEY ("pollingStationId") REFERENCES "polling_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "incidents_status_severity_idx" ON "incidents"("status", "severity");

CREATE TABLE "incident_evidence" (
  "id" TEXT PRIMARY KEY,
  "incidentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "uploadedById" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_evidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incident_evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "incident_evidence_incidentId_idx" ON "incident_evidence"("incidentId");
