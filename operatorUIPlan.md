# Vexel LIMS — Operator UI Plan & Troubleshooting Guide
> **Purpose:** Session-resilient handoff. Share this file at the start of any new chat window.
> The agent should read it fully, verify current state, pick the first open issue, fix + test it, mark done, then move to the next.
> **Last updated:** 2026-02-24 — UX bug-fix session complete.

---

## ⚡ QUICK STATE CHECK (run these first in every new session)

```bash
# 1. What commit are we on?
git -C /home/munaim/srv/apps/vexel log --oneline -5

# 2. Are all containers running?
docker compose -f /home/munaim/srv/apps/vexel/docker-compose.yml ps

# 3. Is API healthy?
curl -s http://127.0.0.1:9021/api/health

# 4. Get a token (used for all API tests below)
TOKEN=$(curl -s -X POST http://127.0.0.1:9021/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vexel.pk","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
echo $TOKEN | cut -c1-30  # should print first 30 chars of JWT

# 5. Quick worklist check (was 500 — fixed 2287b59)
curl -s "http://127.0.0.1:9021/api/encounters?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('encounters total:', d.get('pagination',{}).get('total','ERROR'))"
```

Expected output: encounters total = a number (not ERROR, not 500).

---

## 🏗 PRODUCTION STATE

| Item | Value |
|------|-------|
| Live URL | https://vexel.alshifalab.pk |
| Repo | `git@github.com:munaimtahir/vexel.git` |
| Server | `/home/munaim/srv/apps/vexel/` |
| HEAD commit | `2287b59` on `main` |
| DB | `postgresql://vexel:vexel@127.0.0.1:5433/vexel` |

### Credentials
| User | Email | Password | Use For |
|------|-------|----------|---------|
| Super Admin | `admin@vexel.pk` | `admin123` | Admin app + API tests |
| Demo Operator | `operator@demo.vexel.pk` | `Operator@demo123!` | Operator app |
| Demo Verifier | `verifier@demo.vexel.pk` | `Verifier@demo123!` | Verify step |

### Ports
| Service | Port |
|---------|------|
| API (NestJS) | 127.0.0.1:9021 |
| PDF (.NET) | 127.0.0.1:9022 |
| Admin (Next.js) | 127.0.0.1:9023 |
| Operator (Next.js) | 127.0.0.1:9024 |
| Postgres | 127.0.0.1:5433 |
| Redis | 127.0.0.1:6380 |
| MinIO | 127.0.0.1:9025 |

### Deploy Commands
```bash
cd /home/munaim/srv/apps/vexel

# After API changes:
docker compose build api && docker compose up -d api

# After Operator UI changes:
docker compose build operator && docker compose up -d operator

# After Admin UI changes:
docker compose build admin && docker compose up -d admin

# After ALL:
docker compose build api admin operator && docker compose up -d api admin operator
```

---

## 📋 ISSUE TRACKER (work one at a time, test before marking done)

### How to work through this list
1. Pick the first `[ ]` item.
2. Read the **Issue**, **Root Cause**, and **Expected Behavior** sections.
3. Fix it.
4. Run the **Test Steps** to verify.
5. Deploy (`docker compose build X && docker compose up -d X`).
6. Verify on live: https://vexel.alshifalab.pk
7. Commit: `git add -A && git commit -m "fix: <description>\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"`
8. Mark `[x]` and record result.
9. Move to next item.

---

### ISSUE 1: Results entry — end-to-end validation
**Status:** `[ ]` Not tested  
**Priority:** 🔴 High

**What to test:**
1. Log in as `operator@demo.vexel.pk` on https://vexel.alshifalab.pk
2. Create a new registration: fill mobile, name, add 1 test → Save
3. Go to Sample Collection → collect sample for that patient
4. Go to Results → Pending tab — does the test appear?
5. Click "Enter results" — does the results entry page load with parameters?
6. Fill in a value → Save → confirm value persists on refresh
7. Submit → confirm filled fields are locked, empty fields stay editable
8. Check Submitted tab — test appears there?

**Files to investigate if broken:**
- `apps/operator/src/app/(protected)/lims/results/page.tsx`
- `apps/operator/src/app/(protected)/lims/results/[orderedTestId]/page.tsx`
- `apps/api/src/results/results.service.ts`

**API test commands:**
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:9021/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@vexel.pk","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Get pending tests
curl -s "http://127.0.0.1:9021/api/results/tests/pending" \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: demo" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('pending tests:', len(d.get('data',[])))"
```

**Result:** ___________

---

### ISSUE 2: Verification flow — end-to-end validation
**Status:** `[ ]` Not tested  
**Priority:** 🔴 High

**What to test:**
1. After completing Issue 1 (test submitted), go to Verification → Pending tab
2. Does the encounter appear?
3. Click "Verify patient" — does verification page load with test cards?
4. Are empty parameters hidden (only filled ones shown)?
5. Click "Verify patient" button — does it succeed?
6. Does a PDF document get published? (poll `/lims/reports`)
7. Download the PDF — does it open?

**API test commands:**
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:9021/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@vexel.pk","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Get pending verification encounters
curl -s "http://127.0.0.1:9021/api/verification/encounters/pending" \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: demo" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('pending verification:', len(d.get('data',[])))"
```

**Result:** ___________

---

### ISSUE 3: Sample worklist not showing pre-fix encounters
**Status:** `[ ]` Known data issue  
**Priority:** 🟡 Medium

**Root Cause:** Encounters created before commit `3b022ec` have zero `SpecimenItem` rows because `orderLab` silently skipped creation when `specimenType = NULL` on the catalog test. New orders (post-fix) work correctly.

**Fix options:**
- **Option A (recommended):** Run a one-time DB migration to create missing SpecimenItems for all existing `lab_ordered` encounters that have zero SpecimenItems:
  ```sql
  -- Preview: count affected encounters
  SELECT COUNT(DISTINCT e.id) 
  FROM encounters e
  JOIN lab_orders lo ON lo."encounterId" = e.id
  WHERE e.status = 'lab_ordered'
    AND NOT EXISTS (SELECT 1 FROM specimen_items si WHERE si."encounterId" = e.id);

  -- Fix: insert one SpecimenItem per encounter (using 'Blood' as default specimenType)
  INSERT INTO specimen_items (id, "tenantId", "encounterId", "catalogSpecimenType", status, "createdAt", "updatedAt")
  SELECT 
    gen_random_uuid()::text,
    e."tenantId",
    e.id,
    'Blood',
    'PENDING',
    NOW(),
    NOW()
  FROM encounters e
  JOIN lab_orders lo ON lo."encounterId" = e.id
  WHERE e.status = 'lab_ordered'
    AND NOT EXISTS (SELECT 1 FROM specimen_items si WHERE si."encounterId" = e.id)
  ON CONFLICT DO NOTHING;
  ```
- **Option B:** Ignore old data; only new registrations matter going forward.

**DB access:**
```bash
docker exec -it $(docker compose -f /home/munaim/srv/apps/vexel/docker-compose.yml ps -q postgres) \
  psql -U vexel -d vexel -c "SELECT COUNT(DISTINCT e.id) FROM encounters e JOIN lab_orders lo ON lo.\"encounterId\" = e.id WHERE e.status = 'lab_ordered' AND NOT EXISTS (SELECT 1 FROM specimen_items si WHERE si.\"encounterId\" = e.id);"
```

**Ask user before applying Option A** — it modifies existing data.

**Result:** ___________

---

### ISSUE 4: Catalog price column — full surface audit
**Status:** `[ ]` Partially done  
**Priority:** 🟡 Medium

**What was done:** `price Decimal?` field added to `CatalogTest` schema in migration `20260223000002`.

**What to verify (check each):**
- [ ] Admin → Catalog → Tests list — does it show a Price column?
- [ ] Admin → Catalog → Create Test form — does it have a Price field?
- [ ] Admin → Catalog → Import/Export → Download XLSX template — does Tests sheet have `price` column?
- [ ] Upload a test CSV/XLSX with a price value — does it import correctly?
- [ ] Operator → Registration → add test — does the price show in the order section?

**Files to check:**
- `apps/admin/src/app/(protected)/catalog/tests/page.tsx` — list + create form
- `apps/api/src/catalog/catalog-import-export.service.ts` — template generation
- `apps/operator/src/app/(protected)/lims/registrations/new/page.tsx` — test search results

**API test:**
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:9021/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@vexel.pk","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
curl -s "http://127.0.0.1:9021/api/catalog/tests?limit=3" \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: system" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(t.get('name'), '| price:', t.get('price')) for t in d.get('data',[])]"
```

**Result:** ___________

---

### ISSUE 5: Receipt polling — extend timeout
**Status:** `[ ]` Open  
**Priority:** 🟡 Medium

**Root Cause:** Receipt polls 12 × 1s = 12 seconds max. PDF rendering + BullMQ job processing can take longer.

**File:** `apps/operator/src/app/(protected)/lims/registrations/new/page.tsx`

**Fix:** Change the poll loop from 12 iterations to 20, with a 1.5s delay:
```typescript
// Change:
for (let i = 0; i < 12; i++) {
  await new Promise(r => setTimeout(r, 1000));
// To:
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 1500));
```

**Test:** Create a registration + order → watch the success screen → does receipt link appear within 30s?

**Result:** ___________

---

### ISSUE 6: Admin/Operator show "unhealthy" in docker compose ps
**Status:** `[ ]` Low priority cosmetic  
**Priority:** 🟢 Low

**Root Cause:** The healthcheck in `docker-compose.yml` for admin and operator containers hits a path that returns non-200 (likely redirects to login page). Containers are actually working.

**Fix:** Update healthcheck for admin and operator in `docker-compose.yml`:
```yaml
# For operator (port 3000):
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:3000/"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s

# For admin (port 3001, basePath=/admin):
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:3001/admin"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

Or simplest fix: disable healthcheck for both Next.js apps (they start fine, no need for Docker healthcheck):
```yaml
healthcheck:
  disable: true
```

**Result:** ___________

---

### ISSUE 7: Worklist load — verify filtering and search
**Status:** `[ ]` Not tested  
**Priority:** 🟡 Medium

**What to test on https://vexel.alshifalab.pk/lims/worklist:**
1. Does the worklist load encounters (now that 500 is fixed)?
2. Does "search by MRN" work?
3. Does "search by patient name" work?
4. Does clicking an encounter row open encounter detail?
5. Does encounter detail show the correct tests ordered?

**API test:**
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:9021/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@vexel.pk","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
curl -s "http://127.0.0.1:9021/api/encounters?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: demo" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(e.get('encounterCode','?'), '|', e.get('status')) for e in d.get('data',[])]"
```

**Result:** ___________

---

### ISSUE 8: Registration — verify full new flow works
**Status:** `[ ]` Not tested after latest changes  
**Priority:** 🔴 High (this is the primary entry point)

**What to test on https://vexel.alshifalab.pk/lims/registrations/new:**

#### A) New patient flow
1. Clear all fields
2. Enter a new mobile number (one not in DB) → press Enter on mob2 field
3. ✅ Should see: no popup, "New Patient · MRN: Auto-generated" badge appears (only after lookup completes)
4. Fill name, age or DOB, gender
5. Search a test, press Enter → test added, cursor returns to search bar
6. Press Tab → cursor moves to Discount field
7. Click "Save & Print" → success screen appears immediately
8. Wait up to 12s → "Download/Print Receipt" link appears (or "check reports later")
9. Click "Open Encounter →" — does it navigate to encounter detail?
10. Click "+ New Patient" — form clears, cursor on mob1

#### B) Existing patient flow
1. Enter a mobile number that exists (check DB or use a previously registered patient)
2. Press Enter or blur mob2
3. ✅ Should see: popup modal with matching patients
4. Arrow-down to select → Enter → form fills with patient data, MRN badge shows
5. Add tests → Save → receipt flow

#### C) Register Patient only (no order)
1. Fill patient details, no tests
2. Click "Register Patient" button (top of form)
3. ✅ Should create patient only (no encounter), MRN badge shows in green
4. Then add tests and Save → should create encounter against existing patient

**Result:** ___________

---

## 📜 FIXES LOG (session history)

| Date | Commit | What was fixed |
|------|--------|----------------|
| 2026-02-24 | `2287b59` | Worklist 500 (Number cast for page/limit in 5 services) |
| 2026-02-24 | `2287b59` | Catalog auth errors (stale containers — rebuilt api/admin/operator) |
| 2026-02-24 | `2287b59` | Mobile "New Patient" badge too eager (added lookupDone state) |
| 2026-02-24 | `2287b59` | Receipt window.open() popup blocked → inline download link |
| 2026-02-24 | `4929f9b` | Mobile patient picker modal (arrow-key nav, Enter select) |
| 2026-02-24 | `4c1bb69` | Catalog template download 401 (window.open → fetch+auth) |
| 2026-02-24 | `4c1bb69` | Catalog export JSON → XLSX (5 sheets) |
| 2026-02-24 | `c08d6b9` | Registration UX: mobile split fields, keyboard nav, Register Patient step |
| 2026-02-24 | `3b022ec` | SpecimenItem never created (specimenType NULL guard — fixed to ?? 'Blood') |
| 2026-02-24 | `3b022ec` | Sample worklist toDate midnight UTC — fixed +24h |
| 2026-02-24 | `3b022ec` | Sample collection page auto-load, barcode flag, receive separation |
| 2026-02-24 | `9e7e1ea` | Sidebar dedup, worklist links, fullName+DOB, save&print flow, price column |
| 2026-02-24 | `38d628b` | /lims/* route namespace + Operator landing page + App Switcher |

---

## 🔒 NON-NEGOTIABLE GUARDRAILS

Every fix must respect these — if in doubt, ask the user:

| Rule | Detail |
|------|--------|
| **SDK-only** | No `fetch()` or `axios()` in Next.js apps. Use `getApiClient(getToken() ?? undefined)` |
| **Contract-first** | New API endpoints must be added to `packages/contracts/openapi.yaml` first, then `pnpm sdk:generate` |
| **Tenant isolation** | Every Prisma query includes `tenantId` filter |
| **Command-only state** | No direct DB status mutations. All state changes via Command endpoints |
| **Number() cast** | Always cast `page`/`limit` query params with `Number()` before passing to Prisma `take`/`skip` |
| **NEXT_PUBLIC_API_URL** | Build arg, not runtime env — rebuild container after changing |
| **No Prisma in Next.js** | Never import Prisma in admin or operator apps |
| **Audit events** | Every command writes AuditEvent with correlationId |

---

## 📁 KEY FILE PATHS

| What | Path |
|------|------|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| OpenAPI contract | `packages/contracts/openapi.yaml` |
| SDK (generated) | `packages/sdk/` |
| Encounters service | `apps/api/src/encounters/encounters.service.ts` |
| Results service | `apps/api/src/results/results.service.ts` |
| Sample collection service | `apps/api/src/sample-collection/sample-collection.service.ts` |
| Feature flags service | `apps/api/src/feature-flags/feature-flags.service.ts` |
| Feature flags hook | `apps/operator/src/hooks/use-feature-flags.ts` |
| Operator API client | `apps/operator/src/lib/api-client.ts` |
| Operator sidebar | `apps/operator/src/components/sidebar.tsx` |
| Operator LIMS pages | `apps/operator/src/app/(protected)/lims/` |
| Registration page | `apps/operator/src/app/(protected)/lims/registrations/new/page.tsx` |
| Sample collection page | `apps/operator/src/app/(protected)/lims/sample-collection/page.tsx` |
| Results worklist page | `apps/operator/src/app/(protected)/lims/results/page.tsx` |
| Results entry page | `apps/operator/src/app/(protected)/lims/results/[orderedTestId]/page.tsx` |
| Verification queue page | `apps/operator/src/app/(protected)/lims/verification/page.tsx` |
| Patient verification page | `apps/operator/src/app/(protected)/lims/verification/encounters/[encounterId]/page.tsx` |
| Reports page | `apps/operator/src/app/(protected)/lims/reports/page.tsx` |
| Admin catalog tests | `apps/admin/src/app/(protected)/catalog/tests/page.tsx` |
| Admin import-export | `apps/admin/src/app/(protected)/catalog/import-export/page.tsx` |
| Caddy config | `/home/munaim/srv/proxy/caddy/Caddyfile` |
| docker-compose | `/home/munaim/srv/apps/vexel/docker-compose.yml` |

---

## 📐 SCHEMA REFERENCE (current as of migration 20260223000002)

### Key models
```
Patient: id, tenantId, mrn, firstName, lastName, mobile, cnic, address, dateOfBirth, gender, ageYears
Encounter: id, tenantId, patientId, status, encounterCode, createdAt
LabOrder: id, tenantId, encounterId, testId, testNameSnapshot, status, resultStatus(PENDING|SUBMITTED), submittedAt
LabResult: id, tenantId, labOrderId, parameterId, parameterNameSnapshot, value, unit, flag, locked, enteredAt
SpecimenItem: id, tenantId, encounterId, catalogSpecimenType, status(PENDING|COLLECTED|RECEIVED|POSTPONED), barcode?
CatalogTest: id, tenantId, code, name, specimenType?, price?
CatalogParameter: id, tenantId, code, name, resultType, defaultUnit, decimals, allowedValues
```

### Encounter status flow
```
registered → lab_ordered → specimen_collected → partial_resulted → resulted → verified → published
```

### LabOrder resultStatus flow
```
PENDING → SUBMITTED
```

---

## 🔮 FUTURE WORK (not started — do not touch unless user asks)

- Full Playwright CI run (currently `if: false`)
- Admin branding UI (TenantConfig fields exist, scaffold exists, not wired)
- MinIO console Caddy route (port 9025)
- Multi-order encounters (currently one order per encounter)
- Real logo in QuestPDF
- RIMS / OPD modules
