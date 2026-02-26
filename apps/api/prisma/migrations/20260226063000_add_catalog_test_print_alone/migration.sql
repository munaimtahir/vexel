-- Ensure catalog_tests includes printAlone used by seed and document rendering
ALTER TABLE "catalog_tests"
  ADD COLUMN IF NOT EXISTS "printAlone" BOOLEAN NOT NULL DEFAULT false;
