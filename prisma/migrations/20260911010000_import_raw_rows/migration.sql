-- ElectIQ Sprint 2 follow-up — persist parsed import rows between the
-- preview and confirm steps of the bulk import flow (Section 21).
ALTER TABLE "import_jobs" ADD COLUMN "rawRows" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "import_jobs" ALTER COLUMN "rawRows" DROP DEFAULT;
