# RELEASE VERDICT — LIMS Production Gate
**Audit Date:** 2026-03-06T22:25 UTC  
**Auditor:** Final Release Audit Agent  
**Commit:** `af2912e` (HEAD → main, origin/main)

---

## VERDICT: **NO-GO**

**Production Confidence: LOW**

---

## Blocking Reasons (exact)

### BLOCKER-01 · CRITICAL — JWT Secret is a CI test token in production
- **File:** `.env` (loaded by `docker-compose.yml`)
- **Evidence:** `JWT_SECRET=ci-test-jwt-secret-not-for-production-use-only`
- **Confirmed in container:** `docker exec vexel-api-1 env | grep JWT_SECRET` → `JWT_SECRET=ci-test-jwt-secret-not-for-production-use-only`
- **Risk:** Any attacker who reads the env (git history, leaked file) can forge valid JWTs and impersonate any user.
- **Platform rule violated:** Secure secrets management.

### BLOCKER-02 · CRITICAL — API running as `NODE_ENV=development` in production
- **Evidence:** `docker-compose.yml` line `NODE_ENV: development` for `api` service; confirmed in running container.
- **Impact:** Swagger UI is served live at `https://vexel.alshifalab.pk/api/docs`, exposing full API contract, request/response schemas, and endpoint discovery to unauthenticated internet users.
- **Secondary:** `apps/api/src/main.ts:35` — `if (process.env.NODE_ENV !== 'production') { … SwaggerModule.setup … }` — the guard exists but is never triggered.

### BLOCKER-03 · MAJOR — Fake/stub health endpoints for Worker and PDF
- **File:** `apps/api/src/health/health.controller.ts`
- **Evidence:**
  ```typescript
  // TODO: check Redis/BullMQ connectivity
  return { status: 'ok', services: { worker: 'ok', redis: 'unknown' } };
  // TODO: proxy to PDF service
  return { status: 'ok', services: { pdf: 'ok' } };
  ```
- **Live confirmation:** `GET /api/health/worker` returns `{"status":"ok"}` regardless of actual state. If the worker crashes, this endpoint still returns OK.
- **Risk:** Silent failure — health dashboards and alerting tooling cannot detect worker or PDF outages.

### BLOCKER-04 · MAJOR — Hardcoded fallback secrets in source code
- `apps/api/src/auth/auth.module.ts:14`: `secret: process.env.JWT_SECRET ?? 'vexel-dev-secret-change-in-production'`
- `apps/api/src/auth/jwt.strategy.ts:13`: `secretOrKey: process.env.JWT_SECRET ?? 'vexel-dev-secret-change-in-production'`
- `apps/api/src/storage/storage.service.ts:19,74`: `secretAccessKey: process.env.STORAGE_SECRET_KEY ?? 'vexel_secret_2026'`
- `apps/worker/src/main.ts:17`: `secretAccessKey: process.env.STORAGE_SECRET_KEY ?? 'vexel_secret_2026'`
- **Risk:** If env vars are accidentally unset, code silently falls back to known-public secrets. No startup failure, no warning.

### BLOCKER-05 · MAJOR — Hardcoded personal server path in worker
- **File:** `apps/worker/src/ops-backup.processor.ts:23`
- **Evidence:** `const VEXEL_ROOT = process.env.VEXEL_ROOT ?? '/home/munaim/srv/apps/vexel';`
- **Risk:** Backup jobs will fail silently or operate incorrectly when deployed to any server other than the original developer's machine. `VEXEL_ROOT` is not set in `docker-compose.yml`.

### BLOCKER-06 · MAJOR — Weak production credentials for Postgres and MinIO
- Postgres: `POSTGRES_USER=vexel`, `POSTGRES_PASSWORD=vexel` (dictionary-trivial)
- MinIO: `MINIO_ROOT_USER=vexel`, `MINIO_ROOT_PASSWORD=vexel_secret_2026` (hardcoded, publicly visible in docker-compose.yml)
- **Risk:** Database and storage are reachable from the host and any co-process. Trivial brute-force if the server is compromised.

### BLOCKER-07 · ARCHITECTURAL — Worker directly mutates encounter status (bypasses command endpoint rule)
- **File:** `apps/worker/src/document-render.processor.ts:183–185`
- **Evidence:**
  ```typescript
  await prisma.encounter.updateMany({
    where: { id: doc.sourceRef, tenantId, status: { in: ['verified', 'published'] } },
    data: { status: 'published' },
  });
  ```
- **Platform rule:** "Workflow state changes only via Command endpoints." Worker is a background process, not a command endpoint. Direct DB mutation bypasses audit + state machine guard in the service layer.
- **Note:** The auto-publish audit is written by the worker directly (`prisma.auditEvent.create`), which is correct, but the state mutation itself bypasses the `publishReport` service method.

---

## What Passed (with evidence)

- ✅ **TypeScript compiles clean** — `tsc --noEmit` exits 0 for api, admin, operator
- ✅ **114 unit tests pass** — `19 suites, 114 tests, 0 failures`
- ✅ **UI color lint passes** — `node scripts/ui-color-lint.mjs` → PASS
- ✅ **SDK is fresh** — `pnpm sdk:generate` + `git diff` → no diff; SDK matches openapi.yaml
- ✅ **No raw fetch/axios in frontends** — grep confirms all API calls go through `getApiClient`
- ✅ **No Prisma imports in Next.js apps** — grep confirms clean
- ✅ **Tenant isolation structurally enforced** — every LIMS model has `tenantId`; services filter by `tenantId` in all queries
- ✅ **Tenant-scoped unique constraints** — `@@unique([tenantId, email])`, `@@unique([tenantId, mrn])`, `@@unique([tenantId, name])` etc. confirmed in schema
- ✅ **LIMS workflow state machine present** — valid transitions map, `ConflictException` on invalid transitions (live test: 409 confirmed)
- ✅ **409 invalid transitions tested live** — `collect-specimen` on `published` encounter → `409 Conflict`
- ✅ **Command-only workflow pattern** — all state changes go through `encounters.service.ts` command methods
- ✅ **Deterministic document pipeline** — `canonicalJson` + `sha256` → `payloadHash`; unique constraint on `(tenantId, type, templateId, payloadHash)`
- ✅ **Publish idempotency verified** — re-publish on published encounter returns existing record without duplication
- ✅ **Document uniqueness migration** — `20260226214000_document_template_hash_unique` applied
- ✅ **Refresh token rotation implemented** — hash stored, revoked on refresh, rotation chain complete
- ✅ **Disabled users rejected** — JWT strategy checks `user.status !== 'active'` per request (DB lookup)
- ✅ **isSuperAdmin from DB, not JWT claim** — confirmed in `jwt.strategy.ts`
- ✅ **Feature flags backend-authoritative and tenant-scoped** — `TenantFeature` model with `tenantId_key` unique; `assertLimsEnabled` checks per tenant
- ✅ **CorrelationId middleware mounted on all routes** — `app.module.ts` confirms `{ path: '*', method: RequestMethod.ALL }`
- ✅ **139 audit.log call-sites across codebase** — comprehensive audit trail
- ✅ **Admin does not mutate encounter workflow state** — no encounter status writes found in admin app source
- ✅ **SDK-only discipline enforced in CI** — `sdk-only-enforcement` job in `.github/workflows/ci.yml`
- ✅ **Monorepo structure correct** — all services present: api, worker, pdf, admin, operator, e2e
- ✅ **Legacy encounter routes are redirects** — `/encounters` redirects to `/lims/encounters`
- ✅ **LIMS modules properly namespaced** — all active pages under `/lims/*`
- ✅ **printAlone field present** in `CatalogTest` schema and `LabReportPayload`; multi-parameter and reference ranges modeled correctly
- ✅ **Stack is healthy and serving** — all 7 containers up; `api/health` returns ok
- ✅ **TENANCY_DEV_HEADER_ENABLED defaults to false** — not activated in production container

---

## Required Actions Before GO

1. **Rotate JWT_SECRET** — generate `python3 -c "import secrets; print(secrets.token_hex(64))"` and set in `.env` and restart api container
2. **Set `NODE_ENV=production`** for `api` service in `docker-compose.yml`
3. **Implement real health checks** for `/api/health/worker` (check Redis + worker heartbeat table) and `/api/health/pdf` (HTTP probe to PDF service)
4. **Remove hardcoded fallback secrets** from source code or add startup assertion that env vars are set
5. **Set `VEXEL_ROOT` env var** in docker-compose worker service
6. **Rotate Postgres and MinIO passwords** — use strong random credentials, not stored in version-controlled compose file
7. **Review worker encounter status mutation** — either route through service method or formally document as authorized exception to the command-endpoint rule

---

## Unverified Items

- Multi-tenant data isolation end-to-end (only one tenant exists in production DB; cross-tenant isolation verified in schema/service code but not live-tested)
- E2E Playwright tests — failed to run in this environment due to missing system library `libatk-1.0.so.0` (browser deps not installed); tests ran successfully in CI per previous session evidence
- Results entry page end-to-end (UI exists, API works, but full workflow path was not smoke-tested in this run)
- Backup restore pipeline (backup tables exist, scripts reference `/ops/backup_full.sh`, not verified as executable)
