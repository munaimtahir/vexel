-- Migration: drop_code_add_defaultvalue
-- Drop code column and its unique constraints from catalog tables
-- Add defaultValue column to parameters

-- CatalogTest: drop unique constraint on (tenantId, code) then drop column
ALTER TABLE "catalog_tests" DROP CONSTRAINT IF EXISTS "catalog_tests_tenantId_code_key";
ALTER TABLE "catalog_tests" DROP COLUMN IF EXISTS "code";

-- CatalogPanel: same
ALTER TABLE "catalog_panels" DROP CONSTRAINT IF EXISTS "catalog_panels_tenantId_code_key";
ALTER TABLE "catalog_panels" DROP COLUMN IF EXISTS "code";

-- Parameter: same
ALTER TABLE "parameters" DROP CONSTRAINT IF EXISTS "parameters_tenantId_code_key";
ALTER TABLE "parameters" DROP COLUMN IF EXISTS "code";

-- Parameter: add defaultValue column
ALTER TABLE "parameters" ADD COLUMN IF NOT EXISTS "defaultValue" TEXT;
