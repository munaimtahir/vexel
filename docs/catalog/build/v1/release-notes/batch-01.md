# Batch 01 — Hematology

Workbook: `workbooks/batch-01-hematology.xlsx`

Results (`reports/batch-01-results.json`):
- validate: `inserted=5 updated=1 errors=8`
- apply #1: `inserted=13 updated=1 errors=0`
- apply #2: `inserted=0 updated=14 errors=0`

Export snapshot:
- `reports/export-after-batch-01.xlsx`

Notes:
- Re-apply is idempotent (no new inserts).
- Validate errors are known cross-sheet dependency behavior on first-time inserts.
