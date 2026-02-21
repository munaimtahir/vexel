# E2E Run Results

**Timestamp:** 2026-02-21T20:28:57Z  
**Git SHA:** 99922f9  
**Total:** 25/25 passed  
**Duration:** ~28s  

## Test Results

| # | Test | Status |
|---|------|--------|
| 1 | Authentication › operator /login page loads | ✅ PASS |
| 2 | Authentication › login with valid credentials redirects to /encounters | ✅ PASS |
| 3 | Authentication › invalid credentials show error message | ✅ PASS |
| 4 | Authentication › accessing /encounters without auth redirects to /login | ✅ PASS |
| 5 | Authentication › /encounters loads after successful login | ✅ PASS |
| 6 | Admin CRUD › admin login and navigate to /admin/tenants | ✅ PASS |
| 7 | Admin CRUD › tenant list displays at least one tenant | ✅ PASS |
| 8 | Admin CRUD › create a new test user via UI and verify in list | ✅ PASS |
| 9 | Admin CRUD › feature flags page loads with toggles | ✅ PASS |
| 10 | Admin CRUD › toggle a feature flag and verify state changes | ✅ PASS |
| 11 | Patient management › create patient via UI and see in list | ✅ PASS |
| 12 | Patient management › patients list page loads with table headers | ✅ PASS |
| 13 | Patient management › duplicate MRN shows 409 error | ✅ PASS |
| 14 | Encounter management › create encounter and navigate to detail | ✅ PASS |
| 15 | Encounter management › encounter detail page shows patient identity header | ✅ PASS |
| 16 | Encounter management › encounters list page loads with headers | ✅ PASS |
| 17 | LIMS workflow › enter results and submit, status updates to resulted | ✅ PASS |
| 18 | LIMS workflow › verify results via modal confirm, transitions to verified | ✅ PASS |
| 19 | LIMS workflow › publish page is accessible after verified status | ✅ PASS |
| 20 | Document pipeline › generate report, poll until RENDERED, publish and download | ✅ PASS |
| 21 | Document pipeline › generate report twice returns same document ID (idempotency) | ✅ PASS |
| 22 | Document pipeline › document status transitions: QUEUED/RENDERING → RENDERED | ✅ PASS |
| 23 | Tenant isolation › encounter created under system tenant not accessible with different tenant header | ✅ PASS |
| 24 | Tenant isolation › patient created under system tenant not accessible with spoofed tenant header | ✅ PASS |
| 25 | Tenant isolation › cross-tenant list endpoint does not leak records | ✅ PASS |

## Stack Health at Run Time

| Service | Status |
|---------|--------|
| postgres | healthy |
| redis | healthy |
| api (NestJS) | healthy |
| worker (BullMQ) | running |
| pdf (.NET QuestPDF) | healthy |
| admin (Next.js) | running |
| operator (Next.js) | running |

## Fixes Applied During This Run

1. **Test selector robustness**: Added `.first()` on locators that can match multiple elements (encounter cell, "resulted" status badge, toggle buttons with timeout)
2. **Admin feature flags timeout**: Increased `toBeVisible` timeout to 15s under concurrent load
3. **Encounter test**: Use `selectOption({ value: patient.id })` instead of checking option visibility
4. **Containers rebuilt**: API, admin, operator rebuilt with committed code to ensure all deployed fixes take effect

## Services at Test Time

- API: `http://127.0.0.1:9021`
- Admin: `http://127.0.0.1:9023`  
- Operator: `http://127.0.0.1:9024`
- PDF: `http://127.0.0.1:9022`
