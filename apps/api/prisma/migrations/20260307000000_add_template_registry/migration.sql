-- Migration: add_template_registry
-- Adds TemplateBlueprint, PrintTemplate, TestTemplateMap models
-- Extends catalog_tests with resultSchemaType and allowTemplateOverride

-- ─── TemplateBlueprint ───────────────────────────────────────────────────────
CREATE TABLE "template_blueprints" (
    "id"                TEXT NOT NULL,
    "code"              TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "templateFamily"    TEXT NOT NULL,
    "schemaType"        TEXT NOT NULL,
    "defaultConfigJson" JSONB,
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"         INTEGER NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_blueprints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "template_blueprints_code_key" ON "template_blueprints"("code");

-- ─── PrintTemplate ───────────────────────────────────────────────────────────
CREATE TABLE "print_templates" (
    "id"                   TEXT NOT NULL,
    "tenantId"             TEXT NOT NULL,
    "sourceBlueprintId"    TEXT,
    "code"                 TEXT NOT NULL,
    "name"                 TEXT NOT NULL,
    "schemaType"           TEXT NOT NULL,
    "templateFamily"       TEXT NOT NULL,
    "templateVersion"      INTEGER NOT NULL DEFAULT 1,
    "status"               TEXT NOT NULL DEFAULT 'DRAFT',
    "configJson"           JSONB,
    "isSystemProvisioned"  BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId"      TEXT,
    "supersedesTemplateId" TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_template_code_version" ON "print_templates"("tenantId", "code", "templateVersion");
CREATE INDEX "print_templates_tenantId_status_idx" ON "print_templates"("tenantId", "status");
CREATE INDEX "print_templates_tenantId_schemaType_idx" ON "print_templates"("tenantId", "schemaType");
CREATE INDEX "print_templates_tenantId_templateFamily_idx" ON "print_templates"("tenantId", "templateFamily");

ALTER TABLE "print_templates"
    ADD CONSTRAINT "print_templates_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "print_templates"
    ADD CONSTRAINT "print_templates_sourceBlueprintId_fkey"
    FOREIGN KEY ("sourceBlueprintId") REFERENCES "template_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "print_templates"
    ADD CONSTRAINT "print_templates_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "print_templates"
    ADD CONSTRAINT "print_templates_supersedesTemplateId_fkey"
    FOREIGN KEY ("supersedesTemplateId") REFERENCES "print_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── TestTemplateMap ─────────────────────────────────────────────────────────
CREATE TABLE "test_template_maps" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "testId"     TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "isDefault"  BOOLEAN NOT NULL DEFAULT false,
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "isEnabled"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_template_maps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_test_template" ON "test_template_maps"("tenantId", "testId", "templateId");
CREATE INDEX "test_template_maps_tenantId_testId_idx" ON "test_template_maps"("tenantId", "testId");
CREATE INDEX "test_template_maps_tenantId_templateId_idx" ON "test_template_maps"("tenantId", "templateId");

ALTER TABLE "test_template_maps"
    ADD CONSTRAINT "test_template_maps_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "test_template_maps"
    ADD CONSTRAINT "test_template_maps_testId_fkey"
    FOREIGN KEY ("testId") REFERENCES "catalog_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "test_template_maps"
    ADD CONSTRAINT "test_template_maps_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "print_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CatalogTest extensions ───────────────────────────────────────────────────
ALTER TABLE "catalog_tests"
    ADD COLUMN "resultSchemaType"      TEXT NOT NULL DEFAULT 'TABULAR',
    ADD COLUMN "allowTemplateOverride" BOOLEAN NOT NULL DEFAULT false;
