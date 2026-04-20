# Report Typography Update (+1 pt) — LAB_REPORT v3

## Objective

Improve report readability by increasing key report typography by **+1pt** while preserving deterministic identity and layout safety.

## What Changed

### Template Versioning

- Added LAB report renderer key support: `lab_report_v3` (PDF service).
- Seeded `DocumentTemplate` for LAB_REPORT version `3` with:
  - `templateKey: lab_report_v3`
  - `isActive: true`
- Marked LAB_REPORT version `2` as inactive in seed defaults.
- Updated template-family resolver to default to `lab_report_v3`.

This preserves deterministic identity through template version separation.

### Typography Adjustments (QuestPDF)

In `LabReportDocumentV2` rendering logic (now used for `lab_report_v3`), applied `ReadabilityBumpPt = 1f` to report text areas:

- demographics block labels/values
- result table headers and values
- unit and reference range values
- single-line result rows
- base report text style

### Explicitly Not Increased

To avoid overflow and preserve layout-critical regions, we did **not** scale:

- barcode caption/micro text
- page number/footer micro text
- narrow critical-flag micro badges

## Determinism & Idempotency

- No payload shape changes were introduced.
- Document identity remains deterministic with `(tenantId, type, templateId, payloadHash)`.
- Version bump ensures content changes do not collide with prior template identity.

## Validation Scenarios

Recommended validation set:

- single test report
- multi-test report
- dense report (10–20 parameters)
- multi-page report

Focus checks:

- no clipping or overflow
- page breaks preserved
- footer/signature alignment intact
