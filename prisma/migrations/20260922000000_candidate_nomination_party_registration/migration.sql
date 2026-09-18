-- Real nomination-vetting lifecycle for candidates and a real
-- registration lifecycle + geographic coverage for parties -- these
-- fields did not exist anywhere in the schema before this migration.
-- Added because the approved Candidates/Parties screen designs called
-- for them, and fabricating them as UI-only labels with no real data
-- behind them was rejected in favor of building the real thing.

CREATE TYPE "NominationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "PartyRegistrationStatus" AS ENUM ('PENDING', 'REGISTERED', 'SUSPENDED');
ALTER TYPE "AuditAction" ADD VALUE 'CANDIDATE_DOCUMENT_UPLOADED';

ALTER TABLE "candidates" ADD COLUMN "nominationStatus" "NominationStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "candidates" ADD COLUMN "nominationNotes" TEXT;

ALTER TABLE "parties" ADD COLUMN "registrationStatus" "PartyRegistrationStatus" NOT NULL DEFAULT 'PENDING';

CREATE TABLE "candidate_documents" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "uploadedById" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_documents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "candidate_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "candidate_documents_candidateId_idx" ON "candidate_documents"("candidateId");

CREATE TABLE "party_geographic_coverage" (
  "id" TEXT PRIMARY KEY,
  "partyId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  CONSTRAINT "party_geographic_coverage_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "party_geographic_coverage_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "administrative_units"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "party_geographic_coverage_partyId_unitId_key" UNIQUE ("partyId", "unitId")
);
