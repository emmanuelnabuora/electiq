-- ElectIQ Sprint 2 — GIS infrastructure + bulk import tracking
-- Hand-authored and verified against a live PostgreSQL 16 + PostGIS 3.4
-- instance for the same reason as migration 20260910000000_init (see its
-- header comment and the README's "About the Prisma setup" section).

CREATE EXTENSION IF NOT EXISTS postgis;

-- New audit actions for election/geography configuration and bulk import.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POSITION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANDIDATE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANDIDATE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANDIDATE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMINISTRATIVE_UNIT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POLLING_CENTER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POLLING_STATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IMPORT_STARTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IMPORT_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IMPORT_CANCELLED';

-- GIS columns
ALTER TABLE "administrative_units" ADD COLUMN "boundary" geometry(MultiPolygon, 4326);
CREATE INDEX "administrative_units_boundary_idx" ON "administrative_units" USING GIST ("boundary");

ALTER TABLE "polling_centers" ADD COLUMN "location" geography(Point, 4326);
CREATE INDEX "polling_centers_location_idx" ON "polling_centers" USING GIST ("location");

-- Bulk import tracking
CREATE TYPE "ImportEntityType" AS ENUM ('POLLING_STATIONS');
CREATE TYPE "ImportStatus" AS ENUM ('PENDING_CONFIRMATION', 'IMPORTED', 'FAILED', 'CANCELLED');

CREATE TABLE "import_jobs" (
  "id" TEXT PRIMARY KEY,
  "entityType" "ImportEntityType" NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "fileName" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "errorRows" INTEGER NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "import_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "import_errors" (
  "id" TEXT PRIMARY KEY,
  "importJobId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "columnName" TEXT,
  "message" TEXT NOT NULL,
  "rawRow" JSONB NOT NULL,
  "unitId" TEXT,
  CONSTRAINT "import_errors_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "import_errors_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "administrative_units"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
