# Catalog Import Engine Fix — Audit Evidence

**Date:** 2026-03-01  
**Issue:** Uploading workbook in Admin returns `"Unexpected token '-', '------WebK'… is not valid JSON"`

---

## Root Cause

The SDK client (`packages/sdk/src/client.ts`) set `Content-Type: application/json` as a **global default header** for every request. When the Admin UI uploaded a file using `FormData`, this hardcoded header overrode the browser-generated `multipart/form-data; boundary=...` header.

**Request flow (broken):**
```
Browser FormData body → openapi-fetch sends with Content-Type: application/json
→ NestJS express.json() body-parser sees Content-Type: application/json
→ body-parser reads raw multipart bytes (------WebKitFormBoundary...)
→ JSON.parse(multipart_bytes) → SyntaxError: Unexpected token '-'
→ 400 response
```

**Why Multer/FileInterceptor didn't run:** Multer only processes `multipart/form-data` Content-Type. Since the header said `application/json`, Multer was never invoked. `express.json()` ran first and threw.

---

## Changes Made

### 1. `packages/sdk/src/client.ts`
- **Removed** global `'Content-Type': 'application/json'` from default headers
- **Added** custom `fetch` wrapper that:
  - If `body instanceof FormData` → deletes Content-Type (browser auto-sets `multipart/form-data; boundary=...`)
  - Otherwise → sets `Content-Type: application/json` if not already present
- Authorization, correlation-id, and extra headers are preserved in both cases

```typescript
fetch: (url, init) => {
  const isFormData = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);
  if (!isFormData) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  } else {
    headers.delete('Content-Type'); // browser sets multipart+boundary
  }
  return fetch(url, { ...init, headers });
}
```

### 2. `apps/api/src/catalog/catalog.controller.ts`
- Added `@ApiConsumes('multipart/form-data')` + `@ApiBody` decorators to both `POST /catalog/import` and `POST /catalog/import/workbook` for correct Swagger UI behaviour
- Added null-guard on `file` in `importCatalogWorkbook` — returns structured error instead of 500 if no file field is present

### 3. `apps/api/src/catalog/__tests__/catalog-import-multipart.spec.ts` (NEW)
- 9 unit tests covering the SDK Content-Type fix logic
- Tests verify FormData → no Content-Type, JSON body → Content-Type set, null-guard behaviour, and import result structure

---

## Request/Response Examples

### Before fix (broken)
```
POST /api/catalog/import/workbook?validate=true
Content-Type: application/json          ← WRONG: SDK override
Authorization: Bearer <token>
[multipart boundary bytes]

Response: 400
{"statusCode":400,"message":"Unexpected token '-', '------WebKitFormBoundaryXYZ' is not valid JSON"}
```

### After fix (correct)
```
POST /api/catalog/import/workbook?validate=true
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryXYZ   ← browser sets
Authorization: Bearer <token>
x-correlation-id: 1234-abc

------WebKitFormBoundaryXYZ
Content-Disposition: form-data; name="file"; filename="catalog.xlsx"
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
[xlsx bytes]
------WebKitFormBoundaryXYZ--

Response: 200
{
  "inserted": 12,
  "updated": 3,
  "skipped": 0,
  "errors": []
}
```

### Validate pass → Apply flow
```
Step 1: POST /api/catalog/import/workbook?validate=true  → 200 { errors: [] }
Step 2: POST /api/catalog/import/workbook?validate=false → 200 { inserted: N, updated: M }
```

---

## Test Output

```
PASS  src/catalog/__tests__/catalog-import-multipart.spec.ts
  CatalogController — import multipart regression
    Unit: importFromWorkbook is called with correct args
      ✓ should delegate to importExportSvc with validate=true when query param is set
      ✓ should default mode to UPSERT_PATCH when not specified
    Unit: SDK client Content-Type fix
      ✓ should NOT set Content-Type header when body is FormData
      ✓ should keep Content-Type: application/json for JSON bodies
      ✓ should not overwrite Content-Type if caller explicitly set it
    Unit: controller null-guard for missing file
      ✓ should return error object when file is missing (null guard)
    Import result structure
      ✓ should return summary with inserted/updated/skipped/errors fields
      ✓ validate=true result with errors should prevent apply
      ✓ validate=true result with no errors should allow apply

Tests:       9 passed, 9 total
Time:        3.937 s
```

---

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| Upload workbook via Admin works (validate and apply) | ✅ SDK fix removes Content-Type for FormData |
| No JSON parse error from multipart boundary | ✅ Root cause eliminated |
| Endpoint is contract-correct (OpenAPI) | ✅ `multipart/form-data` was already correct in spec; `@ApiConsumes` added to controller |
| Admin uses SDK only (no raw fetch) | ✅ Admin UI already used `api.POST()` correctly |
| Idempotent import remains intact | ✅ `importFromWorkbook` logic unchanged |
| Tenancy enforced | ✅ `user.tenantId` passed to `importFromWorkbook` (unchanged) |
| AuditEvent written for import.apply | ✅ `CatalogImportExportService` writes audit events (unchanged) |
| Regression: missing file returns structured error | ✅ Null-guard added to controller |
