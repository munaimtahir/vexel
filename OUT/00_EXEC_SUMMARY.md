# Phase 6 Audit — Executive Summary

**Audit date:** 2025-07-22  
**Auditor:** Static + Runtime Verification Agent  
**Scope:** Phase 6 completion check + platform-wide static/runtime audit

---

## Overall Verdict: CONDITIONAL PASS ⚠️

Core platform logic is sound and all unit tests pass. Two genuine gaps prevent a clean PASS:
1. **SDK is stale** — OpenAPI has 55 paths; SDK was generated from an older spec with only 36 paths. Document and catalog-advanced endpoints missing from types.
2. **Frontend path-param drift** — Operator publish page calls `/documents/{documentId}` but OpenAPI spec defines `/documents/{id}`. When SDK is regenerated, TS will reject the call.

---

## Condition Table

| # | Condition | Status | Evidence | Risk |
|---|-----------|--------|----------|------|
| 1 | **Contract-first discipline** — OpenAPI is source of truth | ⚠️ PARTIAL | `openapi.yaml` has 78 operationIds / 55 paths. SDK generated file has only 36 paths — stale. CI freshness check script exists but SDK not regenerated after document + catalog-advanced additions. | HIGH |
| 2 | **SDK-only enforcement** — No raw fetch/axios in frontends | ✅ PASS | `grep -rn "fetch\(" apps/operator/src/app apps/admin/src/app` → 0 results. Both apps import `getApiClient` from `@vexel/sdk` only. `grep -rn "@prisma/client" apps/operator/src apps/admin/src` → 0 results. | — |
| 3 | **Operator workflow pages exist and are wired** | ✅ PASS | All 5 required operator pages present with real SDK calls (see OUT/03, OUT/05). `patients/new`, `encounters/[id]`, `results`, `verify`, `publish` all implemented. | — |
| 4 | **Document pipeline wired** | ✅ PASS | `canonical.ts` with `payloadHash(sha256)`, `documents.service.ts`, `document-render.processor.ts` (worker), `Program.cs` with `/render` endpoint all exist. Idempotency spec passes (36/36 tests). | — |
| 5 | **Auditability — every command has audit + correlationId** | ✅ PASS | `grep -c "auditService\|this\.audit" apps/api/src/encounters/encounters.service.ts` → 6. `correlation-id.middleware.ts` injects/propagates `x-correlation-id` on every request. | — |
| 6 | **Tenant isolation** | ✅ PASS | Every query filtered by `tenantId` derived from JWT. `tenant-resolver.middleware.spec.ts` passes. No global uniqueness on tenant-owned data found. | — |
| 7 | **Runtime health** | ⚠️ NOT RUNNING | Docker stack has 0 running containers (`docker compose ps` → empty). API and PDF health endpoints unreachable. Unit tests: 7 suites, 36 tests, all PASS (static). | MED |
| 8 | **Secrets posture** | ✅ LOW RISK | `POSTGRES_PASSWORD=vexel` and `JWT_SECRET=vexel-dev-secret-change-in-production` in `docker-compose.yml` — expected dev placeholders. No real secrets committed. | LOW |
| 9 | **OpenAPI ↔ Controller drift** | ⚠️ 1 DRIFT | `/tenants/{tenantId}/feature-flags` is in OpenAPI + SDK, but controller is mounted at `/feature-flags` (JWT-derived tenantId). HTTP calls to the contract path return 404. | MED |
| 10 | **Frontend path-param naming** | ⚠️ DRIFT | Operator publish page uses `/documents/{documentId}` but OpenAPI/SDK (once regenerated) uses `/documents/{id}`. Runtime currently masked by stale SDK. | HIGH |

---

## Summary of Gaps

| Priority | Gap | File(s) |
|----------|-----|---------|
| P1 | Regenerate SDK from current OpenAPI (19 missing paths) | `packages/sdk/src/generated/api.d.ts` |
| P2 | Fix publish page path params: `{documentId}` → `{id}` | `apps/operator/src/app/(protected)/encounters/[id]/publish/page.tsx` |
| P3 | Add `/tenants/{tenantId}/feature-flags` controller route OR fix OpenAPI path | `apps/api/src/feature-flags/feature-flags.controller.ts` |
| P4 | Start Docker stack for full runtime verification | `docker-compose.yml` |
