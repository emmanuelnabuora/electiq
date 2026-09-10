-- ElectIQ Sprint 1 — initial schema
-- This migration was authored by hand to exactly match prisma/schema.prisma
-- because this build environment could not reach binaries.prisma.sh to run
-- `prisma migrate dev` (see README "Known Limitations"). Regenerate/verify
-- it with `npx prisma migrate dev` the first time you run this project
-- somewhere with normal network access — Prisma will detect the schema
-- already matches and simply mark this migration as applied, or report any
-- drift if this file needs correction.

-- Enums
CREATE TYPE "RoleName" AS ENUM (
  'SUPER_ADMIN', 'ELECTION_COMMISSIONER', 'NATIONAL_RETURNING_OFFICER',
  'REGIONAL_OFFICER', 'CONSTITUENCY_OFFICER', 'POLLING_OFFICER', 'OBSERVER',
  'ANALYST', 'MEDIA_USER', 'AUDITOR', 'PARTY_AGENT'
);

CREATE TYPE "ElectionStatus" AS ENUM (
  'DRAFT', 'CONFIGURED', 'ACTIVE', 'CLOSED', 'ARCHIVED'
);

CREATE TYPE "AuditAction" AS ENUM (
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'USER_CREATED',
  'ROLE_ASSIGNED', 'PERMISSION_DENIED', 'ELECTION_CREATED', 'ELECTION_UPDATED'
);

-- Identity & RBAC
CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "roles" (
  "id" TEXT PRIMARY KEY,
  "name" "RoleName" NOT NULL,
  "description" TEXT NOT NULL
);
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

CREATE TABLE "permissions" (
  "id" TEXT PRIMARY KEY,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT NOT NULL
);
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

CREATE TABLE "role_permissions" (
  "id" TEXT PRIMARY KEY,
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

CREATE TABLE "user_roles" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- Geography
CREATE TABLE "countries" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "isoCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");
CREATE UNIQUE INDEX "countries_isoCode_key" ON "countries"("isoCode");

CREATE TABLE "administrative_levels" (
  "id" TEXT PRIMARY KEY,
  "countryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "depth" INTEGER NOT NULL,
  CONSTRAINT "administrative_levels_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "administrative_levels_countryId_depth_key" ON "administrative_levels"("countryId", "depth");

CREATE TABLE "administrative_units" (
  "id" TEXT PRIMARY KEY,
  "levelId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "administrative_units_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "administrative_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "administrative_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "administrative_units"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "administrative_units_levelId_code_key" ON "administrative_units"("levelId", "code");

CREATE TABLE "user_scopes" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "isNational" BOOLEAN NOT NULL DEFAULT false,
  "scopeUnitId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_scopes_scopeUnitId_fkey" FOREIGN KEY ("scopeUnitId") REFERENCES "administrative_units"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "polling_centers" (
  "id" TEXT PRIMARY KEY,
  "unitId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "polling_centers_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "administrative_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "polling_centers_code_key" ON "polling_centers"("code");

CREATE TABLE "polling_stations" (
  "id" TEXT PRIMARY KEY,
  "pollingCenterId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "registeredVoters" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "polling_stations_pollingCenterId_fkey" FOREIGN KEY ("pollingCenterId") REFERENCES "polling_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "polling_stations_code_key" ON "polling_stations"("code");

-- Election foundation
CREATE TABLE "elections" (
  "id" TEXT PRIMARY KEY,
  "countryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "electionDate" TIMESTAMP(3) NOT NULL,
  "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "elections_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "election_positions" (
  "id" TEXT PRIMARY KEY,
  "electionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "election_positions_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "election_positions_electionId_name_key" ON "election_positions"("electionId", "name");

CREATE TABLE "parties" (
  "id" TEXT PRIMARY KEY,
  "electionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "abbreviation" TEXT NOT NULL,
  "colorHex" TEXT,
  CONSTRAINT "parties_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "parties_electionId_abbreviation_key" ON "parties"("electionId", "abbreviation");

CREATE TABLE "candidates" (
  "id" TEXT PRIMARY KEY,
  "electionId" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "partyId" TEXT,
  "fullName" TEXT NOT NULL,
  CONSTRAINT "candidates_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "candidates_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "election_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "candidates_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Audit
CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "ipAddress" TEXT,
  "previousState" JSONB,
  "newState" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
