# E2E Playwright Audit — Vexel LIMS
**Date:** 2026-03-03  **Classification: PARTIAL**

## Discovered Files

### Playwright Config
- `apps/e2e/playwright.config.ts` — ✅ Valid config, 2 projects (operator/admin), headless, screenshot+video on failure

### Test Specs (apps/e2e/tests/)
| File | Lines | Coverage |
|------|-------|----------|
| 01-auth.spec.ts | 58 | Auth: login, invalid creds, redirect, worklist load |
| 02-admin-crud.spec.ts | 128 | Admin CRUD: roles, users, catalog |
| 03-operator-patient.spec.ts | 73 | Patient: create, list, 409 duplicate MRN |
| 04-operator-encounter.spec.ts | 84 | Encounter: create, detail, list |
| 05-operator-workflow.spec.ts | 154 | Workflow: results entry, verify modal, publish page (SINGLE PARAM) |
| 06-document-pipeline.spec.ts | 138 | Doc pipeline: auto-generate on verify, idempotency, QUEUED→RENDERED |
| 07-tenant-isolation.spec.ts | 102 | Tenant: cross-tenant 403/404, list leak |
| 08-verification-badge-refetch.spec.ts | 60 | Badge: status refetch after verify |

### Helpers
- `apps/e2e/helpers/api-client.ts` — ✅ apiLogin, apiGet, apiPost, apiPostRaw
- `apps/e2e/helpers/wait-for.ts` — ✅ waitForDocumentRendered, waitForStatus
- `apps/e2e/helpers/global-setup.ts` — ✅ API health check before tests
- `apps/e2e/fixtures/auth.fixture.ts` — ✅ authedPage + authedAdminPage via localStorage injection

### Scripts (root package.json)
- `mcp:playwright` — ✅ MCP server launcher
- `mcp:playwright:install-browsers` — ✅ Chromium install

### Previous Runs
- `apps/e2e/playwright-report/` — ✅ Exists (prior HTML report)
- `apps/e2e/test-results/` — ✅ Exists (prior artifacts)

## What Exists vs Missing

| Requirement | Status | Notes |
|-------------|--------|-------|
| playwright.config.ts | ✅ Present | Valid, but no JSON reporter for evidence pack |
| Test location (apps/e2e/) | ✅ Present | — |
| `e2e:lims` script | ❌ Missing | Only `test` script exists |
| `e2e:lims:nightly` script | ❌ Missing | — |
| Happy path single-parameter | ✅ Present | 05-operator-workflow.spec.ts (tests t1/Glucose) |
| Happy path multi-parameter | ❌ Missing | No multi-test order test |
| Idempotent publish | ✅ Present | 06-document-pipeline.spec.ts `generate report twice` |
| Invalid transition 409 | ⚠️ Partial | 03 tests MRN 409; NO command-endpoint 409 tests |
| Performance timings | ❌ Missing | No step latency capture |
| Evidence pack OUT/e2e_runs/ | ❌ Missing | — |
| data-testid selectors in UI | ❌ Missing | 0 data-testid attributes in operator app |
| Chaos journey (nightly) | ❌ Missing | — |
| console_errors.log output | ❌ Missing | — |
| Network requests summary | ❌ Missing | — |
| timings.json | ❌ Missing | — |

## Classification: PARTIAL

### Present (8/15 requirements)
- playwright.config.ts ✅
- Test location ✅
- Single-parameter happy path ✅ (05)
- Idempotent publish ✅ (06)
- Screenshot/video on failure ✅
- Global setup (health check) ✅
- Auth fixture ✅
- API helpers ✅

### Missing (7/15 requirements)
- `e2e:lims` + `e2e:lims:nightly` scripts ❌
- Multi-parameter happy path spec ❌
- Invalid transition 409 spec (command endpoints) ❌
- Performance timings ❌
- Evidence pack (OUT/e2e_runs/) ❌
- data-testid selectors ❌
- Chaos nightly test ❌
