-- ElectIQ Sprint 9 — Scenario Intelligence
-- Hand-authored and verified against a live PostgreSQL 16 instance (see
-- README's "About the Prisma setup").

CREATE TYPE "ScenarioType" AS ENUM ('REMAINING_REPORT', 'TURNOUT_ADJUSTMENT', 'SWING_ADJUSTMENT', 'RUNOFF');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SCENARIO_RUN_CREATED';

CREATE TABLE "scenario_runs" (
  "id" TEXT PRIMARY KEY,
  "electionId" TEXT NOT NULL,
  "positionName" TEXT NOT NULL,
  "scenarioType" "ScenarioType" NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "assumptions" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "confidenceNote" TEXT NOT NULL,
  "executedById" TEXT,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scenario_runs_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scenario_runs_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "scenario_runs_election_type_executed_idx" ON "scenario_runs"("electionId", "scenarioType", "executedAt");
