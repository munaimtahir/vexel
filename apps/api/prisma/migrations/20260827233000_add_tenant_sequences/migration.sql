CREATE TABLE "tenant_sequences" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_sequences_tenantId_key_key"
  ON "tenant_sequences"("tenantId", "key");
CREATE INDEX "tenant_sequences_tenantId_idx"
  ON "tenant_sequences"("tenantId");

ALTER TABLE "tenant_sequences"
  ADD CONSTRAINT "tenant_sequences_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the next values above existing row counts. This is additive and does
-- not rewrite business data; subsequent allocations are atomic increments.
INSERT INTO "tenant_sequences" ("id", "tenantId", "key", "nextValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", 'OPD_ENCOUNTER', COUNT(e."id")::integer + 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
LEFT JOIN "opd_encounters" e ON e."tenantId" = t."id"
GROUP BY t."id";

INSERT INTO "tenant_sequences" ("id", "tenantId", "key", "nextValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", 'OPD_INVOICE', COUNT(i."id")::integer + 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
LEFT JOIN "invoices" i ON i."tenantId" = t."id"
GROUP BY t."id";
