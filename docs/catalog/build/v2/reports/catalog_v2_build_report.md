# Catalog v2 Build Report — Legacy xMed LIMS Migration

Source: `docs/migration/legacy_lims_mapping/legacy_test_parameter_mapping.csv` (796 rows,
329 legacy tests — 103 Multi + 226 Single, price > 0) plus a supplementary
read-only extraction pass against the same live legacy system for the
"Specimen Required" field per test.

Target: Vexel's catalog import workbook schema, exactly as defined by
`generateWorkbookTemplate()` in `apps/api/src/catalog/catalog-import-export.service.ts`.

Output:
- `docs/catalog/build/v2/workbooks/catalog_v2_legacy_migration.xlsx` — ready to upload via `POST /catalog/import` or `POST /catalog/import/workbook`
- `docs/catalog/build/v2/normalized/*.csv` — the same data as individual per-sheet CSVs for review
- `docs/catalog/build/v2/reports/parameter_dedup_report.csv` — every legacy parameter row mapped to its canonical Parameter
- `docs/catalog/build/v2/reports/reference_ranges_manual_review.csv` — legacy ranges not auto-parsed

## ID numbering

Fresh, disjoint block chosen to avoid any collision with the existing
`docs/catalog/build/v1` starter catalog (`t101-t103`/`p101-p112`):
**Tests t2000+, Parameters p2000+, SampleTypes s2000+.**

`Tests.userCode` carries `legacy-{internalTestId}` for traceability back to
the source xMed system (e.g. `legacy-5596`); `Tests.legacySr` (grid display
order) is preserved in the intermediate build data but not part of the
import schema itself.

## Counts

| Sheet | Rows |
|---|---|
| SampleTypes | 22 |
| Parameters | 373 |
| Tests | 329 |
| TestParameters | 796 |
| ReferenceRanges | 706 |

All rows pass structural self-validation: exact header match against
`generateWorkbookTemplate()`, no duplicate `externalId` within any sheet,
every foreign-key reference (`sampleTypeExternalId`, `testExternalId`,
`parameterExternalId`) resolves, `resultType` values are within
`{numeric, text, boolean, coded}`, `gender` values are within `{M, F, blank}`,
all prices ≥ 0, and all `externalId`s match the required `^t\d+$` /
`^p\d+$` / `^s\d+$` patterns.

## Parameters (deduplication)

The 796 legacy parameter rows collapse to **373 canonical parameters** by
normalized name. For each canonical parameter the most common unit and
legacy `Type` across its occurrences was used; **14 canonical parameters
have inconsistent units** and **7 have inconsistent legacy types** across
their source rows (e.g. one test tags a parameter `Decimal`, another tags
the same-named parameter `Text`) — these are **not** silently resolved by
majority vote alone without a trace: every individual legacy row's original
unit/type is preserved in `parameter_dedup_report.csv` alongside the
canonical choice, so a reviewer can see exactly what was collapsed.

Legacy `Type` → target `resultType` mapping used:

| Legacy `Type` | Target `resultType` |
|---|---|
| Decimal, Integer, Formula, Machine | `numeric` |
| Text | `text` |
| List | `coded` |
| Date | `text` (schema has no date type — known gap) |

**28 `coded` (legacy "List") parameters have no `allowedValues`** — the
option set for these could not be recovered from the reachable read-only
admin UI (confirmed by manually inspecting a locked List-type parameter row
in the live system: no `<select>`/options are present anywhere in the
detail page or an editable affordance for a locked parameter). These need
manual curation before go-live; a full list is derivable by filtering
`Parameters.csv` for `resultType=coded`.

## SampleTypes

22 distinct specimen descriptions recovered from the legacy "Specimen
Required" field, clustered by exact text match (e.g. "3cc EDTA BLOOD
(Purple Vial)", "3-5cc Clotted Blood or Serum", "Urine (Random/Spot)").
**18 of the 329 tests had `---Not-Defined---` as their legacy specimen** and
are imported with a blank `sampleTypeExternalId`/`specimenType` rather than
a guessed value — these tests should have a sample type assigned manually
before the catalog goes live.

## Tests

One row per target legacy test (329 total). All 24 tests that the earlier
extraction flagged `NO_PARAMETERS_RETURNED` (confirmed genuinely empty in
the legacy system, not an extraction defect — see the original discovery
report) are still included here as real, priced, active Test rows with
simply zero `TestParameters` rows; they need manual parameter configuration
after import. `method` and `loincCode` are left blank throughout — neither
was ever present in the legacy data, so no value was guessed.

## Reference ranges

706 rows total, from parsing the 796 `TestParameters` rows' legacy free-text
`normal_range` strings:

| Outcome | Count |
|---|---|
| Auto-parsed: simple numeric range ("11.5 - 14.0") | 368 |
| Auto-parsed: comparator ("Less Than 30", "< 0.9") | 36 |
| Auto-parsed: gender-split range ("Female: 11.5-14.0 Male: 13.5-17.5") | 34 |
| Auto-parsed: gender-split comparator ("Female: < 20 Male: < 10") | 13 |
| Legacy placeholder "-" (no range defined) → correctly skipped, no row | 137 |
| **Not auto-parsed → flagged for manual review** | **208** |

The 208 manual-review rows are still present in `ReferenceRanges.csv` (so
nothing is silently dropped) with **no fabricated `lowValue`/`highValue`** —
only `notes` = `MANUAL_REVIEW: <original legacy text verbatim>`. They fall
into a few recognizable buckets, all genuinely requiring human judgment
rather than further pattern-matching:
- Age-banded tables (Adult/Child/Infant/Newborn ranges without a single
  reusable numeric age cue, e.g. `"Adult: 25 - 40, Child: 45- 70"`)
- Qualitative/interpretive results that aren't numeric ranges at all
  (`"Negative"`, `"Non-Reactive"`, `"Clear"`) — these belong to `text`/`coded`
  parameters where the "range" is really an expected qualitative result
- Multi-tier positive/borderline/negative threshold tables
  (`"Negative: < 0.9 Borderline: 0.9 to 1.2 Positive: > 1.2"`)
- Multi-phase/trimester/age-scaled hormone tables (Beta-HCG by gestational
  week, LH/FSH/Prolactin by cycle phase, AMH by age band)
- `"(See below)"` placeholders referencing a legacy report note not captured
  in the extracted table

Full list: `docs/catalog/build/v2/reports/reference_ranges_manual_review.csv`.

## Known gaps requiring manual follow-up before go-live

1. 28 `coded` parameters need their allowed value lists populated by hand (option set not recoverable read-only from the legacy admin UI).
2. 18 tests need a sample type assigned (legacy specimen was "---Not-Defined---").
3. 24 tests need parameters configured from scratch (legacy test itself has none).
4. 208 reference-range rows need a human to translate the original legacy text (preserved verbatim in `notes`) into structured values, or to decide they're qualitative and don't need one.
5. Parameters with legacy-side unit/type inconsistencies across tests (14 unit, 7 type) are worth a quick review of `parameter_dedup_report.csv` to confirm the majority-vote canonical choice is the right one for every test that uses them.
6. No `method` or `loincCode` data exists anywhere in the legacy source — both are blank throughout and would need to be sourced separately if desired.
