-- Sprint 13: API Management -- per-key rate limits on the public API.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'API_KEY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'API_KEY_REVOKED';

CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
