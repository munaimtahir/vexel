# Catalog v1 build report

## Source pack
- `VEXEL_CATALOG_BUILD_PACK.zip`
- Raw inputs extracted to `docs/catalog/build/v1/raw/`
- Normalized outputs written to `docs/catalog/build/v1/normalized/`

## Normalization performed
- Converted raw external IDs to canonical import-safe IDs:
  - Tests: `cbc/lipid/lft` -> `t101/t102/t103`
  - Parameters: `hb..bili` -> `p101..p112`
- Preserved legacy lab codes in `code` fields (`CBC`, `HB`, etc.).
- Generated sample types from specimen strings:
  - `Whole Blood (EDTA)` -> `s1`
  - `Serum` -> `s2`
- Converted range columns to `rangeExpression` (`low-high`, `<high`, `>=low`) and aligned workbook sheet columns.

## Workbooks produced
- `docs/catalog/build/v1/workbooks/catalog_v1.xlsx`
- `docs/catalog/build/v1/workbooks/batch-01-hematology.xlsx`
- `docs/catalog/build/v1/workbooks/batch-02-chemistry-core.xlsx`
- `docs/catalog/build/v1/workbooks/batch-03-thyroid-coag.xlsx` (template placeholder)
- `docs/catalog/build/v1/workbooks/batch-04-serology-urine.xlsx` (template placeholder)

## Validation/apply note
- Current `validate=true` path reports cross-sheet dependency errors for new IDs not yet persisted in DB.
- `validate=false` apply succeeds for complete workbook batches and remains idempotent on re-apply.
