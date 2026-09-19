# Catalog v2 — Work Details / Handoff Context

> **Read this first.** This document is written so that a new engineer or AI agent can
> understand, without any other context, what the v2 catalog is, how it was produced,
> what is finished, what needs refinement, and what has not been started.
> Last updated: 2026-09-19. Branch: `main`.

---

## 0. Goal (the "why")

**Goal 0: populate the Vexel LIMS with the final list of tests and parameters needed
for a basic, working LIMS setup** — real tests, real prices, sample types, the
parameters (result fields) each test reports, their display order, units, and normal
ranges — so a lab can register patients, collect samples, enter results and print
reports on Vexel without hand-typing the catalogue.

The source of truth for *what the lab actually runs* is the lab's existing production
system: **xMed EMR (Al‑Shifa Laboratory), `https://emr2.xmed.pk`**, an ASP.NET WebForms
LIMS. Vexel is a clean v1 rebuild (see repo `CLAUDE.md`: "No legacy compatibility" —
we do not build shims for the old system; we only **migrate its catalogue data once**
through Vexel's normal catalog import pipeline).

Guiding principles carried through all of the work below:

1. **The legacy system is authoritative.** Do not reconstruct clinical content from
   general knowledge when the legacy system already has it.
2. **Never invent data.** If something could not be recovered, leave it blank and flag
   it (`---Not-Defined---`, blank `allowedValues`, `MANUAL_REVIEW:` notes) rather than guess.
3. **Read-only against the legacy system.** Every request to xMed was a plain `GET`.
   Nothing was created, edited, saved or deleted there.
4. **Preserve traceability.** Every Vexel test carries `userCode = legacy-<legacyInternalTestId>`;
   every parameter row can be traced back through `reports/parameter_dedup_report.csv`.
5. **Use Vexel's own import pipeline** (XLSX workbook → `POST /catalog/import`), keyed by
   tenant‑scoped `externalId`. No direct DB writes.

---

## 1. Status at a glance

| # | Area | Status |
|---|---|---|
| A | Discover where the legacy system stores Test→Parameter links | **DONE** |
| B | Extract Test→Parameter mapping for in‑scope tests (329 tests / 796 rows) | **DONE** |
| C | Extract legacy "Specimen Required" per test → SampleTypes | **DONE** (18 tests undefined in legacy) |
| D | Study Vexel data model + import format | **DONE** |
| E | Build the import workbook + per‑sheet CSVs + reports | **DONE** (with caveats below) |
| F | Structural self‑validation of the workbook | **DONE** (passes) |
| G | Commit + push to `origin/main` | **DONE** |
| H | **Dry‑run / real import into a Vexel tenant** | **NOT STARTED** ← next critical step |
| I | Reference ranges: 208 unparsed, blank‑bounds hazard | **NEEDS REFINEMENT** |
| J | 28 "coded" parameters without option lists | **NEEDS REFINEMENT** |
| K | 18 tests without a sample type | **NEEDS REFINEMENT** |
| L | 24 tests with zero parameters | **NEEDS REFINEMENT** (legacy has none) |
| M | Canonical parameter review (unit/type conflicts, HCT typed `Text`) | **NEEDS REFINEMENT** |
| N | `isActive` assumed `true` for all tests (legacy Disabled status not captured) | **NEEDS REFINEMENT** |
| O | Legacy **Custom** report‑type tests with price > 0 (34) | **NOT STARTED** |
| P | Legacy zero‑price tests (2,340) — decide if any belong in a "basic" set | **NOT STARTED** (decision) |
| Q | Legacy Packages/groups → Vexel Panels/PanelTests | **NOT STARTED** |
| R | Turnaround time, machine, methodology, print‑alone flags, rate groups | **NOT STARTED** |
| S | Print/report templates per test (`TestTemplateMap`) | **NOT STARTED** |
| T | LOINC codes, methods | **NOT STARTED** (not in legacy data) |
| U | Clinical/lab‑director QA sign‑off of the whole catalogue | **NOT STARTED** |

Detailed descriptions of every row follow in §6 (done), §7 (needs refinement), §8 (pending).

---

## 2. Deliverables in this folder

```
docs/catalog/build/v2/
├── workdetails.md                         ← this file
├── workbooks/
│   └── catalog_v2_legacy_migration.xlsx   ← THE import artifact (5 sheets)
├── normalized/                            ← same data, one CSV per sheet (for review/diffing)
│   ├── SampleTypes.csv        (22 rows)
│   ├── Parameters.csv         (373 rows)
│   ├── Tests.csv              (329 rows)
│   ├── TestParameters.csv     (796 rows)
│   └── ReferenceRanges.csv    (706 rows; 208 of them are "MANUAL_REVIEW", no numeric bounds)
└── reports/
    ├── catalog_v2_build_report.md         ← summary/counts of the build
    ├── parameter_dedup_report.csv         ← every legacy param row → canonical Parameter (796 rows)
    └── reference_ranges_manual_review.csv ← the 208 unparsed legacy range strings
```

Related earlier work (Phase 1, committed in `4dad135`):

```
docs/migration/legacy_lims_mapping/
├── LEGACY_LIMS_PARAMETER_MAPPING_DISCOVERY.md   ← how the legacy Test→Parameter link was found
├── legacy_test_parameter_mapping.csv            ← 796 extracted rows (the input to v2)
├── legacy_mapping_extraction_status.csv         ← per‑test status (329 rows)
├── legacy_unmatched_parameters.csv              ← name‑match ambiguity vs legacy master (577 rows)
└── legacy_mapping_collisions.csv                ← data‑quality findings (16)
```

Raw legacy exports (committed at repo root in `498212b`, supplied by the lab owner):
`tests.csv` (2,703 legacy tests: Sr, Test Name, Department, Group, Amount, Type) and
`parameters.csv` (2,983 legacy parameter rows: Sr, name, range, unit, default, category, type, valid, highlight).
Neither contains the Test→Parameter relationship, which is why extraction from the live system was needed.

---

## 3. How the work was done (chronological)

### Phase 1 — Find the Test→Parameter mapping in the legacy system
*(full detail in `docs/migration/legacy_lims_mapping/LEGACY_LIMS_PARAMETER_MAPPING_DISCOVERY.md`)*

- Access: the lab owner confirmed authorization, logged in manually in Chrome; automation
  reused that browser session. **No credentials were ever written to any file, script or doc.**
- Tooling: the Playwright MCP server was down, so the `claude-in-chrome` browser tools were used.
- Legacy catalogue lives at **Settings → Manage Lab Tests → `/admin/LabFees.aspx`**.
  Its grid is a client‑side DataTable that already holds **all 2,703 rows in the DOM**,
  including each row's *internal* test id inside the action links
  (`LabTests_D.aspx?id=5596`). The grid's visible `Sr` column is only a display ordinal and
  is **not** the key. (Keep this in mind: `tests.csv` has `Sr` but no internal id.)
- The row's pencil icon ("Modify Details") loads `GET /admin/LabTests_D.aspx?id=<internalTestId>`
  in a modal. That server‑rendered page contains the test fields **and** the ordered parameter
  table (`"<seq>.<Name>"`, Normal Range, Unit, Default Value, Type) — i.e. the link is
  embedded in the test‑detail response ("Pattern D").
- That URL redirects to `/Home.aspx` if opened directly (Referer/session check). It works when
  `fetch()` is executed **from JS running on the LabFees.aspx page** (browser sends the right
  Referer). Requests are plain authenticated GETs, paced 300–400 ms, in batches.
- Ruled out: `LabTests_K.aspx` (that is "Consumables/Kits", inventory not parameters), and the
  numbers in parameter‑row reorder/delete links (they are junction‑row ids, **not** stable
  parameter‑master ids).
- **Important finding:** legacy `parameters.csv` / "Lab Test Parameters" master is **not a clean
  master**: 2,983 rows collapse to ~1,166 distinct normalized names (e.g. 25 separate "TSH" rows).
  There is no reliable parameter id shared across tests. So v2 does **not** use the legacy
  parameter master ids at all; it builds its own canonical parameter list from the extracted rows.

### Phase 2 — Choose the extraction scope
From `tests.csv` (Type × price):

| Legacy report Type | Total | Price > 0 | Price = 0 |
|---|---|---|---|
| Single | 1,522 | **226** | 1,296 |
| Multi | 650 | **103** | 547 |
| Custom | 531 | 34 | 497 |
| **All** | **2,703** | **363** | 2,340 |

**In scope for v2 = Single + Multi with price > 0 = 329 tests.** (Rationale: original brief said
"genuine laboratory tests: Multi, price > 0"; the owner then asked to include Single tests too.
The same `price > 0` filter was kept for both.) Observation (not exhaustively verified): rows shown
in blue text in the legacy grid were the ones with Amount > 0.

Results: 329/329 requests succeeded; 305 tests returned ≥ 1 parameter; **24 tests genuinely have
zero parameters** configured in legacy (spot‑verified, e.g. HCV Genotyping — page has no parameter rows);
796 parameter rows total (589 from Multi, 207 from Single); 373 distinct parameter names.
Validated by opening CBC With ESR and Lipid Profile in the UI and comparing row‑by‑row (exact match).

### Phase 3 — Study the Vexel target
Findings (from `apps/api/prisma/schema.prisma`, `apps/api/src/catalog/*`, `packages/contracts/openapi.yaml`):

- Models: `CatalogTest`, `SampleType`, `Parameter`, `TestParameterMapping`, `ReferenceRange`,
  `CatalogPanel`, `PanelTestMapping`. All tenant‑scoped. **No enums** (categorical fields are strings).
- **No** Single/Multi/Custom concept (a "multi" test is just one with many mappings), **no** Department
  entity (free‑text `CatalogTest.department`), **no** rate groups (flat `price`).
- `Parameter` is one tenant‑wide definition reused by many tests; per‑test customisation is only
  `unitOverride`, `displayOrder`, `isRequired` on the mapping. **Normal ranges live in `ReferenceRange`**
  (optional `testId`, so a range can be global to a parameter or scoped to one test; gender is `M`/`F`).
- **The only real import path is an XLSX workbook** (sheets `SampleTypes`, `Parameters`, `Tests`,
  `TestParameters`, `Panels`, `PanelTests`, `ReferenceRanges`) uploaded via
  `POST /catalog/import` (legacy, used by Admin UI) or `POST /catalog/import/workbook` (canonical),
  or async via `POST /catalog/import-jobs`. Exact column lists come from
  `generateWorkbookTemplate()` in `apps/api/src/catalog/catalog-import-export.service.ts`.
  Modes: `UPSERT_PATCH` (default) / `CREATE_ONLY`; `validate=true` = dry run; `__CLEAR__` token nulls a field.
- `docs/catalog/build/v1/**` is an older 3‑test starter catalogue (`t101–t103`, `p101–p112`); nothing in
  code consumes its CSVs — they are authoring artifacts for the workbooks. v2 follows the same folder
  convention (`normalized/`, `workbooks/`, `reports/`).
- Constraints enforced by `catalog.service.ts`: `externalId` must match `^t\d+$` / `^p\d+$` / `^s\d+$`;
  `externalId` and `userCode` unique per tenant; ReferenceRange `gender` must be `M`, `F` or blank.

### Phase 4 — Supplementary extraction: "Specimen Required"
The first extraction did not capture the specimen dropdown (`#mBody_ddlSpecimen` on the same
`LabTests_D.aspx` page). A second read‑only pass fetched it for all 329 tests (same method,
~10 batches). Also checked whether "List"‑type parameters expose their option list anywhere in the
reachable read‑only UI: **they do not** (locked parameter rows have no `<select>`/options), so
`allowedValues` are left blank and flagged — not guessed.

### Phase 5 — Build the sheets
(Scripts were ephemeral — see §9 for the exact algorithm so it can be re‑implemented.)

1. **Parameters** — cluster the 796 legacy parameter rows by *normalized name*
   (strip leading `<n>.`, lowercase, non‑alphanumerics → space). One canonical Parameter per cluster:
   name = most common spelling; `defaultUnit` = most common unit; `resultType` from most common legacy
   Type. IDs `p2000…p2372`. `userCode` = upper‑case slug of the name (truncated 24 chars; 5 collisions
   were fixed by suffixing `_<externalId>` on 2026‑09‑19).
   Legacy Type → `resultType`: Decimal/Integer/Formula/Machine → `numeric`; Text → `text`;
   List → `coded`; Date → `text` (Vexel has no date type). Result: 246 numeric, 99 text, 28 coded.
2. **SampleTypes** — cluster distinct legacy specimen strings verbatim → 22 types `s2000…s2021`.
   `---Not-Defined---` → no sample type (18 tests).
3. **Tests** — one row per in‑scope test, IDs `t2000…t2328` in ascending legacy‑internal‑id order;
   `userCode = legacy-<internalId>`; `department` = legacy department text; `price` = legacy Amount
   (commas stripped); `isActive = true`; `method`/`loincCode` blank.
4. **TestParameters** — one row per legacy parameter row; `displayOrder` = legacy sequence number
   (the leading `<n>.`; note legacy sequences are not always contiguous or unique — see §7‑M);
   `isRequired = true`; `unitOverride` only when a row's unit differs from the canonical unit.
5. **ReferenceRanges** — rule‑based parse of each legacy free‑text range (regexes in §9). Every range is
   **test‑scoped** (`testExternalId` set) because the same parameter has different ranges in different tests.
   Placeholder `-` = "no range defined" → no row. Unparseable → row with **no bounds** and
   `notes = "MANUAL_REVIEW: <verbatim legacy text>"`.
6. **Workbook** — exact header match to `generateWorkbookTemplate()`; no `Panels`/`PanelTests` sheets.
7. **Validation** — headers match; unique externalIds; all foreign keys resolve; `resultType` ∈ enum;
   `gender` ∈ {M,F,blank}; price ≥ 0; ID patterns. **All passed.** (Added 2026‑09‑19: `userCode` uniqueness for Parameters.)
8. **Spot checks** — HB (single), BLOOD C/E (33‑parameter multi), HCV Genotyping (zero‑parameter) traced end‑to‑end against source.

### ID ranges (disjoint from v1 starter catalogue)
Tests `t2000–t2328`, Parameters `p2000–p2372`, SampleTypes `s2000–s2021`. Chosen so import can never
collide with `t101–t103/p101–p112` or the base catalogue seeded by `POST /tenants/{id}:enable-lims`
(`apps/api/resources/catalog/base_catalog_v1.xlsx`, see `docs/catalog/base-catalog-seeding.md`).

---

## 4. Field mapping: legacy → Vexel

| Legacy (xMed) | Vexel sheet.column | Notes |
|---|---|---|
| Test internal id (`LabTests_D.aspx?id=`) | `Tests.userCode` = `legacy-<id>` | traceability; not the grid `Sr` |
| Test Name | `Tests.name` | verbatim (some legacy names have trailing spaces removed) |
| Department (text) | `Tests.department` | free text; no Department entity in Vexel |
| Amount (Default rate group) | `Tests.price` | PKR; `General Patients` rate group **not** extracted |
| Specimen Required | `SampleTypes.name`, `Tests.specimenType`, `Tests.sampleTypeExternalId` | verbatim text |
| Reporting Category Single/Multi/Custom | *(not carried)* | implicit in mapping count in Vexel |
| Parameter "Name" (`<seq>.<Name>`) | `Parameters.name`, `TestParameters.displayOrder` | seq → displayOrder |
| Unit | `Parameters.defaultUnit` / `TestParameters.unitOverride` | Vexel `normalizeUnit` aliases some units on import |
| Type | `Parameters.resultType` | see §3 Phase 5 |
| Default Value | `Parameters.defaultValue` | **NOT populated in v2** — see §7‑M |
| Normal Range (free text) | `ReferenceRanges.*` | parsed; see §7‑I |
| Time (Minutes), Machine Used, Methodology, Single Page, Custom Report, Rate Group | — | **not extracted** (§8‑R) |
| Status Active/Disabled | `isActive` | **not extracted**; all set `true` (§7‑N) |

> ⚠️ **Default Value gap:** the extraction captured legacy "Default Value" per row
> (e.g. `75` for "After intake of Glucose", `Negative` for HBsAg screening) and it is present in
> `docs/migration/legacy_lims_mapping/legacy_test_parameter_mapping.csv`, but `Parameters.defaultValue`
> is blank in v2 because defaults can differ per test for the same parameter. Decide policy (§7‑M).

---

## 5. Counts (v2 workbook)

| Sheet | Rows |
|---|---|
| SampleTypes | 22 |
| Parameters | 373 (246 numeric / 99 text / 28 coded) |
| Tests | 329 (103 Multi + 226 Single in legacy terms) |
| TestParameters | 796 |
| ReferenceRanges | 706 = 498 structured + 208 manual‑review (no bounds) |

Reference‑range parse outcome over the 796 legacy range strings:
368 simple `A - B` · 36 comparator (`Less Than N`, `< N`, `> N`) · 34 gender‑split ranges (→ 68 rows) ·
13 gender‑split comparators (→ 26 rows) · 137 `-` placeholder (skipped, no row) · **208 not parsed**.
(451 parsed strings → 498 structured rows.)

---

## 6. DONE — details

- **A/B** Mapping discovery + extraction — see `docs/migration/legacy_lims_mapping/`. Validated against UI.
- **C** Specimen extraction — 329/329 captured. Distribution: 194 × "3-5cc Clotted Blood or Serum",
  42 × "3cc EDTA BLOOD (Purple Vial)", 20 × "Urine (Random/Spot)", 18 × undefined, 11 × "Sodium Citrate Tube (PT Vial)", … (22 distinct).
- **D** Vexel model/import study — captured in §3 Phase 3.
- **E/F** Workbook + CSVs + reports + validation — files in §2.
- **G** Git: `4dad135` (Phase 1 docs), `498212b` (v2 sheets + raw CSVs), plus the commit that added this file
  and the userCode fix. Pushed to `origin/main`.

---

## 7. NEEDS REFINEMENT — work started, not finished

### I. Reference ranges (208 unparsed rows + an import hazard)
- **What:** 208 rows in `ReferenceRanges.csv` have `notes = MANUAL_REVIEW: <legacy text>` and **empty
  `lowValue`/`highValue`**. Categories: age‑banded tables (`Adult: 25 - 40, Child: 45- 70`,
  `Adult/Infant/Newborn`), qualitative/interpretive results (`Negative`, `Non-Reactive`, `Clear`),
  multi‑tier thresholds (`Negative: < 0.9 Borderline: 0.9 to 1.2 Positive: > 1.2`), multi‑phase/trimester
  hormone tables (Beta‑HCG, LH/FSH/Prolactin, Progesterone, AMH), `(See below)` placeholders,
  unit‑embedded ranges (`0.5-1.0 x 10^12/L`), text like `34 Sec`. Full list: `reports/reference_ranges_manual_review.csv`.
- ⚠️ **Import hazard (verified by reading `_importReferenceRange`):** the importer does not persist the
  `notes` column (the `ReferenceRange` model has no notes field) and creates a row even when both bounds
  are empty. **Uploading the workbook as‑is would create 208 empty range rows and lose the legacy text.**
  **Before any real import: delete those 208 rows from the *workbook's* `ReferenceRanges` sheet** (keep
  them in the review CSV), then curate and re‑add structured versions. Recommended approach for age/gender
  tables: one `ReferenceRange` row per band using `gender`, `ageMinYears`, `ageMaxYears`; qualitative
  results belong in `coded`/`text` parameters with `allowedValues`/`defaultValue`, not in ranges.
- Also: `criticalLow`/`criticalHigh` are all blank. Legacy `parameters.csv` has `Valid` and `Highligh`
  columns (e.g. `0 - 500`, `0 - 30`) that may be validity limits / abnormal highlight thresholds — **semantics
  not yet verified**, unused.
- Two duplicate range keys exist (same parameter/test/gender/age) — see §7‑M duplicates.

### J. 28 `coded` parameters have no `allowedValues`
Legacy "List" type; option lists are not readable from the admin UI. Examples: Blood Group RH Factor,
HBsAg/Anti‑HCV/HIV screening results, Donor Blood Group, Fructose, Urine appearance/PH… Filter
`Parameters.csv` for `resultType=coded`. Options to fill: (a) lab director supplies lists, (b) inspect the
result‑entry screen of an existing patient report (`/Labs.aspx`) — read‑only browsing only, avoid patient data
exposure, (c) standard sets (Positive/Negative etc.) after clinical sign‑off.

### K. 18 tests have no sample type
Legacy specimen was `---Not-Defined---` (e.g. Cross Match & Screening, PT with INR (12282), Typhidot,
Clotting Time, Bleeding Time, HCV Genotyping, ECG, …). Left blank on purpose. Assign manually.

### L. 24 tests have zero parameters
Real, priced, active legacy tests with no parameter rows (PCR/genotyping/screening: HCV Genotyping, HBV/HCV DNA PCR,
Salmonella Typhi Ag (Stool), ANTI HEV IgG, plus single‑type placeholders such as Coombs, Bile pigment/salt, ECG,
MTB by PCR, DHEA SO4…). They import as Tests with no mappings; a lab must define their result fields.
Status list: `docs/migration/legacy_lims_mapping/legacy_mapping_extraction_status.csv` (`NO_PARAMETERS_RETURNED`).

### M. Canonical parameter quality
- 14 canonical parameters had **inconsistent units** across legacy occurrences and 7 had **inconsistent legacy
  types**; the most common value was used. Review `reports/parameter_dedup_report.csv`
  (columns `unit_mismatch_flag`, `type_mismatch_flag`).
- **Hematocrit (HCT) is `Text` in all 13 legacy occurrences** (a legacy configuration quirk), so it is `resultType=text`
  in v2 even though it is numeric clinically. Same class of issue may exist for other parameters — review the
  99 `text` parameters for ones that should be `numeric`.
- Dedup is by **name only**: same name ⇒ same Parameter, with per‑test ranges carried in test‑scoped ReferenceRanges.
  Two legacy parameters that share a name but are clinically different would be merged (none found, not exhaustively audited).
- `Parameters.defaultValue`, `decimals`, `allowedValues`, `loincCode` are blank (see §4 note).
- **Duplicate (test, parameter) pairs:** `t2315` and `t2316` (the two "Complete Blood Count – CBC with ESR / with Blood Group"
  variants) list Mean Cell Volume (`p2239`) twice with different ranges (75–100 and 78–95). The importer upserts by
  `(testExternalId, parameterExternalId)`, so the second overwrites the first. Decide which is correct and delete the other.
- **Display order:** legacy sequence numbers are not always contiguous/unique (e.g. DLC has several rows numbered `1`, `4`;
  BLOOD C/E jumps 16→18). They were preserved as‑is. Vexel sorts by `displayOrder`; ties are ambiguous. Consider
  renumbering 1..n preserving legacy order.
- Legacy names contain typos preserved verbatim (`Promeyelocyctes`, `Metamyelocyctes`, `Boderline High`, `Osmolaliyt`,
  `Alkalaine Phosphatase`). Clean up with lab sign‑off (do not silently "correct" clinical labels).
- Sample type names are raw legacy dropdown text including volumes ("3-5cc Clotted Blood or Serum"). Consider
  normalising to clean names (Serum / EDTA Whole Blood / Citrate / Urine / 24h Urine / Stool / Fluid / CSF / Semen / Stone …)
  and moving volume text to `description`.

### N. `isActive` is hard‑coded `true`
The legacy grid has a Status filter (Active/Disabled). Status was **not captured**, so any legacy‑disabled test with a
price would import as active. Capture status (the same `LabFees.aspx` DataTable/row markup or the Status filter) and set
`isActive` accordingly before go‑live.

---

## 8. PENDING — not started

### H. Import into Vexel (highest priority, ~small effort)
1. Choose target tenant/environment; ensure LIMS module enabled (`POST /tenants/{id}:enable-lims`; decide whether to seed base catalogue first).
2. Apply §7‑I fix (drop the 208 blank range rows from the *upload* workbook).
3. `POST /catalog/import/workbook?validate=true&mode=UPSERT_PATCH` (dry run) with `catalog_v2_legacy_migration.xlsx`
   (Admin UI Import/Export screen uses `POST /catalog/import`). Fix every reported error.
4. Real import; then `GET /catalog/export/workbook.xlsx` and diff against the source workbook (round‑trip check).
5. Spot‑check in Admin/Operator UI: register a test order, enter results for CBC, Lipid Profile, HB, verify ranges/units/order.
6. Note: workbook sheet order processed by importer is SampleTypes → Parameters → Tests → TestParameters → Panels → PanelTests → ReferenceRanges.

### O. Legacy **Custom** report‑type tests with price > 0 (34 tests)
Not extracted. "Custom" tests use a custom report template (e.g. `Lipid Profile` Sr 655 @ 1,500; `CBC With ESR` Sr 222 @ 700).
They may be panels/packages or report layouts and could include core lab tests. Investigate what `Custom` means
(the detail page has a `Custom Report` dropdown, `#mBody_ddlCustom`, 40 options), extract them the same way, and decide
whether they become Tests, Panels, or template mappings in Vexel.

### P. Zero‑price legacy tests (2,340: 1,296 Single + 547 Multi + 497 Custom)
Excluded by the `price > 0` rule. Likely duplicates/unpriced legacy variants (many names repeat, e.g. 10+ "CBC"/"Lipid Profile" rows),
but some may be legitimately used with per‑rate‑group pricing. **Business decision needed** on whether any belong in a
"basic LIMS" catalogue. If yes, the same extraction method applies (`fetch LabTests_D.aspx?id=`).

### Q. Packages / panels
Legacy has "Packages" (`/admin/LabTestGroups.aspx`) — groupings of tests. Not extracted. Map to Vexel `Panels` + `PanelTests`
(externalIds `g<n>`) and add those two sheets.

### R. Other test metadata not extracted
Time (Minutes) → `turnaroundHours` (legacy shows values like 1500/3400; units/semantics unverified),
Machine Used, Methodology flag, Single Page (→ maybe `printAlone`), Reporting Category, Rate Groups (`General Patients` prices;
Vexel has a single flat price), Rate‑group specific amounts via `LabFees_D.aspx?tid=`.

### S. Result/print templates
Vexel has `PrintTemplate`/`TestTemplateMap`/`resultSchemaType` (default `TABULAR`). Legacy per‑test report layouts
(`Preview` link, `Custom Report`, `Single Page`) are not mapped. Needed for report parity (see `docs/specs/` document pipeline).

### T. LOINC / method
Not present in legacy data; leave blank unless a separate source is provided.

### U. Clinical QA
A lab director / senior technologist must review: units, ranges (especially auto‑parsed ones), parameter names, sample types,
specimen assignments, and the final test list before go‑live. Nothing in this catalogue has had clinical sign‑off.

### V. Housekeeping
- `tests.csv` / `parameters.csv` sit at repo root (committed). Consider moving to `docs/catalog/build/v2/raw/` (v1 has a `raw/` folder).
- The build/extraction scripts were **not saved** to the repo. Recommend adding a reproducible `scripts/` implementation (§9) and a
  checked‑in copy of the intermediate extraction data (specimen per test is now only in `Tests.csv`; parameter rows are in
  `docs/migration/legacy_lims_mapping/legacy_test_parameter_mapping.csv`).

---

## 9. Reproduction notes (algorithms & snippets)

### 9.1 Browser extraction (run on `/admin/LabFees.aspx`, authenticated, same origin)
```js
// all test rows incl. internal ids (DataTable already holds every row client-side)
const nodes = jQuery('#mBody_grdApp').DataTable().rows().nodes();
// per row: td[1]=Sr td[2]=Name td[3]=Dept td[4]=Group td[5]=Amount td[6]=Type;
// internal id = first digits in href of first <a> in td[0]  (…LabTests_D.aspx?id=NNNN)

// per test
const r = await fetch('/admin/LabTests_D.aspx?id='+id, {credentials:'same-origin'});
const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
const name = doc.querySelector('input[name*="txtName"]').value;
const sel = doc.querySelector('#mBody_ddlSpecimen'); const specimen = sel.options[sel.selectedIndex].text;
const rows = [...doc.querySelectorAll('table tr')].filter(tr=>tr.querySelectorAll('td').length>=5)
  .map(tr=>{const t=tr.querySelectorAll('td'); return [0,1,2,3,4].map(i=>t[i].textContent.trim());});
// row = [ "<seq>.<Name>", normalRange, unit, defaultValue, type ]
```
Tool quirks: returning large JSON from the JS tool truncates at ~1.5 KB — log one small line per test with `console.log('PREFIX|id|json')` and read with
`read_console_messages(pattern='^PREFIX\\|')`. JS tool calls time out at ~45 s but the page script keeps running; read the console afterwards.
Blocked patterns: returning raw HTML/hrefs that look like cookie/query data is blocked; parse in‑page and return only extracted fields.

### 9.2 Name normalisation (parameter dedup)
`re.sub(r'^\d+\.\s*','',n).strip().lower()` → `re.sub(r'[^a-z0-9]+',' ',…)` → collapse spaces.

### 9.3 Reference‑range parser (Python, conservative)
```
NUM = r'(-?\d+(?:\.\d+)?)'
SIMPLE_RANGE      ^NUM\s*-\s*NUM$                                → low,high (require low<=high)
LESS_THAN         ^(less\s*than|up\s*to|<=?)\s*NUM$             → highValue
GREATER_THAN      ^(greater\s*than|more\s*than|>=?)\s*NUM$      → lowValue
GENDER_SPLIT      (?<![A-Za-z])(?:(female|male)\s*:?\s*|(f|m):\s*)NUM\s*-\s*NUM      (≤2 matches, ≥60% of string consumed, no repeated gender) → gender F/M rows
GENDER_COMPARATOR (?<![A-Za-z])(?:(female|male)\s*:?\s*|(f|m):\s*)(less than|up to|greater than|more than|<=?|>=?)\s*NUM   (same guards)
'-' / '' / n/a / nil → skip (no range)
anything else → MANUAL_REVIEW row, no bounds
```
Gotcha discovered: legacy text often runs a digit straight into the next label (`…14.0Male:…`); a plain `\b` does **not** match there — use the negative lookbehind above.
Importer semantics: `ReferenceRanges.gender` ∈ {`M`,`F`}; bounds may be given as `lowValue`/`highValue` (preferred) or `rangeExpression` (`a-b`, `<n`, `>n`, `<=n`, `>=n`, no spaces).

### 9.4 Validation checklist (re‑run after any edit)
Header equality with `generateWorkbookTemplate()`; unique `externalId` per sheet **and unique `userCode` per sheet**;
all FK references resolve; `resultType ∈ {numeric,text,boolean,coded}`; `gender ∈ {M,F,''}`; price ≥ 0;
`externalId` regexes; no duplicate `(testExternalId,parameterExternalId)`; no `ReferenceRanges` row with both bounds empty (see §7‑I).

---

## 10. Suggested next steps (in order)

1. **§8‑H prep**: create an upload copy of the workbook without the 208 blank range rows; dry‑run against a dev tenant; fix errors.
2. **§7‑N**: capture legacy Active/Disabled status; set `isActive`.
3. **§7‑M**: resolve the 2 duplicate MCV rows; renumber `displayOrder`; review `text` parameters that should be numeric (HCT).
4. **§7‑K/J/L**: fill sample types, coded option lists, and zero‑parameter tests with lab staff.
5. **§7‑I**: curate the 208 ranges (age/gender bands) with the lab director; add as structured rows.
6. **§8‑O/P/Q**: investigate Custom tests (34 priced), decide on zero‑price tests, extract Packages → Panels.
7. **§8‑R/S**: turnaround times, print templates.
8. Real import + round‑trip export diff + UI spot checks; clinical sign‑off; tag release notes (`docs/catalog/build/v2/release-notes/`, mirroring v1).
