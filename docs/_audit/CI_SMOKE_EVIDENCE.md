# CI Smoke Evidence

**Date:** 2026-02-23  
**Final commit:** `d92c676`  
**Stack:** Docker Compose (all 8 services healthy)

---

## Environment

| Tool | Version |
|------|---------|
| Node | v20.20.0 |
| pnpm | 9.15.4 |
| Playwright | 1.50.0 |
| OS | Ubuntu (VPS) |

---

## Commands Run + Outputs

### 1. API Unit Tests
```
cd apps/api && npm test -- --passWithNoTests --testPathPattern="spec.ts$"

Test Suites: 5 passed, 5 total
Tests:       36 passed, 36 total
Snapshots:   0 total
Time:        ~12s
```
**Result: ✅ PASS**

### 2. Static CI Checks (pnpm run in repo root)
```
pnpm run sdk:check            → ✅ SDK up-to-date
pnpm run sdk:compliance:admin → ✅ No raw fetch/axios in admin
pnpm run sdk:compliance:operator → ✅ No raw fetch/axios in operator
pnpm run no-prisma-in-frontends  → ✅ No Prisma imports in Next.js apps
```
**Result: ✅ PASS**

### 3. API Build
```
pnpm --filter @vexel/api build → ✅ 0 errors
```

### 4. CORS Verification
```bash
curl -sv -X OPTIONS "https://vexel.alshifalab.pk/api/auth/login" \
  -H "Origin: http://127.0.0.1:9024" \
  -H "Access-Control-Request-Method: POST"

HTTP/2 204
access-control-allow-origin: http://127.0.0.1:9024
access-control-allow-credentials: true
```
**Result: ✅ PASS**

```bash
curl -sv -X OPTIONS "https://vexel.alshifalab.pk/api/auth/login" \
  -H "Origin: http://127.0.0.1:9023" \
  -H "Access-Control-Request-Method: POST"

HTTP/2 204
access-control-allow-origin: http://127.0.0.1:9023
```
**Result: ✅ PASS**

### 5. Full E2E Suite
```
cd apps/e2e && npx playwright test

[global-setup] API health check passed.
Running 25 tests using 2 workers

25 passed (24.4s)
```
**Result: ✅ ALL 25 PASS**

#### E2E Tests Breakdown

| Test File | Tests | Result |
|-----------|-------|--------|
| 01-auth.spec.ts | 5 | ✅ All pass |
| 02-admin-crud.spec.ts | 5 | ✅ All pass |
| 03-operator-patient.spec.ts | 3 | ✅ All pass |
| 04-operator-encounter.spec.ts | 4 | ✅ All pass |
| 05-operator-workflow.spec.ts | 3 | ✅ All pass |
| 06-document-pipeline.spec.ts | 3 | ✅ All pass |
| 07-tenant-isolation.spec.ts | 2 | ✅ All pass |
| **Total** | **25** | **✅ 25/25** |

---

## Service Health at Test Time

| Service | URL | Status |
|---------|-----|--------|
| API | http://127.0.0.1:9021/api/health | `{"status":"ok"}` |
| Admin | http://127.0.0.1:9023/admin/login | 200 OK |
| Operator | http://127.0.0.1:9024/login | 200 OK |
| PDF | http://127.0.0.1:9022/health | 200 OK |

---

## Final Checklist

- [x] Identified failing workflow/job/step with logs
- [x] Reproduced failure locally
- [x] Fixed root cause (minimal diff)
- [x] All unit tests pass locally (36/36)
- [x] All builds pass locally
- [x] All E2E tests pass locally (25/25)
- [x] No CI weakening / no checks disabled
- [x] SDK/OpenAPI consistency verified (sdk:check ✅)
- [x] CORS origins correct for all E2E browser origins
- [x] Admin basePath handled correctly in E2E config

---

## Notes

- E2E job in CI is still `if: false` — requires Docker Compose stack in CI runner (GitHub Actions ubuntu-latest has Docker but would need build time ~15-20min per run). Enabling CI E2E is a future task once a persistent deployment environment or image registry is set up.
- The local E2E suite runs against the live Docker Compose stack on the VPS.
- All demo credentials work: `admin@vexel.system`, `operator@demo.vexel.pk`, `verifier@demo.vexel.pk`
