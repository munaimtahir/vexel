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

## Editing reference ranges via Admin UI

Reference ranges can also be created, edited, and deleted individually without a workbook.
Go to **Admin → Catalog → Reference Ranges** to:
- Browse all ranges with search, parameter, sex, and active/inactive filters.
- Click any parameter name to open a **drilldown drawer** showing all strata (sex × age band) for that parameter, grouped by test override vs. default.
- Create or edit a single range using the side form (supports numeric low/high or expression/text ranges, critical limits, and interpretation notes).
- Delete a range with a confirmation step.

The workbook import remains the recommended path for bulk updates.
