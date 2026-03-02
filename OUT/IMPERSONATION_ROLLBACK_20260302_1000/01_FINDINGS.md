# 01 — FINDINGS

## Impersonation Feature Detected: YES

### Keyword Scan Results

| File Path | String Found | Classification | Status |
|-----------|-------------|----------------|--------|
| `apps/api/src/impersonation/impersonation.controller.ts` | `impersonat`, `POST /admin/impersonation/start`, `stop`, `status` | API controller | **REMOVED** |
| `apps/api/src/impersonation/impersonation.service.ts` | `ImpersonationService`, `applyToRequest`, `logBlockedWrite` | API service | **REMOVED** |
| `apps/api/src/impersonation/impersonation.types.ts` | `ImpersonationCookiePayload`, `ImpersonationContext` | Types | **REMOVED** |
| `apps/api/src/impersonation/impersonation.constants.ts` | `IMPERSONATION_COOKIE_NAME`, `SAFE_HTTP_METHODS` | Constants | **REMOVED** |
| `apps/api/src/impersonation/impersonation.signing.ts` | `signImpersonationPayload`, `verifyImpersonationPayload` | HMAC signing util | **REMOVED** |
| `apps/api/src/impersonation/impersonation.module.ts` | `ImpersonationModule` | NestJS module | **REMOVED** |
| `apps/api/src/auth/jwt-auth.guard.ts` | `ImpersonationService`, `applyToRequest`, write block logic | Auth middleware | **REVERTED** |
| `apps/api/src/auth/jwt-auth.guard.impersonation.spec.ts` | Full impersonation unit test suite | Tests | **REMOVED** |
| `apps/api/src/auth/auth.module.ts` | `ImpersonationModule` import | Module wiring | **REVERTED** |
| `apps/api/src/app.module.ts` | `ImpersonationModule` import | Module wiring | **REVERTED** |
| `apps/api/prisma/schema.prisma` | `ImpersonationSession` model, `ImpersonationMode` enum, User/Tenant relations | DB schema | **REMOVED** |
| `apps/api/prisma/migrations/20260302090000_add_impersonation_sessions/` | CREATE TABLE impersonation_sessions, CREATE TYPE ImpersonationMode | DB migration | **REMOVED** |
| `packages/contracts/openapi.yaml` | `/admin/impersonation/start`, `/admin/impersonation/stop`, `/admin/impersonation/status`, 6 schemas | API contract | **REMOVED** |
| `packages/sdk/src/generated/api.d.ts` | Generated SDK methods for impersonation endpoints | SDK | **REGENERATED** |
| `apps/admin/src/components/impersonation-banner.tsx` | `ImpersonationBanner` component, polling, Stop button | Admin UI | **REMOVED** |
| `apps/admin/src/app/(protected)/layout.tsx` | `<ImpersonationBanner />` in shell layout | Admin UI | **REVERTED** |
| `apps/admin/src/app/(protected)/users/page.tsx` | Modal, state vars, `handleImpersonateStart`, "Act as (Read-only)" button | Admin UI | **REMOVED** |
| `apps/operator/src/components/impersonation-banner.tsx` | `ImpersonationBanner` component | Operator UI | **REMOVED** |
| `apps/operator/src/app/(protected)/layout.tsx` | `<ImpersonationBanner />` in layout | Operator UI | **REVERTED** |
| `apps/e2e/tests/02-admin-crud.spec.ts` | `test('read-only impersonation blocks writes and can be stopped')` | E2E test | **REMOVED** |
| `OUT/impersonation_openapi.json` | OpenAPI snippet for impersonation paths | Artifact (kept as audit evidence) | LEFT |
| `OUT/impersonation_status_sample.json` | Sample status response | Artifact (kept as audit evidence) | LEFT |

### OpenAPI Paths Found
- `POST /admin/impersonation/start`
- `POST /admin/impersonation/stop`
- `GET /admin/impersonation/status`

### OpenAPI Schemas Found
- `AdminImpersonationStartRequest`
- `AdminImpersonationUser`
- `AdminImpersonationStartResponse`
- `AdminImpersonationStatusInactive`
- `AdminImpersonationStatusActive`
- `AdminImpersonationStatusResponse`

### Cookie/Header Mechanisms
- Cookie name: `pgsims_impersonation` (HMAC-signed, httpOnly)
- No `x-impersonate-*` headers — session managed via cookie only
- Wrote `req.user` override in JWT guard when cookie was present
- Blocked non-GET/HEAD/OPTIONS methods during impersonation (write-blocking)

### Database
- Table: `impersonation_sessions` (15 columns + 3 indexes)
- Enum: `ImpersonationMode` (READ_ONLY)
- Foreign keys to `users` (startedBy, impersonatedUser) and `tenants`
