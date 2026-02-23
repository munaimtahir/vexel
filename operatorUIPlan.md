# Vexel LIMS — Operator UI Full Build Plan
> **Purpose:** Session-resilient plan. If session is interrupted, share this file. The agent should read it, check what's done vs pending, and continue from where we left off.
> **Last updated:** After schema migration applied and Wave 1 complete.

---

## Current Production State
- **Live URL:** https://vexel.alshifalab.pk
- **Repo:** `git@github.com:munaimtahir/vexel.git`
- **HEAD (as of last session):** `fa7d398` on `main`
- **Stack:** 8 Docker services healthy (postgres:5433, redis:6380, api:9021, pdf:9022, admin:9023, operator:9024, minio:9025, worker)
- **Tests:** 36/36 unit tests passing

## What Has Been Done in This Plan (Wave 1 — COMPLETE)

### ✅ Schema changes applied (`migration 20260223000002_workflow_schema_v2`)
All Prisma schema changes written and migrated via `migrate deploy`. Prisma client regenerated.

**Patient model** — added fields:
- `mobile String?` + index on `(tenantId, mobile)`
- `cnic String?`
- `address String?`
- `ageYears Int?`

**Encounter model** — added:
- `encounterCode String?` — LIMS Order ID, unique per tenant, server-generated format: `[prefix]L-[YYMM]-[seq]`
- `specimenItems SpecimenItem[]` relation
- Status comment updated to include `partial_resulted`

**CatalogTest model** — added:
- `specimenType String?` — exact specimen type string e.g. `"EDTA Blood"`, `"Urine"` (used for grouping specimen items)
- `price Decimal?` — price in PKR for receipt/payment section

**LabOrder model** — added:
- `resultStatus String @default("PENDING")` — `PENDING | SUBMITTED`
- `submittedAt DateTime?`
- `submittedById String?`
- `testNameSnapshot String?` — snapshot of test name at order time
- `results LabResult[]` relation (one-to-many now, was one-to-one)
- Index on `(tenantId, resultStatus)`

**LabResult model** — restructured (BREAKING — per-parameter now):
- Dropped `@unique` on `labOrderId` (was one result per order, now many per order = one per parameter)
- Dropped `resultedAt`, `resultedBy` columns
- Added `parameterId String?` — links to catalog parameter
- Added `parameterNameSnapshot String?`
- Added `locked Boolean @default(false)` — true once test submitted with a value
- Added `enteredAt DateTime @default(now())`
- Added `enteredById String?`
- Added index on `(tenantId, labOrderId)`

**SpecimenItem model** — NEW:
- One row per unique `catalogSpecimenType` per encounter
- Auto-created when lab order is placed (grouping by specimen type)
- Fields: `id, tenantId, encounterId, catalogSpecimenType, status (PENDING|COLLECTED|POSTPONED|RECEIVED), barcode?, collectedAt, collectedById, postponedAt, postponedById, postponeReason, receivedAt, receivedById`
- Unique: `(tenantId, encounterId, catalogSpecimenType)`

**TenantConfig model** — added:
- `registrationPrefix String?` — 2-3 letters e.g. `"VX"` for MRN generation
- `orderPrefix String?` — 2-3 letters for Order ID generation

---

## What Still Needs to Be Done

### WAVE 2 — OpenAPI + SDK (in_progress, partially started)

**File:** `packages/contracts/openapi.yaml`
**After editing:** run `pnpm sdk:generate` (or `cd packages/contracts && node generate.js`)

#### Endpoints to add:

**Results (test-level):**
```
GET  /results/tests/pending        → list LabOrders where resultStatus=PENDING + sample collected/received
GET  /results/tests/submitted      → list LabOrders where resultStatus=SUBMITTED
GET  /results/tests/{orderedTestId} → detail: test info + all parameter schemas + current values + lock state
POST /results/tests/{orderedTestId}:save           → body: {values:[{parameterId,value}]} — save draft
POST /results/tests/{orderedTestId}:submit         → body: {} — set resultStatus=SUBMITTED, lock non-empty
POST /results/tests/{orderedTestId}:submit-and-verify → submit + verify + enqueue publish (needs verify permission)
```

**Verification (encounter/patient-level):**
```
GET  /verification/encounters/pending              → encounters with ≥1 LabOrder submitted + not yet verified
GET  /verification/encounters/{encounterId}        → encounter detail with submitted test cards + ONLY filled params
POST /verification/encounters/{encounterId}:verify → verify all submitted tests → trigger publish pipeline
```

**Sample Collection:**
```
GET  /sample-collection/worklist                   → encounters with pending specimen items (last 3 days default)
POST /encounters/{id}:collect-specimens            → body: {specimenItemIds:[]} — batch collect
POST /encounters/{id}:postpone-specimen            → body: {specimenItemId, reason (required, min 3 chars)}
POST /encounters/{id}:receive-specimens            → body: {specimenItemIds:[]} — batch receive (feature-flagged)
```

**Patient search:**
```
GET /patients?mobile=xxx   → add mobile query param to existing patients endpoint
```

Also update response schemas:
- `EncounterResponse`: add `encounterCode` field
- `LabOrderResponse`: add `resultStatus`, `submittedAt`, `testNameSnapshot`
- `PatientResponse`: add `mobile`, `cnic`, `address`, `ageYears`

---

### WAVE 3 — Backend Services (NestJS)

**Constraints (do not break these):**
- All state changes via Command endpoints only — no direct DB mutation from controllers
- Every command writes `AuditEvent` with `correlationId`
- Every query includes `tenantId` filter — no cross-tenant reads
- No Prisma imports in Next.js apps ever

#### b6 — ResultsModule (`apps/api/src/results/`)

Service methods:
- `getOrderedTestDetail(tenantId, orderedTestId)` — return LabOrder + parameter schemas (from catalog mapping) + current LabResult rows + computed lock per parameter
- `getPendingTests(tenantId)` — LabOrders where `resultStatus=PENDING` AND encounter specimen collected
- `getSubmittedTests(tenantId)` — LabOrders where `resultStatus=SUBMITTED`
- `saveResults(tenantId, actorId, orderedTestId, values[])` — upsert LabResult rows, do NOT change resultStatus, write `TEST_RESULTS_SAVE` AuditEvent
- `submitResults(tenantId, actorId, orderedTestId)` — set `resultStatus=SUBMITTED`, lock all non-empty LabResults, advance encounter status (`partial_resulted` if some tests remain, `resulted` if all submitted), write `TEST_RESULTS_SUBMIT` AuditEvent
- `submitAndVerify(tenantId, actorId, orderedTestId)` — idempotent submit + verify + enqueue doc pipeline, requires `result.verify` permission, write both `TEST_RESULTS_SUBMIT` + `TEST_RESULTS_VERIFY` AuditEvents

**Lock rule (hard):**
- If `resultStatus = SUBMITTED` AND parameter has non-empty value → `locked = true`
- If `resultStatus = SUBMITTED` AND parameter empty → `locked = false` (late entry allowed)
- If `resultStatus = PENDING` → all unlocked

**Encounter status auto-advance after submit:**
- Count LabOrders for encounter: if ALL `resultStatus=SUBMITTED` → set encounter `status=resulted`
- If some submitted but not all → set encounter `status=partial_resulted`
- These are the ONLY status changes needed from results submission

**H/L Flag computation:**
- Parse reference range (e.g. `"3.5-5.0"` or `">10"`)
- Compare numeric value → set `flag`: `normal | high | low | critical`
- Operator can override flag manually

#### b7 — VerificationModule (`apps/api/src/verification/`)

Service methods:
- `getPendingEncounters(tenantId)` — encounters where status = `resulted | partial_resulted` AND at least one LabOrder submitted and not verified. Include patient identity + submitted test count.
- `getEncounterDetail(tenantId, encounterId)` — return submitted LabOrders with ONLY filled parameter values (omit any LabResult where value is empty/null). Include patient identity.
- `verifyEncounter(tenantId, actorId, encounterId)` — verify all submitted LabOrders (set `labOrder.status=verified`, set `labResult.verifiedAt/By`), advance encounter to `verified`, enqueue deterministic document job, write `ENCOUNTER_VERIFIED` AuditEvent with correlationId

**Important:** verification payload for document = only filled parameters, aggregated across all submitted tests for the encounter.

#### b8 — SampleCollectionModule (`apps/api/src/sample-collection/`)

Service methods:
- `getWorklist(tenantId, filters)` — encounters with pending SpecimenItems, default last 3 days
- `collectSpecimens(tenantId, actorId, encounterId, specimenItemIds[])` — batch set `status=COLLECTED`, set `collectedAt/By`, write `SPECIMEN_COLLECTED` AuditEvent, advance encounter status to `specimen_collected`
- `postponeSpecimen(tenantId, actorId, encounterId, specimenItemId, reason)` — set `status=POSTPONED`, reason required (min 3 chars), write `SPECIMEN_POSTPONED` AuditEvent
- `receiveSpecimens(tenantId, actorId, encounterId, specimenItemIds[])` — batch set `status=RECEIVED`, write `SPECIMEN_RECEIVED` AuditEvent (feature-flagged: `lims.operator.sample.receiveSeparate.enabled`)

**Auto-create SpecimenItems on orderLab:**
In `EncountersService.orderLab()` — after creating LabOrder rows, for each unique `CatalogTest.specimenType` in the order, upsert a SpecimenItem row (ignore if already exists for that type).

#### b9 — Patient Registration Enhancements

- Add `mobile` search to existing `GET /patients` endpoint
- Add `registrationCode` (MRN) generation: `[prefix]-[YY]-[SEQPADDED4]` e.g. `VX-26-0001`
  - Prefix from `TenantConfig.registrationPrefix`, default `"PT"`
  - Sequence: count existing patients for tenant in that year + 1
- Add `encounterCode` generation on `EncountersService.orderLab()`: `[prefix]L-[YYMM]-[SEQ3]` e.g. `VXL-2602-001`
  - Sequence resets monthly; count LabOrders for tenant in that month + 1

#### b10 — Feature Flags

Add to feature-flag registry defaults:
```typescript
{ key: 'lims.verification.enabled', defaultValue: true, type: 'boolean', description: '...' }
{ key: 'lims.verification.mode', defaultValue: { mode: 'separate' }, type: 'variant', description: '...' }
{ key: 'lims.operator.verificationPages.enabled', defaultValue: true, type: 'boolean', description: '...' }
{ key: 'lims.operator.sample.receiveSeparate.enabled', defaultValue: false, type: 'boolean', description: '...' }
```

---

### WAVE 4 — Operator UI (Next.js)

**Constraints:**
- SDK-only — no direct fetch/axios
- `getApiClient(getToken() ?? undefined)` pattern
- All pages under `apps/operator/src/app/(protected)/`

#### u1 — Registration Page (`/registrations/new`)

**File:** `apps/operator/src/app/(protected)/registrations/new/page.tsx`

**Layout (3 sections):**
```
┌─────────────────────────────────────────────────────┐
│  PATIENT REGISTRATION FORM (top, full width)        │
│  Mobile search → auto-fill → reuse or create MRN    │
└────────────────────────┬────────────────────────────┘
│  ORDER SECTION          │  PAYMENT SECTION           │
│  (bottom-left)          │  (bottom-right)            │
│  Test search            │  Total (auto)              │
│  Test list              │  Discount (PKR ↔ %)        │
│  + Remove               │  Paid (default=total)      │
│                         │  Due (auto)                │
└────────────────────────┴────────────────────────────┘
                [ Save & Print Receipt ]
```

**Registration form fields:**
- Mobile* (first field) — on blur: call `GET /patients?mobile=xxx`, auto-fill if found
- Full Name* (split into firstName + lastName internally)
- Age (integer) ↔ DOB (linked: entering one computes the other approximately)
- Gender* (select: Male/Female/Other)
- CNIC (optional)
- Address (optional)
- MRN: shown as read-only after save, or "(auto-generated)" before save

**Order section:**
- Catalog test search: real-time search by name/code as user types
- Keyboard: arrow keys to navigate suggestions, Enter to add, click to add
- Shows list of added tests with test name + price + remove button
- If test has no price → show PKR 0

**Payment section:**
- Total = sum of prices (auto-computed)
- Discount field: PKR amount field + "%" toggle that syncs (enter 10% → computes PKR amount and vice versa)
- Paid = default to Total − Discount (editable by operator)
- Due = Total − Discount − Paid (auto, read-only, red if > 0)

**Save & Print Receipt:**
- POST to create encounter (registers patient + creates lab order in one flow or two calls)
- On success: open receipt PDF in new tab
- Receipt format picker (before or after save):
  - **A4**: top 49% patient copy + 2% tear line + bottom 48% office copy, with tenant header/footer
  - **Thermal 80mm**: patient block → tests block → payment block, tenant header/footer
- After save + print: page resets for next patient (clear form, keep tenant context)

**Existing registration page location:** `apps/operator/src/app/(protected)/registrations/new/page.tsx` — needs complete redesign

#### u2 — Sample Collection Page (`/sample-collection`)

**File:** `apps/operator/src/app/(protected)/sample-collection/page.tsx`

**Route:** `/sample-collection` (new top-level route, replaces old `/encounters/[id]/sample`)

**Layout:**
- Header: "Sample Collection"
- Filters: date range picker (default: last 3 days)
- Status tabs: **Pending** | **Postponed** | **Pending Receive** *(only if `lims.operator.sample.receiveSeparate.enabled` = true)*
- Search: MRN / Patient Name / Order ID
- Table columns: Time | Patient (MRN, Name, Age/Sex) | Order ID | Tests summary | Specimen items badge
- **Expandable rows**: click row → expands to show per-SpecimenItem sub-rows:
  - Specimen type label (e.g. "EDTA Blood", "Urine")
  - Status badge (PENDING / COLLECTED / POSTPONED / RECEIVED)
  - Buttons: **Collect** | **Postpone**
  - If `receiveSeparate` flag on: **Receive** button for COLLECTED items
- **Batch action**: "Collect all pending" button on expanded row header — collects all PENDING items for that encounter at once
- **Postpone modal**: opens on Postpone click
  - Shows specimen type
  - Reason field (required, min 3 chars, shows error if shorter)
  - Confirm / Cancel buttons
- **Queue exit**: encounter row disappears from Pending tab when all SpecimenItems are no longer PENDING
- After collecting all specimens → encounter status becomes `specimen_collected`

#### u3 — Results Worklist (`/results`)

**File:** `apps/operator/src/app/(protected)/results/page.tsx`

**Layout:**
- Header: "Results"
- Tabs: **Pending tests** (default) | **Submitted tests**
- Search: MRN / Patient / Order ID / Test name
- Table columns: Time | Patient (MRN, Name, Age/Sex) | Order ID | Test name | Status badge | Action
  - Pending tab: action = "Enter results" → navigates to `/results/[orderedTestId]`
  - Submitted tab: action = "View / Add missing" → navigates to `/results/[orderedTestId]`
- **One row per test** (not per encounter). An encounter with 3 tests = 3 rows. This is intentional.
- Pending tab: shows only LabOrders where `resultStatus=PENDING`
- Submitted tab: shows only LabOrders where `resultStatus=SUBMITTED`
- No "incomplete" labels anywhere — ever

#### u4 — Results Entry Page (`/results/[orderedTestId]`)

**File:** `apps/operator/src/app/(protected)/results/[orderedTestId]/page.tsx`

**Sticky header:**
- Patient identity: MRN, Name, Age/Sex
- Order ID / Encounter code
- Test name (VERY prominent — largest text)
- Sample status badge (must be COLLECTED or RECEIVED to allow entry)
- Test status badge: **Pending** or **Submitted**
- Buttons: Back to Results | Go to Sample Collection (if blocked by sample)

**Sticky footer buttons:**
- **Save** — always visible
- **Submit** — always visible (when `mode=separate` or `mode=inline`)
- **Submit & Verify** — conditional:
  - Show if `mode=disabled` OR `mode=inline` AND user has `result.verify` permission
  - Hide if `mode=separate`
  - If `mode=disabled`: hide Submit-only button, show only "Submit & Verify"

**Main parameter table:**
Columns: Parameter name | Input field | Unit | Reference range | H/L flag (display)

**Input types by parameter dataType:**
- `number` → numeric input
- `text` → text input
- `select` → dropdown from `allowedValues`
- `boolean` → toggle or Yes/No select

**Lock rules:**
- `resultStatus=PENDING` → ALL inputs editable
- `resultStatus=SUBMITTED`:
  - Value is non-empty → input READ-ONLY (locked=true)
  - Value is empty → input EDITABLE (late entry allowed)
- After saving a late-entry value on a SUBMITTED test → that value becomes locked on next refresh

**Sample gate:**
- If specimen NOT in COLLECTED or RECEIVED state → disable ALL inputs, disable Save/Submit
- Show message: "Collect sample first" with link to `/sample-collection`

**Save action:**
- Call SDK `POST /results/tests/{orderedTestId}:save` with changed values
- After save: refresh `GET /results/tests/{orderedTestId}` to recompute locks

**Submit action:**
- Call SDK `POST /results/tests/{orderedTestId}:submit`
- After submit: refresh → all non-empty locked → empty still editable
- Then navigate to: next pending test for same patient (if any) → else back to results worklist
- Show "Submit All" option: bulk-submit all remaining pending tests for this patient

**Submit & Verify action:**
- Call SDK `POST /results/tests/{orderedTestId}:submit-and-verify`
- Show status: "Verifying…" → "Verified. Publishing report…"
- Poll `GET /documents?sourceType=ENCOUNTER&sourceRef={encounterId}` until `status=PUBLISHED`
- Show "Download PDF" / "Open PDF" button
- Then navigate: next pending test for same patient → else next patient in worklist

**H/L display flag:**
- Auto-computed from reference range vs value (backend computes, returned in GET response)
- Operator can override: clickable H/L badge to toggle override

**No "incomplete" UI anywhere. Missing values = blank fields. No warnings.**

#### u5 — Verification Pages

**File 1:** `apps/operator/src/app/(protected)/verification/page.tsx` — Worklist

Layout:
- Header: "Verification"
- Filter: Pending (default) | Verified today
- Table: Time | Patient (MRN, Name, Age/Sex) | Order ID | Submitted tests count | Action: "Verify patient"
- One row per encounter (not per test)
- Click → navigate to `/verification/encounters/[encounterId]`

**File 2:** `apps/operator/src/app/(protected)/verification/encounters/[encounterId]/page.tsx` — Patient verification

Layout:
```
┌──────────────────────────────────────────────────────────────┐
│ STICKY HEADER: Patient name, MRN, Age/Sex, Order ID          │
│ "Submitted tests: X | Pending verification: Y"               │
│ [Back] [Load all tests toggle] [Next patient / Skip]         │
├──────────────┬───────────────────────────────────────────────┤
│ LEFT SIDEBAR │ MAIN SCROLL AREA                              │
│ Test nav:    │                                               │
│ • CBC   ✓    │ ┌─ TEST CARD: CBC ──────────────────────────┐ │
│ • Urine ⏳   │ │ Submitted: 2h ago by John                 │ │
│ • RBS   ⏳   │ │ Status: Pending Verification               │ │
│              │ │ Parameter | Result | Unit | Ref range | H/L│ │
│              │ │ Haemoglobin | 13.2 | g/dL | 12-16 | N     │ │
│              │ │ (only FILLED params shown)                 │ │
│              │ └───────────────────────────────────────────┘ │
│              │                                               │
│              │ ┌─ TEST CARD: Urine ────────────────────────┐ │
│              │ │ ... (only filled params)                  │ │
│              │ └───────────────────────────────────────────┘ │
├──────────────┴───────────────────────────────────────────────┤
│ STICKY FOOTER: [Skip patient]  [✅ Verify patient (all)]     │
└──────────────────────────────────────────────────────────────┘
```

**Load all tests toggle:**
- ON (default): all test cards stacked in main area
- OFF: only the selected test (from sidebar) shown

**Verify patient action (Mode 1 only — MVP):**
- Call SDK `POST /verification/encounters/{encounterId}:verify`
- Show: "Verified. Publishing report…"
- Poll documents until `status=PUBLISHED`
- Show "Download PDF" + "Open PDF"
- Auto-advance: "Next patient" button with 3-second countdown auto-click
- If no more pending patients: "No more pending patients." screen

**Skip patient:**
- Removes from current in-memory queue, navigate to next encounter
- Does NOT change any status (encounter stays in worklist)

**Empty parameter rule:** NEVER show empty parameters in verification view. Only LabResults with non-empty value appear.

**Feature flag gating:**
- If `lims.verification.enabled=false` OR `lims.verification.mode.mode=disabled`:
  - Hide entire Verification section from sidebar navigation
  - If user navigates directly → show "Verification is disabled for this tenant"

#### u6 — Sidebar Navigation

**File:** `apps/operator/src/components/sidebar.tsx`

Add navigation items:
- Sample Collection → `/sample-collection` (icon: test tube or flask)
- Results → `/results` (icon: clipboard)
- Verification → `/verification` (icon: checkmark shield) — **hidden if verification disabled via feature flag**

Remove/retire:
- Old `/encounters/[id]/sample` route can remain for compat but should NOT be linked in nav

**Feature flag check in sidebar:** call `GET /feature-flags` once on load, store in context. Use `lims.verification.enabled` + `lims.verification.mode` to gate Verification nav item.

---

### WAVE 5 — Admin UI

#### a1 — Verification Feature Flags in Admin

**File:** Find existing tenant feature-flags page in `apps/admin/` — likely `apps/admin/src/app/(protected)/tenants/[tenantId]/feature-flags/page.tsx`

Add "Verification" section:
- **Toggle:** Verification enabled (`lims.verification.enabled`)
- **Dropdown:** Verification mode (`lims.verification.mode` → `{mode: "separate" | "inline" | "disabled"}`)
  - Separate: standard two-step verify worklist
  - Inline: show Submit & Verify button on results entry
  - Disabled: no verification step, results entry shows Submit & Verify only
- **Toggle:** Show verification pages (`lims.operator.verificationPages.enabled`)
- Info note when mode=disabled: "Operator will verify from results entry. Verification worklist will be hidden."

Each change → `PUT /feature-flags/{key}` via SDK → writes AuditEvent.

---

## Execution Order (strict — follow this)

```
WAVE 1 ✅ Schema — COMPLETE
  s1 ✅ Patient model (mobile, cnic, address, ageYears)
  s2 ✅ CatalogTest model (specimenType, price)
  s3 ✅ LabOrder model (resultStatus, submittedAt, testNameSnapshot)
  s4 ✅ LabResult model (per-parameter, drop unique, add locked)
  s5 ✅ SpecimenItem model (new)
  s6 ✅ Encounter model (encounterCode, partial_resulted)
  s7 ✅ TenantConfig model (registrationPrefix, orderPrefix)
  s8 ✅ Migration written + applied + prisma generate done

WAVE 2 — OpenAPI + SDK (partially started)
  b1 → Add results endpoints to openapi.yaml
  b2 → Add verification endpoints to openapi.yaml
  b3 → Add sample-collection endpoints to openapi.yaml
  b4 → Add mobile search param to patients endpoint
  b5 → pnpm sdk:generate (after all OpenAPI edits done)

WAVE 3 — Backend (after SDK generated)
  b6 → ResultsModule (save/submit/submit-and-verify, lock rules, H/L, encounter status advance)
  b7 → VerificationModule (pending encounters, encounter detail, verify-all + publish)
  b8 → SampleCollectionModule (worklist, collect, postpone, receive, auto-create specimen items)
  b9 → Patient registration enhancements (MRN gen, encounterCode gen, mobile search)
  b10 → Feature flags (add 4 new flags to registry)

WAVE 4 — Operator UI (after SDK types available)
  u6 → Sidebar nav (needs feature flags and new routes to exist — do early for structure)
  u1 → Registration page (/registrations/new redesign)
  u2 → Sample collection page (/sample-collection)
  u3 → Results worklist (/results)
  u4 → Results entry page (/results/[orderedTestId])
  u5 → Verification pages (/verification + /verification/encounters/[id])

WAVE 5 — Admin UI
  a1 → Verification flags section

FINAL — Build + Deploy
  → docker compose build --no-cache api worker && docker compose up -d api worker
  → docker compose build --no-cache operator admin && docker compose up -d operator admin
  → Smoke test all new pages
```

---

## Technical Constraints (Never Break These)

| Rule | Detail |
|------|--------|
| Contract-first | All endpoints added to `packages/contracts/openapi.yaml` BEFORE backend implementation |
| SDK-only frontend | No direct `fetch()` or `axios()` in any Next.js app. Use `getApiClient()` from `apps/operator/src/lib/api-client.ts` |
| Command-only state changes | No direct DB status mutations from controllers. Use service methods that enforce valid transitions. |
| Tenant isolation | Every query includes `tenantId` filter. No cross-tenant reads ever. |
| Audit events | Every command writes `AuditEvent` with `correlationId`, `tenantId`, `actorUserId`, `action`, entity refs |
| migrate deploy | Use `migrate deploy` (NOT `migrate dev`) for all migrations. Shadow DB is broken on this server. Write raw SQL manually. |
| NEXT_PUBLIC_API_URL | Must be set as Docker build arg (baked at build time). Not runtime env. |
| LabResult is now per-parameter | Old code that assumed `result: LabResult?` (singular) on LabOrder must be updated to `results: LabResult[]` |
| SpecimenItem auto-create | Must happen inside `EncountersService.orderLab()` — group by `CatalogTest.specimenType`, upsert one item per unique type per encounter |
| Empty params = never shown | In verification view and publish payload: ONLY parameters with non-empty values. No empty rows. No "incomplete" labels. |

---

## Database Connection
```
postgresql://vexel:vexel@127.0.0.1:5433/vexel
```

## Key File Paths
| What | Path |
|------|------|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| Migrations | `apps/api/prisma/migrations/` |
| OpenAPI contract | `packages/contracts/openapi.yaml` |
| SDK (generated) | `packages/sdk/` |
| API main module | `apps/api/src/app.module.ts` |
| Encounters service | `apps/api/src/encounters/encounters.service.ts` |
| Feature flags module | `apps/api/src/feature-flags/` |
| Operator API client | `apps/operator/src/lib/api-client.ts` |
| Operator sidebar | `apps/operator/src/components/sidebar.tsx` |
| Operator pages root | `apps/operator/src/app/(protected)/` |
| Admin pages root | `apps/admin/src/app/(protected)/` |

## How to Verify Current State
```bash
# Check which migration was last applied
cd /home/munaim/srv/apps/vexel/apps/api
DATABASE_URL="postgresql://vexel:vexel@127.0.0.1:5433/vexel" npx prisma migrate status

# Check stack health
curl http://127.0.0.1:9021/api/health

# Run unit tests
cd /home/munaim/srv/apps/vexel && pnpm --filter @vexel/api test --passWithNoTests 2>&1 | tail -10

# Check git log
git -C /home/munaim/srv/apps/vexel log --oneline -5
```

## How to Resume After Interruption
1. Read this file top to bottom
2. Run the verification commands above to confirm actual state
3. Check `git log --oneline -5` to see what was committed
4. Find the first todo in the execution order that is NOT done
5. Continue from there

---

## Specimen Grouping Rule (Critical for Sample Collection)
Two tests ordered on the same encounter:
- CBC (specimenType = "EDTA Blood") → creates SpecimenItem for "EDTA Blood"
- ESR (specimenType = "EDTA Blood") → reuses the same SpecimenItem (upsert, no duplicate)
- LFTs (specimenType = "Clot Blood") → creates a SECOND SpecimenItem for "Clot Blood"
- Urinalysis (specimenType = "Urine") → creates a THIRD SpecimenItem for "Urine"

Result: 3 SpecimenItems for that encounter, even though 4 tests were ordered.
The CBC and ESR share one EDTA Blood tube.

## Order Immutability Rule
Once an encounter reaches `lab_ordered` status:
- Clinical data (tests ordered) is immutable
- Only the payment fields can be updated (via a separate payment endpoint)
- New tests require a NEW encounter with a NEW encounterCode/Order ID but SAME patient MRN
- An encounter can be CANCELLED but not edited

## Receipt Format
A4 format:
- Top 49%: patient copy (tenant header, patient details, test list, payment summary, footer)
- 2% tear line with dashes
- Bottom 48%: office copy (same content)

Thermal 80mm:
- Patient block (name, MRN, date)
- Tests block (test names, prices)
- Payment block (total, discount, paid, due)
- Tenant header/footer (small text, wrapped to 80mm width)
