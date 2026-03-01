-- Add sample_types catalog entity and optional link from catalog_tests.

CREATE TABLE IF NOT EXISTS "sample_types" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "externalId" TEXT,
  "userCode" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sample_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_sample_type_externalId"
  ON "sample_types"("tenantId", "externalId");
CREATE INDEX IF NOT EXISTS "sample_types_tenantId_isActive_idx"
  ON "sample_types"("tenantId", "isActive");

ALTER TABLE "sample_types"
  ADD CONSTRAINT "sample_types_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "catalog_tests"
  ADD COLUMN IF NOT EXISTS "sampleTypeId" TEXT;

CREATE INDEX IF NOT EXISTS "catalog_tests_sampleTypeId_idx"
  ON "catalog_tests"("sampleTypeId");

ALTER TABLE "catalog_tests"
  ADD CONSTRAINT "catalog_tests_sampleTypeId_fkey"
  FOREIGN KEY ("sampleTypeId") REFERENCES "sample_types"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "reference_ranges_testId_idx"
  ON "reference_ranges"("testId");

ALTER TABLE "reference_ranges"
  ADD CONSTRAINT "reference_ranges_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "catalog_tests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
