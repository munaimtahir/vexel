ALTER TABLE "opd_notes"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "signedAt" TIMESTAMP(3),
  ADD COLUMN "signedBy" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "opd_encounters" SET "status" = 'REGISTERED' WHERE "status" = 'DRAFT';
UPDATE "opd_encounters" SET "status" = 'INTAKE_COMPLETE' WHERE "status" = 'READY_FOR_PRINT';
