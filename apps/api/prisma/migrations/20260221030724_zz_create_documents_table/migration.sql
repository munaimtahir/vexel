-- Migration: create_documents_table
-- The documents table was missing from phase4_init.
-- This migration fills the gap so fresh-DB deploys (e.g. CI) work correctly.
-- All statements are idempotent (IF NOT EXISTS / EXCEPTION WHEN duplicate_object)
-- so this is safe to apply on a production DB that already has the table.

CREATE TABLE IF NOT EXISTS "documents" (
    "id"           TEXT          NOT NULL,
    "tenantId"     TEXT          NOT NULL,
    "type"         TEXT          NOT NULL,
    "templateId"   TEXT          NOT NULL,
    "payloadJson"  JSONB         NOT NULL,
    "payloadHash"  TEXT          NOT NULL,
    "pdfHash"      TEXT,
    "status"       TEXT          NOT NULL DEFAULT 'DRAFT',
    "version"      INTEGER       NOT NULL DEFAULT 1,
    "sourceRef"    TEXT,
    "sourceType"   TEXT,
    "errorMessage" TEXT,
    "publishedAt"  TIMESTAMP(3),
    "createdBy"    TEXT          NOT NULL,
    "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "documents_tenantId_type_payloadHash_key"
    ON "documents"("tenantId", "type", "payloadHash");

CREATE INDEX IF NOT EXISTS "documents_tenantId_status_idx"
    ON "documents"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "documents_tenantId_sourceRef_sourceType_idx"
    ON "documents"("tenantId", "sourceRef", "sourceType");

CREATE INDEX IF NOT EXISTS "documents_tenantId_createdAt_idx"
    ON "documents"("tenantId", "createdAt");

-- FK to tenants (templateId FK is added in add_document_templates migration)
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
