-- ElectIQ Sprint 7 — ElectIQ Copilot
-- Hand-authored and verified against a live PostgreSQL 16 instance (see
-- README's "About the Prisma setup").

CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COPILOT_QUERY';

CREATE TABLE "ai_conversations" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "electionId" TEXT,
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ai_messages" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "role" "AIMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "toolCalls" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");
