# How to import a catalog workbook

1. Go to **Admin → Catalog → Import / Export**.
2. Download `workbook.xlsx` template from the template section.
3. Fill sheets in this order: `SampleTypes`, `Parameters`, `Tests`, `TestParameters`, `Panels`, `PanelTests`, `ReferenceRanges`.
4. Upload the workbook and click **Validate**.
5. Fix any row errors (sheet/row/field/code shown in UI), then validate again.
6. Click **Apply** to persist changes using `UPSERT_PATCH` (idempotent updates).

## Notes
- `validate=true` does not write data.
- Re-applying the same workbook is safe (`UPSERT_PATCH` updates existing rows by `(tenantId, externalId)`).
- For tests, prefer `sampleTypeExternalId` over free-text specimen names.
