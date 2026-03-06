# 04 — DB Migration Checks

---

## Migration File

`apps/api/prisma/migrations/20260302113000_add_tenant_top_tests_search_indexes/migration.sql`

```sql
CREATE TABLE IF NOT EXISTS "tenant_top_tests" (
  "id"        TEXT        NOT NULL,
  "tenantId"  TEXT        NOT NULL,
  "testId"    TEXT        NOT NULL,
  "rank"      INTEGER     NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_top_tests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_top_tests_tenantId_rank_key"
  ON "tenant_top_tests"("tenantId", "rank");

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_top_tests_tenantId_testId_key"
  ON "tenant_top_tests"("tenantId", "testId");

CREATE INDEX IF NOT EXISTS "tenant_top_tests_tenantId_rank_idx"
  ON "tenant_top_tests"("tenantId", "rank");

-- Search performance indexes on catalog_tests
CREATE INDEX IF NOT EXISTS "catalog_tests_tenantId_userCode_idx"
  ON "catalog_tests"("tenantId", "userCode");

CREATE INDEX IF NOT EXISTS "catalog_tests_tenantId_name_idx"
  ON "catalog_tests"("tenantId", "name");

-- Foreign keys (idempotent via DO $$ BEGIN ... EXCEPTION ... END)
ALTER TABLE "tenant_top_tests"
  ADD CONSTRAINT "tenant_top_tests_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;

ALTER TABLE "tenant_top_tests"
  ADD CONSTRAINT "tenant_top_tests_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "catalog_tests"("id") ON DELETE CASCADE;
```

---

## Prisma Schema Model (schema.prisma lines 237–250)

```prisma
model TenantTopTest {
  id        String   @id @default(uuid())
  tenantId  String
  testId    String
  rank      Int
  createdAt DateTime @default(now())

  tenant Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  test   CatalogTest @relation(fields: [testId], references: [id], onDelete: Cascade)

  @@unique([tenantId, rank])
  @@unique([tenantId, testId])
  @@index([tenantId, rank])
  @@map("tenant_top_tests")
}
```

---

## Storage Approach

**Table-based** (not JSON config): `tenant_top_tests` table.  
This is the correct approach for:
- Referential integrity (FK to `catalog_tests`)
- Cascade delete when test is removed
- Efficient ordered retrieval by `(tenantId, rank)` index

---

## Constraints Analysis

| Constraint | Type | Purpose |
|---|---|---|
| `tenant_top_tests_tenantId_rank_key` | UNIQUE | No two tests at same rank per tenant |
| `tenant_top_tests_tenantId_testId_key` | UNIQUE | No test pinned twice per tenant |
| `tenant_top_tests_tenantId_rank_idx` | INDEX | Fast ordered retrieval |
| `catalog_tests_tenantId_userCode_idx` | INDEX | Fast userCode search per tenant |
| `catalog_tests_tenantId_name_idx` | INDEX | Fast name search per tenant |

---

## Additional CatalogTest Indexes (schema.prisma lines 230–232)

```prisma
@@unique([tenantId, externalId], name: "tenant_test_externalId")
@@index([tenantId, isActive])
@@index([tenantId, userCode])
@@index([tenantId, name])
```

✅ `tenantId + isActive` compound index — search WHERE includes `isActive: true`  
✅ `tenantId + userCode` — userCode search fast  
✅ `tenantId + name` — name prefix/contains aided by index  

---

## Verdict

| Check | Result |
|---|---|
| TenantTopTest table exists (not JSON blob) | ✅ |
| Migration file present | ✅ `20260302113000_add_tenant_top_tests_search_indexes` |
| Unique per (tenantId, rank) | ✅ |
| Unique per (tenantId, testId) — no duplicate pins | ✅ |
| FK to catalog_tests with CASCADE | ✅ |
| FK to tenants with CASCADE | ✅ |
| Search performance indexes on catalog_tests | ✅ userCode + name + isActive |
