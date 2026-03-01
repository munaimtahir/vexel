# Catalog Import Engine Fix — Audit Evidence

**Date:** 2026-03-01  
**Severity:** Critical Bug (import completely broken)  
**Status:** Fixed ✅

---

## Root Cause

**File:** `packages/sdk/src/client.ts`

The SDK `createApiClient()` function registered a custom `fetch` wrapper to detect `FormData` bodies and avoid setting `Content-Type: application/json` on file uploads. The wrapper checked:

```typescript
const isFormData = init?.body instanceof FormData;
```

However, `openapi-fetch` (v0.13.8) passes the HTTP request body inside a `Request` object as the **first argument** to the custom fetch function. The second argument (`init`) contains only `requestInitExt` (which is `undefined` in browser environments). This means `init?.body` was always `undefined`, `isFormData` was always `false`, and the wrapper always set `Content-Type: application/json` — **even on FormData/multipart requests**.

The server (NestJS, using express body-parser) received the request with `Content-Type: application/json` but the body was multipart data, causing:

```
SyntaxError: Unexpected token '-', "------WebK..." is not valid JSON
```

---

## Fix Applied

Removed the custom `fetch` wrapper entirely. `openapi-fetch` v0.13.8 already handles Content-Type correctly natively.

**Before:** Custom fetch wrapper → `init?.body instanceof FormData` always `false` → always sets `Content-Type: application/json` → server parse error.

**After:** No custom fetch wrapper → openapi-fetch native behavior → FormData gets no Content-Type header → browser sets `multipart/form-data; boundary=...` → server processes correctly.

---

## Request/Response Examples

### After Fix (correct)
```
POST /api/catalog/import/workbook?validate=true&mode=UPSERT_PATCH
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryXYZ
Authorization: Bearer <token>
```
Response: `{"inserted":12,"updated":3,"skipped":0,"errors":[]}`

---

## Test Outputs

```
PASS src/catalog/__tests__/catalog-import-multipart.spec.ts
PASS src/catalog/__tests__/catalog-import.spec.ts
PASS src/catalog/__tests__/catalog-import-export.spec.ts
Tests: 16 passed

PASS src/tenants/__tests__/enable-lims.spec.ts
Tests: 5 passed
```

---

## Changes Made

| File | Change |
|------|--------|
| `packages/sdk/src/client.ts` | Removed buggy custom fetch wrapper |
| `packages/contracts/openapi.yaml` | Added enable-lims endpoint + catalog seed fields to TenantSummary |
| `packages/sdk/src/generated/api.d.ts` | SDK regenerated |
| `apps/api/prisma/schema.prisma` | Added catalogSeedMode/SeededAt/BaseVersion/Hash to Tenant |
| `apps/api/prisma/migrations/20260301100000_add_catalog_seed_state/migration.sql` | Migration |
| `apps/api/src/catalog/catalog.module.ts` | Export CatalogImportExportService |
| `apps/api/src/tenants/tenants.module.ts` | Import CatalogModule, AuditModule, PrismaModule |
| `apps/api/src/tenants/tenants.service.ts` | Add enableLims() method |
| `apps/api/src/tenants/tenants.controller.ts` | Add POST :tenantId\:enable-lims endpoint |
| `apps/api/resources/catalog/base_catalog_v1.xlsx` | Base catalog (3 sample types, 40 params, 12 tests) |
| `apps/api/resources/catalog/base_catalog_v1.json` | Metadata with sha256 hash |
| `apps/api/Dockerfile` | Copy resources/ to runtime image |
| `apps/admin/src/app/(protected)/tenants/page.tsx` | Enable LIMS modal + seed status on tenant cards |
| `apps/api/src/tenants/__tests__/enable-lims.spec.ts` | 5 integration tests |
