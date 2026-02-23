-- Migration: workflow_schema_v2
-- Adds: patient fields, catalog specimenType+price, encounter code,
--       laborder resultStatus+snapshot, labresult per-parameter restructure,
--       specimen_items table, tenantconfig prefix fields

-- DropIndex (LabResult no longer unique per labOrder — now per parameter)
DROP INDEX IF EXISTS "lab_results_labOrderId_key";

-- AlterTable catalog_tests
ALTER TABLE "catalog_tests"
  ADD COLUMN "specimenType" TEXT,
  ADD COLUMN "price" DECIMAL(10,2);

-- AlterTable encounters
ALTER TABLE "encounters" ADD COLUMN "encounterCode" TEXT;

-- AlterTable lab_orders
ALTER TABLE "lab_orders"
  ADD COLUMN "resultStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "testNameSnapshot" TEXT;

-- AlterTable lab_results
ALTER TABLE "lab_results"
  DROP COLUMN IF EXISTS "resultedAt",
  DROP COLUMN IF EXISTS "resultedBy",
  ADD COLUMN IF NOT EXISTS "parameterId" TEXT,
  ADD COLUMN IF NOT EXISTS "parameterNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "enteredById" TEXT;

-- AlterTable patients
ALTER TABLE "patients"
  ADD COLUMN "mobile" TEXT,
  ADD COLUMN "cnic" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "ageYears" INTEGER;

-- AlterTable tenant_configs
ALTER TABLE "tenant_configs"
  ADD COLUMN "registrationPrefix" TEXT,
  ADD COLUMN "orderPrefix" TEXT;

-- CreateTable specimen_items
CREATE TABLE "specimen_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "catalogSpecimenType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "barcode" TEXT,
    "collectedAt" TIMESTAMP(3),
    "collectedById" TEXT,
    "postponedAt" TIMESTAMP(3),
    "postponedById" TEXT,
    "postponeReason" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specimen_items_pkey" PRIMARY KEY ("id")
);

-- Indexes on specimen_items
CREATE INDEX "specimen_items_tenantId_status_idx" ON "specimen_items"("tenantId", "status");
CREATE INDEX "specimen_items_tenantId_encounterId_idx" ON "specimen_items"("tenantId", "encounterId");
CREATE UNIQUE INDEX "specimen_items_tenantId_encounterId_catalogSpecimenType_key"
  ON "specimen_items"("tenantId", "encounterId", "catalogSpecimenType");

-- FKs on specimen_items
ALTER TABLE "specimen_items"
  ADD CONSTRAINT "specimen_items_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "specimen_items_encounterId_fkey"
    FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New indexes
CREATE UNIQUE INDEX IF NOT EXISTS "encounters_tenantId_encounterCode_key"
  ON "encounters"("tenantId", "encounterCode");
CREATE INDEX IF NOT EXISTS "lab_orders_tenantId_resultStatus_idx"
  ON "lab_orders"("tenantId", "resultStatus");
CREATE INDEX IF NOT EXISTS "lab_results_tenantId_labOrderId_idx"
  ON "lab_results"("tenantId", "labOrderId");
CREATE INDEX IF NOT EXISTS "patients_tenantId_mobile_idx"
  ON "patients"("tenantId", "mobile");
