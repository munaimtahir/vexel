# 04_LOCKED_RULES_COMPLIANCE_MATRIX.md

**Audit Timestamp:** 2026-05-27 18:41 (UTC)

---

## Compliance Matrix

| # | Locked Rule | Status | Evidence Path | Risk | Notes / Action |
|---:|---|---|---|---|---|
| 1 | OpenAPI Contract is canonical | **PASS** | `packages/contracts/openapi.yaml` | Low | Successfully generates SDK types. |
| 2 | SDK generated from OpenAPI | **PASS** | `packages/sdk/src/generated/api.d.ts` | Low | `openapi-typescript` output matches contract exactly. |
| 3 | Frontends use generated SDK only | **PASS** | `apps/admin/package.json`, `apps/operator/package.json` | Low | All API calls flow through `@vexel/sdk`. |
| 4 | No raw fetch/axios from frontend | **PASS** | `scripts/ui-color-lint.mjs` scan | Low | Hard gates enforced via Next lint rules. |
| 5 | Single-Tenant Mode with Tenancy | **PASS** | `prisma/schema.prisma` | Low | Structural tenancy remains in db while hiding switcher. |
| 6 | `tenantId` on customer rows | **PASS** | `prisma/schema.prisma` | Low | Present on User, Role, Patient, Encounter, etc. |
| 7 | Unique constraints tenant-scoped | **PASS** | `prisma/schema.prisma` | Low | Scoped compound keys e.g. `@@unique([tenantId, email])`. |
| 8 | Tenant resolved by Host in prod | **PASS** | `apps/api/src/tenant/tenant-resolver.middleware.ts` | Medium | Host domain lookup middleware active. |
| 9 | `x-tenant-id` dev override gated | **PASS** | `apps/api/src/tenant/tenant-resolver.middleware.ts` | Low | Gated behind `TENANCY_DEV_HEADER_ENABLED === 'true'`. |
| 10 | Queries tenant-scoped by default | **PASS** | `apps/api/src/tenants/__tests__/tenant-service-health.spec.ts` | Low | Checked in tenant resolution unit tests. |
| 11 | LIMS state command-only | **PASS** | `apps/api/src/encounters/__tests__/encounter-workflow.spec.ts` | Low | Verified command endpoints in state machine. |
| 12 | Invalid state returns 409 | **PASS** | `apps/api/src/encounters/__tests__/encounter-workflow.spec.ts` | Low | Asserts 409 Conflict on incorrect transitions. |
| 13 | Commands write AuditEvent | **PASS** | `apps/api/src/audit/audit.service.spec.ts` | Low | Verified in audit unit tests. |
| 14 | Admin UI cannot mutate LIMS state | **PASS** | `apps/admin/src/app` static routes | Low | Admin controllers do not expose state mutation endpoints. |
| 15 | Deterministic `payloadHash` | **PASS** | `apps/api/src/documents/__tests__/canonical.spec.ts` | Low | Hashing outputs are verified deterministic. |
| 16 | Unique doc compound identity | **PASS** | `apps/api/src/documents/__tests__/document-idempotency.spec.ts` | Low | COMPOUND KEY constraint active on Document database row. |
| 17 | Worker-driven async PDF | **PASS** | `apps/worker/src/processors/pdf-render.processor.ts` | Low | BullMQ worker listens for pdf render jobs. |
| 18 | Rendered bytes produce `pdfHash` | **PASS** | `apps/api/src/documents/__tests__/documents.service.spec.ts` | Low | PDF service returns SHA-256 header. |
| 19 | Publish is idempotent | **PASS** | `apps/api/src/documents/__tests__/document-idempotency.spec.ts` | Low | Re-publishing verified safe in tests. |
| 20 | Backend feature flags | **PARTIAL** | `apps/api/src/feature-flags/` | Medium | FeatureFlagService exists but runtime verify is blocked. |
| 21 | Request correlationId | **PASS** | `apps/api/src/common/middleware/correlation-id.middleware.ts` | Low | Generates correlationId middleware. |
| 22 | Job correlationId propagation | **PASS** | `apps/worker/src/main.ts` | Medium | Worker logs context with correlationId. |
| 23 | JWT auth access tokens | **PASS** | `apps/api/src/auth/jwt.strategy.ts` | Low | JWT passport strategy active. |
| 24 | Persisted DB Refresh tokens | **PASS** | `prisma/schema.prisma` (RefreshToken model) | Low | Persisted DB model active. |
| 25 | Refresh rotation on use | **PASS** | `apps/api/src/auth/auth.service.ts` | Low | Rotation logic active. |
| 26 | Logout revokes refresh tokens | **PASS** | `apps/api/src/auth/auth.service.ts` | Low | Revocation logic active. |
| 27 | Permissions loaded live from DB | **PASS** | `apps/api/src/rbac/permissions.guard.ts` | Low | Live guard verification active. |
| 28 | Separate Admin / Operator apps | **PASS** | Filesystem folders | Low | Reside in separate Next projects. |
| 29 | Admin MVP pages exist | **PASS** | `apps/admin/src/app` filesystem | Low | Pages present under appropriate modules. |
| 30 | Operator LIMS flow pages exist | **PASS** | `apps/operator/src/app/lims` | Low | Pages namespaced under `/lims/*`. |
| 31 | Test baseline exists & passes | **PARTIAL** | `pnpm test` (API PASS, SDK FAIL) | High | API tests pass, but SDK tests require `jest` dependency. |
| 32 | Runtime smoke exists & passes | **FAIL** | Docker Compose startup | Critical | Blocked. Docker daemon hangs on container creation. |
| 33 | Security basics acceptable | **PASS** | Static audit | Low | DB secrets masked, CORS restricted, JWT configured. |
