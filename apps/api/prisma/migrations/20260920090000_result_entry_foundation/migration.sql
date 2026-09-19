-- Result-entry formats, safe omissions, formula provenance, and analyser-ready foundations.
ALTER TABLE "parameters"
  ADD COLUMN IF NOT EXISTS "defaultRequiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowComment" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "commentRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "printFlag" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "formulaJson" TEXT,
  ADD COLUMN IF NOT EXISTS "formulaVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "reference_ranges"
  ADD COLUMN IF NOT EXISTS "referenceText" TEXT;

ALTER TABLE "lab_results"
  ADD COLUMN IF NOT EXISTS "omitted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "omittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "omittedById" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "sourcePayloadJson" TEXT,
  ADD COLUMN IF NOT EXISTS "comment" TEXT;

CREATE TABLE IF NOT EXISTS "instruments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "instruments_tenantId_code_key" ON "instruments"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "instruments_tenantId_isActive_idx" ON "instruments"("tenantId", "isActive");
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "instrument_parameter_mappings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "parameterId" TEXT NOT NULL,
  "instrumentCode" TEXT NOT NULL,
  "expectedUnit" TEXT,
  "conversionJson" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instrument_parameter_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "instrument_parameter_mappings_tenantId_instrumentId_instrumentCode_key" ON "instrument_parameter_mappings"("tenantId", "instrumentId", "instrumentCode");
CREATE INDEX IF NOT EXISTS "instrument_parameter_mappings_tenantId_parameterId_idx" ON "instrument_parameter_mappings"("tenantId", "parameterId");
ALTER TABLE "instrument_parameter_mappings" ADD CONSTRAINT "instrument_parameter_mappings_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instrument_parameter_mappings" ADD CONSTRAINT "instrument_parameter_mappings_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "parameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "instrument_result_messages" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "messageIdentity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "barcode" TEXT,
  "instrumentCode" TEXT NOT NULL,
  "rawValue" TEXT,
  "rawUnit" TEXT,
  "rawFlag" TEXT,
  "observedAt" TIMESTAMP(3),
  "rawPayloadJson" TEXT,
  "acceptedLabResultId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instrument_result_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "instrument_result_messages_tenantId_instrumentId_messageIdentity_key" ON "instrument_result_messages"("tenantId", "instrumentId", "messageIdentity");
CREATE INDEX IF NOT EXISTS "instrument_result_messages_tenantId_status_idx" ON "instrument_result_messages"("tenantId", "status");
ALTER TABLE "instrument_result_messages" ADD CONSTRAINT "instrument_result_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instrument_result_messages" ADD CONSTRAINT "instrument_result_messages_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
