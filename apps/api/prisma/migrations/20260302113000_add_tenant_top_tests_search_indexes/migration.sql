CREATE TABLE IF NOT EXISTS "tenant_top_tests" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_top_tests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_top_tests_tenantId_rank_key" ON "tenant_top_tests"("tenantId", "rank");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_top_tests_tenantId_testId_key" ON "tenant_top_tests"("tenantId", "testId");
CREATE INDEX IF NOT EXISTS "tenant_top_tests_tenantId_rank_idx" ON "tenant_top_tests"("tenantId", "rank");

CREATE INDEX IF NOT EXISTS "catalog_tests_tenantId_userCode_idx" ON "catalog_tests"("tenantId", "userCode");
CREATE INDEX IF NOT EXISTS "catalog_tests_tenantId_name_idx" ON "catalog_tests"("tenantId", "name");

DO $$ BEGIN
  ALTER TABLE "tenant_top_tests"
    ADD CONSTRAINT "tenant_top_tests_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_top_tests"
    ADD CONSTRAINT "tenant_top_tests_testId_fkey"
    FOREIGN KEY ("testId") REFERENCES "catalog_tests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
