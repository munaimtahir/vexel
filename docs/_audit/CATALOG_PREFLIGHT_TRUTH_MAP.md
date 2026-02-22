# Catalog Preflight Truth Map

## 1. Current Prisma Models vs Doctrine

### What EXISTS
| Model | Fields Present | Status |
|---|---|---|
| CatalogTest | id, tenantId, code(tenant-unique), name, description, sampleType, turnaroundHours, isActive | ⚠️ PARTIAL |
| Parameter | id, tenantId, code(tenant-unique), name, unit, dataType(numeric/text/boolean/coded), isActive | ⚠️ PARTIAL |
| CatalogPanel | id, tenantId, code(tenant-unique), name, description, testIds[](ARRAY), isActive | ❌ BROKEN |
| TestParameterMapping | id, tenantId, testId, parameterId, ordering(int) | ⚠️ PARTIAL |
| PanelTestMapping | id, tenantId, panelId, testId, ordering(int) | ⚠️ PARTIAL |
| ReferenceRange | id, tenantId, parameterId, testId?, gender?, ageMin/Max, low/high, criticalLow/High, unit | ✅ OK |
| JobRun | id, tenantId, type, status, payloadHash, correlationId, resultSummary, errorSummary | ✅ OK |

### Schema Gaps (MIGRATION REQUIRED)
| Entity | Missing Fields |
|---|---|
| Parameter | externalId (tenant-unique), userCode (tenant-unique), loincCode, resultType (rename dataType), defaultUnit (rename unit), decimals, allowedValues |
| CatalogTest | externalId (tenant-unique), userCode (tenant-unique), loincCode, department, method |
| CatalogPanel | externalId (tenant-unique), userCode (tenant-unique), loincCode; remove testIds[] array |
| TestParameterMapping | displayOrder (rename ordering), isRequired (bool default true), unitOverride |
| PanelTestMapping | displayOrder (rename ordering) |

### Critical Issue: CatalogPanel.testIds[]
CatalogPanel has a redundant `testIds: String[]` array alongside PanelTestMapping table.
This causes data inconsistency. MUST remove testIds[] and rely solely on PanelTestMapping.

## 2. OpenAPI Endpoint Audit

### EXISTS
| Endpoint | Method | operationId | Status |
|---|---|---|---|
| /catalog/tests | GET/POST | listCatalogTests/createCatalogTest | ✅ EXISTS |
| /catalog/tests/{id} | GET/PATCH/DELETE | getCatalogTest/updateCatalogTest/deleteCatalogTest | ✅ EXISTS |
| /catalog/panels | GET/POST | listCatalogPanels/createCatalogPanel | ✅ EXISTS |
| /catalog/parameters | GET/POST | listCatalogParameters/createCatalogParameter | ✅ EXISTS |
| /catalog/parameters/{id} | GET/PUT | getCatalogParameter/updateCatalogParameter | ✅ EXISTS |
| /catalog/tests/{id}/parameters | GET/POST/DELETE | listTestParameters/addTestParameter/removeTestParameter | ✅ EXISTS |
| /catalog/panels/{id}/tests | GET/POST/DELETE | listPanelTests/addPanelTest/removePanelTest | ✅ EXISTS |
| /catalog/reference-ranges | GET/POST | listReferenceRanges/createReferenceRange | ✅ EXISTS |
| /catalog/import-jobs | POST/GET | createImportJob/listImportJobs | ✅ EXISTS |
| /catalog/import-jobs/{id} | GET | getImportJob | ✅ EXISTS |
| /catalog/import-jobs/{id}:retry | POST | retryImportJob | ✅ EXISTS |
| /catalog/export-jobs | POST/GET | createExportJob/listExportJobs | ✅ EXISTS |
| /catalog/export-jobs/{id} | GET | getExportJob | ✅ EXISTS |

### MISSING (must add to OpenAPI)
| Endpoint | Method | Needed For | Blocking? |
|---|---|---|---|
| /catalog/tests/{id}/parameters | PUT | Bulk ordered mapping update | ✅ YES |
| /catalog/panels/{id}/tests | PUT | Bulk ordered mapping update | ✅ YES |
| /catalog/tests/{id}/definition | GET | Operator results entry page | ✅ YES (blocks Operator UI) |
| /catalog/panels/{id}/definition | GET | Operator panel ordering | ✅ YES |
| /catalog/import-jobs/{id}:validate | POST | Dry-run validation | ⚠️ WARN |
| /catalog/import-jobs/{id}/errors | GET | Error download | ⚠️ WARN |
| /catalog/export-jobs/{id}/download | GET | Export download | ⚠️ WARN |
| /catalog/templates/workbook.xlsx | GET | Template download | ⚠️ WARN |
| /catalog/templates/{sheet}.csv | GET | Per-sheet templates | ⚠️ WARN |

## 3. SDK Availability
- Generated from openapi.yaml via openapi-typescript
- All existing endpoints: ✅ SDK methods available
- Missing endpoints: ❌ Not in SDK yet (will generate after OpenAPI update)

## 4. Admin UI Gaps
| Page | Status | Gap |
|---|---|---|
| /catalog (dashboard) | ✅ EXISTS | Basic dashboard |
| /catalog/tests (list+create) | ✅ EXISTS | No edit/detail page |
| /catalog/parameters (list+create) | ✅ EXISTS | No edit/detail page |
| /catalog/panels (list+create) | ✅ EXISTS | No edit/detail page |
| /catalog/import-export | ✅ EXISTS | JSON-only, no XLSX, no templates |
| Test detail + param mapping UI | ❌ MISSING | Needed for ordered mappings |
| Panel detail + test mapping UI | ❌ MISSING | Needed for ordered mappings |
| Template download UI | ❌ MISSING | Needed for import workflows |

## 5. Import/Export Engine Gaps
- Current: JSON payload only (CatalogImportPayload schema)
- Missing: XLSX workbook support, per-sheet CSV, UPSERT_PATCH semantics, __CLEAR__ token, validate dry-run

## 6. Action Plan
1. Run Prisma migration (schema changes)
2. Update OpenAPI with missing endpoints + new fields
3. Regen SDK
4. Implement backend: CRUD updates + mapping endpoints + definition endpoints + XLSX engine + templates
5. Update Admin UI: edit pages + mapping UI + XLSX import UI
