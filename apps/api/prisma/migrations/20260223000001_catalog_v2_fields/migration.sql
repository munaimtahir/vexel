-- Migration: catalog_v2_fields
-- Adds externalId, userCode, loincCode, and other v2 fields to catalog models
-- Removes testIds[] from CatalogPanel (data lives in panel_test_mappings)
-- Adds displayOrder, isRequired, unitOverride to mapping tables

-- CatalogTest: new fields
ALTER TABLE "catalog_tests"
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ADD COLUMN IF NOT EXISTS "userCode"   TEXT,
  ADD COLUMN IF NOT EXISTS "loincCode"  TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "method"     TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_tests_tenantId_externalId_key"
  ON "catalog_tests"("tenantId", "externalId")
  WHERE "externalId" IS NOT NULL;

-- CatalogPanel: new fields + remove testIds[]
ALTER TABLE "catalog_panels"
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ADD COLUMN IF NOT EXISTS "userCode"   TEXT,
  ADD COLUMN IF NOT EXISTS "loincCode"  TEXT;

ALTER TABLE "catalog_panels" DROP COLUMN IF EXISTS "testIds";

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_panels_tenantId_externalId_key"
  ON "catalog_panels"("tenantId", "externalId")
  WHERE "externalId" IS NOT NULL;

-- Parameter: new fields
ALTER TABLE "parameters"
  ADD COLUMN IF NOT EXISTS "externalId"    TEXT,
  ADD COLUMN IF NOT EXISTS "userCode"      TEXT,
  ADD COLUMN IF NOT EXISTS "loincCode"     TEXT,
  ADD COLUMN IF NOT EXISTS "resultType"    TEXT NOT NULL DEFAULT 'numeric',
  ADD COLUMN IF NOT EXISTS "defaultUnit"   TEXT,
  ADD COLUMN IF NOT EXISTS "decimals"      INTEGER,
  ADD COLUMN IF NOT EXISTS "allowedValues" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "parameters_tenantId_externalId_key"
  ON "parameters"("tenantId", "externalId")
  WHERE "externalId" IS NOT NULL;

-- TestParameterMapping: new fields
ALTER TABLE "test_parameter_mappings"
  ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isRequired"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "unitOverride" TEXT;

-- PanelTestMapping: new field
ALTER TABLE "panel_test_mappings"
  ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;
