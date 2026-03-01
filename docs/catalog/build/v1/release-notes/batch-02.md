# Batch 02 — Chemistry Core

Workbook: `workbooks/batch-02-chemistry-core.xlsx`

Results (`reports/batch-02-results.json`):
- validate: `inserted=10 updated=1 errors=16`
- apply #1: `inserted=26 updated=1 errors=0`
- apply #2: `inserted=0 updated=27 errors=0`

Export snapshot:
- `reports/export-after-batch-02.xlsx`

Notes:
- Re-apply is idempotent (no new inserts).
- Validate errors are known cross-sheet dependency behavior on first-time inserts.
