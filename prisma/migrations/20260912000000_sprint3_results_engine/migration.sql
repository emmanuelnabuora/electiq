-- ElectIQ Sprint 3 — Results Engine
-- Hand-authored and verified against a live PostgreSQL 16 instance for the
-- same reason as prior migrations (see README's "About the Prisma setup").

CREATE TYPE "ResultStatus" AS ENUM (
  'DRAFT', 'SUBMITTED', 'VALIDATION_FAILED', 'AWAITING_REVIEW', 'VERIFIED',
  'FLAGGED', 'DISPUTED', 'CORRECTED', 'APPROVED', 'PUBLISHED'
);

CREATE TYPE "VerificationDecision" AS ENUM ('VERIFIED', 'FLAGGED', 'DISPUTED');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESULT_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESULT_VALIDATION_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESULT_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESULT_FLAGGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESULT_DISPUTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESULT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESULT_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESULT_DOCUMENT_UPLOADED';

CREATE TABLE "result_submissions" (
  "id" TEXT PRIMARY KEY,
  "electionId" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "pollingStationId" TEXT NOT NULL,
  "submittedById" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "previousVersionId" TEXT UNIQUE,
  "status" "ResultStatus" NOT NULL DEFAULT 'DRAFT',
  "registeredVoters" INTEGER NOT NULL,
  "ballotsIssued" INTEGER NOT NULL,
  "votesCast" INTEGER NOT NULL,
  "validVotes" INTEGER NOT NULL,
  "rejectedBallots" INTEGER NOT NULL,
  "gpsLatitude" DOUBLE PRECISION,
  "gpsLongitude" DOUBLE PRECISION,
  "changeReason" TEXT,
  "validationErrors" JSONB,
  "submittedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "result_submissions_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "result_submissions_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "election_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "result_submissions_pollingStationId_fkey" FOREIGN KEY ("pollingStationId") REFERENCES "polling_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "result_submissions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "result_submissions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "result_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "result_submissions_election_position_station_version_key" ON "result_submissions"("electionId", "positionId", "pollingStationId", "version");
CREATE INDEX "result_submissions_election_position_station_status_idx" ON "result_submissions"("electionId", "positionId", "pollingStationId", "status");

CREATE TABLE "candidate_results" (
  "id" TEXT PRIMARY KEY,
  "submissionId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "votes" INTEGER NOT NULL,
  CONSTRAINT "candidate_results_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "result_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "candidate_results_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "candidate_results_submissionId_candidateId_key" ON "candidate_results"("submissionId", "candidateId");

CREATE TABLE "result_verifications" (
  "id" TEXT PRIMARY KEY,
  "submissionId" TEXT NOT NULL,
  "verifierId" TEXT,
  "decision" "VerificationDecision" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "result_verifications_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "result_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "result_verifications_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "result_verifications_submissionId_createdAt_idx" ON "result_verifications"("submissionId", "createdAt");

CREATE TABLE "result_documents" (
  "id" TEXT PRIMARY KEY,
  "submissionId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "uploadedById" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "result_documents_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "result_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "result_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "result_documents_submissionId_idx" ON "result_documents"("submissionId");
