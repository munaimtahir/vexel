# Legacy LIMS Test → Parameter Mapping Discovery

Source system: xMed EMR (Al‑Shifa Laboratory), `https://emr2.xmed.pk`
Extraction date: 2026‑09‑15
Access: authenticated admin session provided by the system owner; extraction performed read‑only against pages already reachable from the "Manage Lab Tests" admin screen.

## Application architecture discovered

- The legacy system is a classic ASP.NET WebForms app. The test catalogue lives at `Settings > Manage Lab Tests` (`/admin/LabFees.aspx`), a server-rendered page whose grid is a client-side DataTable populated **entirely at initial page load** — all 2,703 test rows (with their internal database IDs) are present in the DOM/DataTable object on load, not paginated via AJAX.
- The grid's display "Sr" column (1…2703) is only a presentation ordinal. The real primary key for a test is a separate internal `id`, embedded in each row's action-icon links (e.g. `LabTests_D.aspx?id=5596`). Sr and internal `id` are unrelated sequences — Sr must never be used as a foreign key.
- A parallel master list, `Settings > Manage Lab Test Parameters` (`/admin/LabTestParameters.aspx`), holds a **parameter catalogue** with the same shape as `parameters.csv` (Sr, Name, Normal Range, Unit, Default Value, Category, Type, Valid, Highlight). Critically, **this master list is not deduplicated** — 2,983 rows resolve to only ~1,166 distinct normalized parameter names, i.e. the same logical parameter (e.g. "ESR", "TSH") exists many times over as separate rows/IDs. There is no evidence of a clean, stable parameter master keyed by a single canonical ID.

## Mapping retrieval mechanism

Opening a test's "Modify Details" action (pencil icon) in the Manage Lab Tests grid loads `/admin/LabTests_D.aspx?id={internalTestId}` into a modal. The returned HTML contains **both** the test's own fields (name, department, rate group, specimen, reporting category) **and** its full ordered parameter table (sequence number embedded in the name, e.g. `"3.Red Blood Cell (RBC)"`, plus Normal Range, Unit, Default Value, Type) in the same response — this is **Pattern D (mapping included in test detail response)**.

The endpoint is guarded: navigating to it directly in a fresh tab (no prior same-origin context) redirects to `/Home.aspx`, consistent with a Referer/session check tied to being opened from `LabFees.aspx`. It works reliably, however, when called via `fetch()` executed **from JavaScript running on the `LabFees.aspx` page itself** — the browser automatically sends the correct `Referer`, and the call is a plain authenticated `GET` with no side effects (verified: no state changes, same data as the UI modal).

A second candidate, `LabTests_K.aspx?id=...` ("Consumables/Kits"), was inspected and ruled out — it returns inventory/consumable items linked to a test, not clinical parameters.

### Endpoint

- Method: `GET`
- URL: `/admin/LabTests_D.aspx?id={internalTestId}`
- Required identifier: the test's internal database ID (not the grid's Sr column)
- Response: full HTML page containing a `<table>` of parameter rows: `[displaySeq.Name, NormalRange, Unit, DefaultValue, Type]`
- Auth: existing admin session cookie; must be invoked with the Manage Lab Tests page as same-origin referrer

## Extraction method

1. Loaded `/admin/LabFees.aspx` once; read the entire client-side DataTable (`window.jQuery('#mBody_grdApp').DataTable()`), extracting `[internalId, Sr, Name, Department, Group, Amount, Type]` for all 2,703 rows directly from the DOM — no additional network calls needed for the catalogue itself.
2. Filtered to the migration-relevant target set per the stated criteria (genuine lab investigation, price > 0):
   - **Multi** report type, `Amount > 0` → **103 tests**
   - **Single** report type, `Amount > 0` → **226 tests** (added per owner follow-up request, to reach a complete Test→Parameter dataset; the same price filter was applied for consistency and manageable scope)
3. For each target test, called `fetch('/admin/LabTests_D.aspx?id={internalId}')` from the Manage Lab Tests page's own JS context, parsed the returned HTML's parameter table, and recorded `[sequence, name, normal_range, unit, default_value, type]` per row, preserving display order.
4. Requests were paced (350–400 ms between calls) and run in small batches (15–26 tests at a time) to avoid bursting the server; every result was logged with its source test ID so failures could be isolated without stopping the run.
5. Matched each extracted parameter name against the master `parameters.csv`/`LabTestParameters.aspx` list by normalized name, disambiguating duplicate-name candidates using unit match where possible; ambiguous or unmatched cases were flagged rather than silently guessed.

## Coverage

| Metric | Count |
|---|---|
| Total tests in legacy catalogue (`tests.csv`) | 2,703 |
| Total Multi-type tests | 650 |
| Multi-type tests with price > 0 (target set) | 103 |
| Total Single-type tests | 1,522 |
| Single-type tests with price > 0 (target set) | 226 |
| Tests successfully queried (HTTP 200, matches UI) | 329 / 329 |
| Tests with ≥1 parameter extracted | 305 |
| Tests with zero parameters configured in legacy system | 24 (5 Multi, 19 Single — confirmed genuine, not extraction failures; see Validation) |
| Total parameter rows extracted | 796 (589 from Multi tests, 207 from Single tests) |
| Distinct parameter names across extraction | 373 |
| Master `parameters.csv` rows / distinct normalized names | 2,983 / ~1,166 |

## Validation

- **CBC With ESR** (internal id 5596, Sr 81): parameter table opened via UI modal was read directly (35 rows: ESR, Hemoglobin, RBC, HCT, MCV, MCH, MCHC, RDW-CV/SD, Platelets, MPV, PDW, PCT, P-LCC, P-LCR, WBC, differential count, absolute counts, band cells, etc.) and used to confirm the extraction method before bulk use.
- **Lipid Profile** (internal id 12318, Sr 1987, BIOCHEMISTRY, Multi, Rs 1,000): re-opened live in the UI after bulk extraction and visually compared parameter-by-parameter (Serum Cholesterol, Triglycerides, HDL, LDL, Cholesterol/HDL Ratio, VLDL with exact normal ranges and units) against the automated extraction — **exact match**.
- **HCV Genotyping** (internal id 12261): flagged as `NO_PARAMETERS_RETURNED` by the extractor; independently re-fetched and inspected — the detail page genuinely contains zero parameter-shaped table rows, confirming this is a real gap in the legacy configuration, not an extraction defect.
- A small number of long, multi-clause reference ranges (e.g. Beta‑HCG by gestational week, LH/FSH/Prolactin by sex/phase, age‑banded Creatinine/Albumin/Bilirubin ranges) were re-fetched a second time to confirm exact verbatim text before being written to the final CSV, since these are easy to paraphrase incorrectly by hand.

## Limitations

1. **No stable parameter master ID.** `parameters.csv` / `LabTestParameters.aspx` contains many duplicate rows per logical parameter name (e.g. 13 separate "ESR" rows, 25 "TSH" rows), each apparently created ad hoc per test rather than referenced from a shared master. The `href` numbers embedded in each parameter row's reorder/delete icons (e.g. `MoveUp(testId, rowId)`) are **not** stable references to a master parameter — this was verified and ruled out early. Consequently, `parameter_id` in the output is a best‑effort name+unit match against the master list, not a guaranteed foreign key; rows are flagged `MAPPING_EXTRACTED_AMBIGUOUS_NAME` whenever more than one master candidate matches. The extracted `parameter_name`, `normal_range`, `unit`, `parameter_type` and sequence — taken directly from the live test detail page — are the authoritative, traceable data; the master-list ID is enrichment only, as instructed.
2. **Scope is price>0 tests only.** Following the criteria in the mapping-discovery brief, only Multi/Single tests with `Amount > 0` were extracted (103 + 226 = 329 of 2,703 total tests, i.e. all price-bearing Multi tests and the price-bearing Single tests). Zero-price and "Custom" report-type tests (531 total) were out of scope and were not queried.
3. **24 tests have no configured parameters** in the legacy system itself (mostly PCR/genotyping/screening tests such as HCV Genotyping, HBV/HCV DNA PCR, Salmonella Stool Antigen, ANTI HEV IgG, and several single-parameter placeholders like Coombs Test, Bile Pigment/Salt, ECG). These cannot be migrated with a parameter mapping because none exists to recover — flagged `NO_PARAMETERS_RETURNED` rather than invented.
4. **Duplicate parameter rows within a single test** (e.g. Mean Cell Volume appearing twice in a couple of CBC variants) were preserved as-is and flagged in `legacy_mapping_collisions.csv` rather than silently deduplicated, since the legacy configuration itself contains the duplication.

## Output files

- `legacy_test_parameter_mapping.csv` — 796 rows, the primary Test→Parameter mapping (Multi + Single, price>0).
- `legacy_mapping_extraction_status.csv` — one row per target test (329) with status: `MAPPING_EXTRACTED`, `SINGLE_PARAMETER_TEST`, or `NO_PARAMETERS_RETURNED`.
- `legacy_unmatched_parameters.csv` — 577 extracted parameters whose name could not be uniquely resolved to one master `parameters.csv` entry (ambiguous-name or no-match cases), with the candidate IDs considered.
- `legacy_mapping_collisions.csv` — 16 findings: master parameter IDs shared across different names, parameter names spread across multiple master IDs, and duplicate parameter rows within a single test.
