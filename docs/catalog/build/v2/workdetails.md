# Catalog v2 — Work Details / Handoff Context

> **Read this first.** This document is written so that a new engineer or AI agent can
> understand, without any other context, what the v2 catalog is, how it was produced,
> what is finished, what needs refinement, and what has not been started.
> Last updated: 2026-09-20. Branch: `main`.
> **Key update 2026-09-20:** an audit of the Vexel code (§11) found that the catalogue is not only
> a data-loading task — Vexel itself is missing features needed to hold the legacy normal ranges,
> paragraph/heading result rows, and several result-entry features are wired incorrectly. The earlier
> advice to "delete the 208 blank range rows before upload" is **withdrawn**: those ranges are a
> real requirement and must be kept (as text) until Vexel can store them. See §7‑I and §11.

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
| W | **Vexel platform gaps** — cannot store/print the legacy ranges, no paragraph result type, no heading rows (see §11) | **NOT STARTED — BLOCKER for full catalogue** |
| X | **Vexel wiring bugs** — number/dropdown/default-value/critical-flag features exist but don't work (see §11.2) | **NOT STARTED — needs verification then fix** |
| I | Reference ranges: 208 legacy ranges Vexel cannot hold today (must NOT be deleted) | **NEEDS REFINEMENT — blocked by W** |
| J | 28 "coded" (choice) parameters without option lists | **NEEDS REFINEMENT** |
| K | 18 tests without a sample type | **NEEDS REFINEMENT** (not a blocker — fill later, e.g. web lookup) |
| L | 24 legacy *tests* with no result fields at all | **NEEDS REFINEMENT** (most need result types from W) |
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

### I. Legacy normal ranges that Vexel cannot hold today (208 rows) — MUST BE KEPT, NOT DELETED
Normal ranges are a **requirement** of the test list. The 208 rows in `ReferenceRanges.csv` with
`notes = MANUAL_REVIEW: <legacy text>` (empty `lowValue`/`highValue`) are legacy ranges the current
parser could not turn into numbers. They are only **~102 distinct texts** repeated across tests, so the
curation job is smaller than 208 suggests. Full list: `reports/reference_ranges_manual_review.csv`.

They fall into 5 kinds (counts are rows in the review CSV):

| # | Kind | Rows | Examples | What Vexel needs (see §11.1) |
|---|---|---|---|---|
| 1 | Words only | 71 | `Negative`, `Neutral`, `Non- Reactive`, `Clear`, `Pale Yellow - Yellow`, `(See below)` | "Expected text result" — normal is this word, anything else is abnormal |
| 2 | Number plus a note / unit / condition | 29 | `34 Sec`, `0.5-1.0 x 10^12/L`, `<80<300 (pregnancy)`, `RPI <2: inadequate marrow response…` | Free-text reference note shown next to the range |
| 3 | Age groups | 27 | `Adult: 25 - 40, Child: 45- 70`, `Adult 0.5-2.5 / Infant 0.5-3.0 / Newborn 2.5-6.5` | Age in days/months + a label per band |
| 4 | Result bands | 69 | `Negative: < 0.9 Borderline: 0.9 to 1.2 Positive: > 1.2`, `Significant Titer 1:80` | Named bands that map to flags (Negative/Borderline/Positive) |
| 5 | Hormone / pregnancy tables | 12 | Beta‑HCG by gestational week, LH/FSH/Prolactin by cycle phase & menopause, Progesterone by trimester | Pregnancy / trimester / cycle‑phase / menopause conditions (or a printable reference table text) |

**Import hazard (verified by reading `_importReferenceRange`):** the importer does **not** persist the
`notes` column (the `ReferenceRange` model has no notes field) and it **does** create a row when both bounds
are empty. So uploading the workbook as-is would (a) create 208 empty range rows and (b) throw the legacy
wording away. **Earlier advice to delete those rows is withdrawn** — deleting them would also lose the
requirement. Correct approach:
1. Keep the legacy text (it lives in `reports/reference_ranges_manual_review.csv` and in the `notes` column of the sheet).
2. Add the platform capability first (§11.1 Step 1: a free-text "reference text" on ranges, shown on the result
   screen and printed on the report). Then load these 208 ranges as reference text.
3. Later (§11.1 Step 2) replace the text with proper structured bands so flags (HIGH/LOW/POSITIVE) work.
Until Step 1 exists, do **not** import the 208 rows.

Also: `criticalLow`/`criticalHigh` are all blank. Legacy `parameters.csv` has `Valid` and `Highligh` columns
(e.g. `0 - 500`, `0 - 30`) that may be validity limits / abnormal highlight thresholds — **semantics not yet
verified**, unused. Two duplicate range keys exist (same parameter/test/gender/age) — see §7‑M.

### J. 28 `coded` (choice) parameters have no option lists
Legacy "List" type; option lists are not readable from the admin UI. Examples: Blood Group RH Factor,
HBsAg/Anti‑HCV/HIV screening results, Donor Blood Group, Fructose, Urine appearance/PH… Filter
`Parameters.csv` for `resultType=coded`. Options to fill: (a) lab director supplies lists, (b) inspect the
result‑entry screen of an existing patient report (`/Labs.aspx`) — read‑only browsing only, avoid patient data
exposure, (c) standard sets (Positive/Negative etc.) after clinical sign‑off. Note that even after the lists
are known, Vexel's dropdown is currently broken (§11.2), and the way lists are saved is inconsistent (§11.2).

### K. 18 tests have no sample type — not a blocker
Legacy specimen was `---Not-Defined---` (e.g. Cross Match & Screening, PT with INR (12282), Typhidot,
Clotting Time, Bleeding Time, HCV Genotyping, ECG, …). Left blank on purpose. **Decision (owner, 2026-09-20):**
sample types can be looked up later (e.g. simple web search / standard references) and completed after go‑live
prep; they do not block the import.

### L. 24 legacy TESTS have no result fields at all
To be precise: these are **tests in the old system** that have no parameters configured (not parameters
without values). All 24 are priced and active. They import as Tests with no mappings. By kind (best reading of the
names — confirm with the lab):
- **Choice‑type results (Positive/Negative etc.):** COOMBS TEST (INDIRECT), COOMBS TEST DIRECT, MALARIAL PARASITE (THICK & THIN) x2,
  ANTI HEV IgG, ANTI HDV IgG, ANTI HDV IgM, Salmonella Typhi Antigen (Stool).
- **PCR / molecular results:** HBV DNA By PCR, HCV by PCR, HCV GENOTYPING, MTB BY PCR.
- **Paragraph / narrative reports:** BIOPSY SLIDE FOR REVIEW, ECG.
- **Numeric results:** BASOPHIL COUNT x2, ABSOLUTE NEUTROPHIL COUNT, BILE PIGMENT (URINE), BILE SALT (URINE), CHOLESTROL (FLUID),
  CREATININE (FLUID), L.D.H (FLUID), DHEA SO4, URINE SUGAR.
Most of these need the result types in §11.1 (choice, paragraph). Source list:
`docs/migration/legacy_lims_mapping/legacy_mapping_extraction_status.csv` (`NO_PARAMETERS_RETURNED`).
Related idea (owner): a *parameter* with no value can be used as a **section heading** inside a multi‑parameter
report (e.g. "Differential Count"). In the legacy data a row such as "DLC" in Peripheral Blood Film (Text type, range `-`,
no unit) looks like exactly that. Vexel has no heading rows today (§11.1). The list of such heading‑like rows in
`legacy_test_parameter_mapping.csv` has not yet been compiled.

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
2. **Do not import the 208 blank/`MANUAL_REVIEW` range rows yet** (§7‑I): until Vexel can store reference text (§11.1 Step 1), either import everything *except* those rows into a dev tenant purely to test the pipeline, or wait for Step 1. Never import them as empty rows.
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
`externalId` regexes; no duplicate `(testExternalId,parameterExternalId)`; no `ReferenceRanges` row with both bounds empty **unless** Vexel can store reference text for it (see §7‑I, §11.1).

---

## 10. Suggested next steps (in order)

1. **§11 first (platform work):** build Step 1 of §11.1 (reference text on ranges) and fix the wiring bugs in §11.2, so the catalogue can be loaded *completely* (nothing dropped). Verify §11.2 findings by actually running the app — they come from reading code only.
2. **§7‑N**: capture legacy Active/Disabled status; set `isActive`.
3. **§7‑M**: resolve the 2 duplicate MCV rows; renumber `displayOrder`; review `text` parameters that should be numeric (HCT).
4. **§7‑K/J/L**: fill sample types, coded option lists, and zero‑parameter tests with lab staff.
5. **§7‑I / §11.1 Step 2:** load the 208 ranges as reference text, then convert to structured bands with the lab director.
6. **§8‑O/P/Q**: investigate Custom tests (34 priced), decide on zero‑price tests, extract Packages → Panels.
7. **§8‑R/S**: turnaround times, print templates.
8. Real import + round‑trip export diff + UI spot checks; clinical sign‑off; tag release notes (`docs/catalog/build/v2/release-notes/`, mirroring v1).

---

## 11. Vexel platform capability gaps (audit of 2026-09-20)

**Why this section exists.** The goal is a complete basic LIMS catalogue. The owner pointed out that the
legacy normal ranges, and result types such as choice / pre‑filled / one‑word / paragraph / number, are mandatory
parts of any good LIMS. Two read‑only code audits (backend + frontend) checked what Vexel does today.
**Caveat: these are findings from reading the code, not from running the app. Anything marked "suspected"
must be confirmed by running it before fixing.** Repo paths below are relative to the repo root.

### 11.1 Features Vexel does not have (must be built) — in priority order

**Step 1 — quick win that lets the whole catalogue load with nothing lost**
1. **Free‑text reference text on `ReferenceRange`** (new column, e.g. `referenceText`). Store the legacy wording exactly
   (`Negative`, `Adult: 25 - 40, Child: 45- 70`, the Beta‑HCG table…). Show it on the result screen and print it on the
   report. Also make the catalog import read the sheet's `notes`/new column (today the `notes` column is silently dropped:
   `apps/api/src/catalog/catalog-import-export.service.ts`, `_importReferenceRange`, ~l.912‑1010) and stop creating
   empty range rows.
2. **Paragraph (long text) result type**: new `resultType` (e.g. `paragraph`), a multi‑line `<textarea>` on the operator
   result screens, admin editor support, and multi‑line rendering in the PDF. Needed for biopsy/ECG‑style reports.
3. **Heading rows inside a multi‑parameter test**: a way to mark a test‑parameter row as a heading/group label
   (e.g. `rowType = heading` on `TestParameterMapping` or a flag on `Parameter`), skipped by result entry and value
   validation, rendered as a bold sub‑title in the printed report. Today the only workaround is a fake parameter, which
   shows a useless input box and a blank row.
4. **Date, and possibly formula/calculated, result types** (legacy has Date and Formula types; Date currently maps to `text`;
   Formula maps to `numeric` and is not calculated).

**Step 2 — proper structured ranges (so flags work for the 208 too)**
5. **Expected‑text results**: for words‑only ranges (`Negative`), mark which value is normal; anything else flags abnormal.
6. **Named result bands**: e.g. Negative `<0.9` / Borderline `0.9‑1.2` / Positive `>1.2`, each mapping to a flag
   (`normal`/`borderline`/`positive`). Today a range row holds only one low/high pair.
7. **Age in days/months/weeks** (today only whole years: `ageMinYears`/`ageMaxYears` integers; matching uses
   `Math.floor(years)` in `apps/api/src/results/results.service.ts` ~l.73‑75, so a 3‑day‑old and an 11‑month‑old are the same).
   Also fix `ageMinYears = 0` being stored as null by the importer (0 is treated as empty).
8. **Pregnancy / trimester / gestational‑week / menstrual‑phase / menopausal‑status** qualifiers (and `gender` beyond `M`/`F`).
9. **Inclusive vs exclusive bounds** (`≤`/`≥` currently collapse to `<`/`>`), **negative bounds** in flag logic.
10. **Critical/panic values actually used**: `criticalLow`/`criticalHigh` exist in the DB and import but are never evaluated;
    the `critical` flag is never produced; no panic alert.
11. **Structured range on the printed report** (the PDF renderer treats the range as one opaque string), so band/age tables
    can be printed properly instead of being squeezed into one `low-high` string.
12. **Specimen/method‑specific ranges** and a **per‑parameter comment/interpretation field** (the `NARRATIVE_SECTION` PDF block
    reads a top‑level `interpretation` field that nothing populates).

### 11.2 Features that exist but appear broken or unwired (suspected — verify by running the app)
1. **Type‑name mismatch.** API sends `dataType = parameter.resultType` with values `numeric|text|boolean|enum`
   (`results.service.ts` ~l.269), but the operator UI branches on `'number'` and `'select'`
   (`apps/operator/src/app/(protected)/lims/results/[orderedTestId]/page.tsx` ~l.46, 398, 431 and
   `results/encounters/[encounterId]/page.tsx` ~l.503‑534). Effect: numeric params render as plain text, enum params never
   become dropdowns, live auto‑flag never fires. Only `boolean` matches. The OpenAPI contract also lists two different
   vocabularies (`dataType`: numeric/text/boolean/coded; `resultType`: numeric/text/boolean/enum).
2. **Choice‑list storage format is inconsistent.** DB column `Parameter.allowedValues` is a `String`; contract says array;
   admin form posts an array (comma‑split); operator UI needs `Array.isArray`; import stores the raw cell string with no
   defined delimiter. The admin save likely fails against the `String?` column. **Decide one format** (e.g. JSON array or
   pipe‑delimited) and use it everywhere, including the workbook column `allowedValues`.
3. **Default value never reaches the result screen.** UI pre‑fills `p.defaultValue`, but the `GET /results/tests/{orderedTestId}`
   response does not include it (`results.service.ts` ~l.256‑278), so nothing is pre‑filled. (Also: defaults are per parameter,
   not per test.)
4. **No server‑side validation of result values.** `saveResults` accepts any string for any type; `decimals` is never applied;
   `TestParameterMapping.isRequired` is never enforced (`results.controller.ts` l.52‑64; `results.service.ts` l.303‑404).
5. **Critical flag never produced; flag logic fragile.** `computeFlag()` (`results.service.ts` l.6‑24) only yields
   low/high/normal, re‑parses the range *string* with a regex that cannot read negative numbers, and returns null for
   non‑numeric values. The operator‑side flag override is not sent to the backend.
6. **Range picking may prefer the wrong row.** `resolveReferenceRanges` orders `testId desc`; in Postgres nulls sort first on
   `desc`, so parameter‑global rows may beat test‑scoped rows. First match wins; no "most specific" scoring. Also, once a range
   is stored on a result it is never re‑resolved.
7. **Admin reference‑range form sends fields the DB does not have** (`normalText`, `interpretation`, `isActive`), so saving
   expression‑type ranges probably fails (`apps/admin/src/app/(protected)/catalog/reference-ranges/page.tsx`;
   `catalog.service.ts` `createReferenceRange` spreads the body into Prisma).
8. **Printed report quirks:** empty flag prints "Normal" even for text/choice parameters; the block‑template table prints the raw
   flag string uncoloured; long text wraps in a narrow cell (`apps/pdf/Program.cs`).
9. **Legacy per‑encounter result path** (`EncountersService.enterResult`, `encounters.service.ts` ~l.392‑430) accepts arbitrary
   value/unit/range/flag with no validation.

### 11.3 What already works (do not rebuild)
- Gender (`M`/`F`) + whole‑year age‑band ranges, test‑scoped or parameter‑global, one‑sided ranges (`<N`, `>N`) — schema, admin
  form and import support them.
- Boolean (Yes/No) inputs; single‑line text input; numeric range flagging low/high/normal on the backend for plain numeric ranges.
- Admin fields for `defaultValue`, `defaultUnit`, `decimals`, comma‑separated `allowedValues`; catalog Import/Export screen
  (upload `.xlsx`, Validate, then Apply); template studio blocks `SECTION_TITLE` and `NARRATIVE_SECTION` (layout only,
  not tied to test data).

### 11.4 Suggested build order (needs owner approval before any code is changed)
1. Verify §11.2 by running the app (operator result entry for a numeric, an enum and a boolean parameter; admin save of a
   parameter with allowed values; a range with critical limits).
2. Fix §11.2 items 1‑4 (type names, allowed‑values format, default value delivery, server validation).
3. Build §11.1 Step 1 (reference text, paragraph type, heading rows, date type) — including the importer changes, workbook
   columns and PDF rendering.
4. Re‑generate the v2 workbook: put the 208 legacy range texts into the new reference‑text column, mark heading rows,
   set paragraph/choice types on the 24 empty tests as agreed with the lab, fill choice lists. Re‑run validation (§9.4).
5. Dry‑run import (`validate=true`) into a dev tenant, then real import, then round‑trip export diff.
6. Build §11.1 Step 2 (structured bands, age in days, pregnancy/cycle conditions, critical values, structured printing) and convert
   the reference texts to structured ranges with the lab director.
