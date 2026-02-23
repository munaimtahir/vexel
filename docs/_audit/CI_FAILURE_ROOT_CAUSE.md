# CI Failure Root Cause Analysis

**Date:** 2026-02-23  
**Commit at diagnosis:** `4260d44` → fixed at `d92c676`

---

## Failing Workflow: E2E (was `if: false`) + Static CI

### CI Workflow: `.github/workflows/ci.yml`

#### Issue 1 — `ADMIN_BASE` wrong port in CI env vars
- **Failing step:** `Run E2E tests` (if it were enabled)
- **Symptom:** Admin tests would route to MinIO (port 9025) instead of Admin Next.js (port 9023)
- **Root cause:** `ADMIN_BASE: http://127.0.0.1:9025` — wrong port assignment
- **Fix:** `ADMIN_BASE: http://127.0.0.1:9023`
- **File:** `.github/workflows/ci.yml` line 91

#### Issue 2 — CORS blocking E2E browser origin
- **Failing step:** E2E login tests time out (browser blocked by CORS)
- **Symptom:** `page.waitForURL('**/encounters')` times out — login API call silently blocked
- **Root cause:** `CORS_ALLOWED_ORIGINS` in docker-compose did not include `http://127.0.0.1:9024` (operator E2E origin) or `http://127.0.0.1:9023` (admin E2E origin). The operator app bakes `NEXT_PUBLIC_API_URL=https://vexel.alshifalab.pk` at build time, so browser makes cross-origin requests from `http://127.0.0.1:9024` to `https://vexel.alshifalab.pk`.
- **Fix:** Added both ports to `CORS_ALLOWED_ORIGINS`
- **File:** `docker-compose.yml` → API service env

#### Issue 3 — Admin E2E tests using wrong URL paths
- **Failing step:** All `02-admin-crud.spec.ts` tests time out
- **Symptom:** `getByLabel('Email')` not found — page shows 404
- **Root cause:** Admin app has `basePath: '/admin'` (set in `next.config.ts`). Tests navigated to `/login` → resolved to `http://127.0.0.1:9023/login` → 404. Actual path is `/admin/login`.
- **Fix:** Updated all admin test navigation to use `/admin/*` prefix paths
- **File:** `apps/e2e/tests/02-admin-crud.spec.ts`

#### Issue 4 — Operator workflow E2E using old UI selectors
- **Failing step:** `05-operator-workflow.spec.ts` tests
- **Symptom:** "Submit Results" button not found, "Confirm Verify" not found at page load
- **Root cause:** Results page was rewritten in Wave 4 — button renamed "Save All Results"; no auto-redirect after save; verify page shows "Verify & Publish" button that opens a modal (not "Confirm Verify" directly).
- **Fix:** Updated selectors and flow to match new UI
- **File:** `apps/e2e/tests/05-operator-workflow.spec.ts`

#### Issue 5 — Document pipeline E2E expecting manual generation
- **Failing step:** `06-document-pipeline.spec.ts` test 51
- **Symptom:** "Generate Lab Report" button not found
- **Root cause:** Old test expected manual document generation UI. New workflow auto-generates report on `:verify` command. No "Generate Lab Report" button exists.
- **Fix:** Updated to test auto-generate flow — poll for PUBLISHED status on `/publish` page
- **File:** `apps/e2e/tests/06-document-pipeline.spec.ts`

#### Issue 6 — `waitForDocumentRendered` didn't accept PUBLISHED
- **Failing step:** `06-document-pipeline.spec.ts` test 106 timeout (30s)
- **Symptom:** Worker auto-publishes after render — document jumps RENDERED→PUBLISHED before poll sees RENDERED
- **Root cause:** `waitForDocumentRendered` only accepted `status === 'RENDERED'` as success
- **Fix:** Accept both `RENDERED` and `PUBLISHED` as terminal success states; also added `test.setTimeout(60_000)`
- **File:** `apps/e2e/helpers/wait-for.ts`, `apps/e2e/tests/06-document-pipeline.spec.ts`

---

## Verified Facts

| # | Fact | Evidence |
|---|------|----------|
| 1 | `/admin/login` returns 200 | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9023/admin/login` → 200 |
| 2 | CORS preflight from 127.0.0.1:9024 now works | `curl -sv -X OPTIONS` preflight returns `access-control-allow-origin: http://127.0.0.1:9024` |
| 3 | 25/25 E2E tests pass locally | `npx playwright test` → `25 passed (24.4s)` |
| 4 | 36 API unit tests pass | `npm test` → `36 tests passed` |
