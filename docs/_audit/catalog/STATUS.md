# Catalog status audit (2026-02-28)

## What exists
- **Backend catalog domain (partial):** `CatalogTest`, `Parameter`, `CatalogPanel`, `TestParameterMapping`, `PanelTestMapping`, `ReferenceRange` are present in Prisma and services.
- **Catalog APIs (existing namespace):** `/catalog/*` endpoints for CRUD, mappings, templates, import/export, and job-based import/export are implemented in `apps/api/src/catalog`.
- **Admin UI (existing):** `/catalog/tests`, `/catalog/parameters`, `/catalog/panels`, `/catalog/reference-ranges`, `/catalog/import-export` pages are already wired through SDK client calls.
- **Tenant scoping:** catalog queries in service/controller paths are tenant-filtered.
- **Audit hooks:** create/update/delete and import job actions already log catalog audit events.

## What is missing / misaligned vs target
- **No first-class SampleType entity** (model + CRUD + import/export sheet + UI tab missing); tests still store specimen/sample type as free text.
- **Contract path mismatch:** canonical request asks `/admin/catalog/*`; current contract and implementation are `/catalog/*` only.
- **Import validation shape is weak:** workbook import returns `{sheet,row,message}` but not rich structured errors (`field`, `code`, `suggestion`) and lacks stronger normalization/duplicate checks.
- **Workbook format gap:** no `SampleTypes` sheet; entity coverage not complete for full single-source catalog hierarchy.
- **Range integration gap in results/docs:** results entry/reporting rely mainly on stored `lab_results.referenceRange`, with no robust fallback selection from `reference_ranges` by patient context.
- **Evidence/docs gaps:** no dedicated `docs/catalog/*` operator/admin guidance and no catalog audit evidence pack folder for this task.

## Key risks
1. **Data drift risk:** free-text specimen/sample values can diverge and break deterministic import/use.
2. **Contract drift risk:** frontend/backend portability suffers without `/admin/catalog/*` canonical endpoints in OpenAPI.
3. **Clinical display risk:** missing deterministic reference-range resolution can show blank/incorrect ranges in result entry and reports.
4. **Operational risk:** without structured validation errors, large workbook imports are harder to correct safely and repeatably.

## Update (implemented in this session)
- Added first-class `SampleType` model + migration + tenant-scoped uniqueness.
- Added Sample Type CRUD service/controller and admin UI page under Catalog.
- Added `/admin/catalog/*` alias support in API controllers and updated OpenAPI + regenerated SDK.
- Extended workbook template/import/export to include `SampleTypes` and `ReferenceRanges`.
- Added structured validation helpers for name/unit normalization and range parsing.
- Added result-entry reference range fallback lookup from catalog (tenant + patient context).
- Added docs and evidence artifacts:
  - `docs/catalog/how-to-import-catalog.md`
  - `docs/catalog/template-rules.md`
  - `docs/catalog/samples/starter-catalog.xlsx`
  - `docs/_audit/catalog/verification.log`
  - `docs/_audit/catalog/merge_gate.log`
  - `docs/_audit/catalog/deploy_smoke.log`
  - `docs/catalog/build/v1/*` workspace (raw/normalized/workbooks/reports/release-notes)
