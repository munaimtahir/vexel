ALTER TABLE "opd_doctors"
  ADD COLUMN "designation" TEXT,
  ADD COLUMN "degrees" TEXT,
  ADD COLUMN "pmdcNumber" TEXT,
  ADD COLUMN "phcNumber" TEXT,
  ADD COLUMN "clinicName" TEXT,
  ADD COLUMN "clinicAddress" TEXT,
  ADD COLUMN "clinicPhone" TEXT,
  ADD COLUMN "signatureLabel" TEXT,
  ADD COLUMN "signatureUrl" TEXT;

ALTER TABLE "opd_encounters"
  ADD COLUMN "diagnosis" TEXT,
  ADD COLUMN "advice" TEXT,
  ADD COLUMN "followUp" TEXT,
  ADD COLUMN "investigations" TEXT,
  ADD COLUMN "remarks" TEXT,
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledReason" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "opd_encounters"
SET "status" = CASE
  WHEN "status" = 'REGISTERED' THEN 'DRAFT'
  WHEN "status" = 'INTAKE_COMPLETED' THEN 'READY_FOR_PRINT'
  WHEN "status" = 'PRESCRIPTION_PUBLISHED' THEN 'COMPLETED'
  ELSE "status"
END;

ALTER TABLE "opd_notes"
  ADD COLUMN "diagnosis" TEXT,
  ADD COLUMN "followUp" TEXT,
  ADD COLUMN "investigations" TEXT,
  ADD COLUMN "remarks" TEXT;
