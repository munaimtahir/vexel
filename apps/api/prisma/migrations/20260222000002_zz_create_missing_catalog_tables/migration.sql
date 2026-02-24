-- Migration: create_missing_catalog_tables
-- Several tables (parameters, test_parameter_mappings, panel_test_mappings,
-- reference_ranges, job_runs) were created during development via prisma migrate dev
-- but the CREATE TABLE statements were never included in migration files.
-- This migration fills those gaps for fresh-DB deploys (CI).
-- All statements are idempotent (IF NOT EXISTS / EXCEPTION WHEN duplicate_object).
--
-- IMPORTANT: Only base columns included here.
-- Later migrations add columns via ALTER TABLE:
--   catalog_v2_fields:         externalId, userCode, loincCode, resultType,
--                              defaultUnit, decimals, allowedValues to parameters;
--                              displayOrder, isRequired, unitOverride to test_parameter_mappings;
--                              displayOrder to panel_test_mappings
--   ucum_cascade_specimen_receive: ucumCode to parameters;
--                                  parameterId FK on test_parameter_mappings
--   drop_code_add_defaultvalue: defaultValue to parameters

-- ── parameters ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "parameters" (
    "id"        TEXT         NOT NULL,
    "tenantId"  TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "unit"      TEXT,
    "dataType"  TEXT         NOT NULL DEFAULT 'numeric',
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parameters_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "parameters_tenantId_isActive_idx"
    ON "parameters"("tenantId", "isActive");
DO $$ BEGIN
  ALTER TABLE "parameters" ADD CONSTRAINT "parameters_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── test_parameter_mappings ───────────────────────────────────────────────────
-- NOTE: parameterId FK is added by ucum_cascade_specimen_receive migration
CREATE TABLE IF NOT EXISTS "test_parameter_mappings" (
    "id"          TEXT    NOT NULL,
    "tenantId"    TEXT    NOT NULL,
    "testId"      TEXT    NOT NULL,
    "parameterId" TEXT    NOT NULL,
    "ordering"    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "test_parameter_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "test_parameter_mappings_tenantId_testId_parameterId_key"
    ON "test_parameter_mappings"("tenantId", "testId", "parameterId");
CREATE INDEX IF NOT EXISTS "test_parameter_mappings_tenantId_testId_idx"
    ON "test_parameter_mappings"("tenantId", "testId");
DO $$ BEGIN
  ALTER TABLE "test_parameter_mappings" ADD CONSTRAINT "test_parameter_mappings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "test_parameter_mappings" ADD CONSTRAINT "test_parameter_mappings_testId_fkey"
    FOREIGN KEY ("testId") REFERENCES "catalog_tests"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- NOTE: parameterId FK is added without CASCADE here so ucum_cascade_specimen_receive
-- can drop and re-add it WITH CASCADE (matching that migration's DROP CONSTRAINT call)
DO $$ BEGIN
  ALTER TABLE "test_parameter_mappings" ADD CONSTRAINT "test_parameter_mappings_parameterId_fkey"
    FOREIGN KEY ("parameterId") REFERENCES "parameters"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── panel_test_mappings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "panel_test_mappings" (
    "id"       TEXT    NOT NULL,
    "tenantId" TEXT    NOT NULL,
    "panelId"  TEXT    NOT NULL,
    "testId"   TEXT    NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "panel_test_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "panel_test_mappings_tenantId_panelId_testId_key"
    ON "panel_test_mappings"("tenantId", "panelId", "testId");
CREATE INDEX IF NOT EXISTS "panel_test_mappings_tenantId_panelId_idx"
    ON "panel_test_mappings"("tenantId", "panelId");
DO $$ BEGIN
  ALTER TABLE "panel_test_mappings" ADD CONSTRAINT "panel_test_mappings_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "panel_test_mappings" ADD CONSTRAINT "panel_test_mappings_panelId_fkey"
    FOREIGN KEY ("panelId") REFERENCES "catalog_panels"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "panel_test_mappings" ADD CONSTRAINT "panel_test_mappings_testId_fkey"
    FOREIGN KEY ("testId") REFERENCES "catalog_tests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── reference_ranges ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "reference_ranges" (
    "id"           TEXT             NOT NULL,
    "tenantId"     TEXT             NOT NULL,
    "parameterId"  TEXT             NOT NULL,
    "testId"       TEXT,
    "gender"       TEXT,
    "ageMinYears"  INTEGER,
    "ageMaxYears"  INTEGER,
    "lowValue"     DOUBLE PRECISION,
    "highValue"    DOUBLE PRECISION,
    "criticalLow"  DOUBLE PRECISION,
    "criticalHigh" DOUBLE PRECISION,
    "unit"         TEXT,
    "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reference_ranges_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "reference_ranges_tenantId_parameterId_idx"
    ON "reference_ranges"("tenantId", "parameterId");
DO $$ BEGIN
  ALTER TABLE "reference_ranges" ADD CONSTRAINT "reference_ranges_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "reference_ranges" ADD CONSTRAINT "reference_ranges_parameterId_fkey"
    FOREIGN KEY ("parameterId") REFERENCES "parameters"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── job_runs ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "job_runs" (
    "id"            TEXT         NOT NULL,
    "tenantId"      TEXT         NOT NULL,
    "type"          TEXT         NOT NULL,
    "status"        TEXT         NOT NULL DEFAULT 'queued',
    "payloadHash"   TEXT,
    "correlationId" TEXT         NOT NULL,
    "startedAt"     TIMESTAMP(3),
    "finishedAt"    TIMESTAMP(3),
    "resultSummary" JSONB,
    "errorSummary"  TEXT,
    "createdBy"     TEXT         NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "job_runs_tenantId_type_payloadHash_key"
    ON "job_runs"("tenantId", "type", "payloadHash");
CREATE INDEX IF NOT EXISTS "job_runs_tenantId_type_status_idx"
    ON "job_runs"("tenantId", "type", "status");
CREATE INDEX IF NOT EXISTS "job_runs_tenantId_createdAt_idx"
    ON "job_runs"("tenantId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
