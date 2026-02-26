DROP INDEX IF EXISTS "documents_tenantId_type_payloadHash_key";

CREATE UNIQUE INDEX IF NOT EXISTS "documents_tenantId_type_templateId_payloadHash_key"
  ON "documents"("tenantId", "type", "templateId", "payloadHash");
