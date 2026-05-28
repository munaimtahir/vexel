# Tenancy Static and Runtime Audit

This platform must maintain structural tenancy even if operating in “single-tenant mode”.

Primary evidence:
- Tenant resolver middleware: `logs/phase9_tenant_resolver_middleware.ts`
- Tenant list response: `runtime-responses/tenants_list.json`
- Tenant creation response: `runtime-responses/tenantb_create.json`
- Users controller/service (tenant scoping behavior): `logs/phase9_users_controller.ts`, `logs/phase9_users_service.ts`
- Auth login ambiguity proof (same email in 2 tenants): `runtime-responses/auth_login_shared.payload.json`, `runtime-responses/userb_create.json`, `runtime-responses/userb2_create.json`
- Playwright smoke tenancy checks: `test-results/phase16_e2e_smoke.rerun.txt`, `e2e/test-results/results.json`, `e2e/playwright-report/index.html`

## Static tenancy enforcement

### Tenant context resolution
`TenantResolverMiddleware` behavior:
1. If `TENANCY_DEV_HEADER_ENABLED === 'true'`, and request includes `x-tenant-id`, the middleware sets tenantId from header.
2. Otherwise, it uses `req.hostname` and resolves tenant via `TenantDomain` (`tenantService.findByDomain(host)`).
(Evidence: `logs/phase9_tenant_resolver_middleware.ts`, `apps/api/src/tenant/tenant.service.ts`)

### Tenant scoping in controllers
Many domain controllers use:
- `getTenantId(req) ?? (req as any).user.tenantId`
Meaning: once authenticated, tenant scoping is commonly derived from the authenticated user payload.
(Evidence: `logs/phase9_getTenantId_usage.txt`)

## Runtime tenancy verification

### 1) Tenant domains and existence
From `GET /api/tenants`:
- The `system` tenant exists with domains including `localhost` and `vexel.alshifalab.pk`.
(Evidence: `runtime-responses/tenants_list.json`)

### 2) Cross-tenant access prevention via spoofed header
Playwright smoke includes “Tenant Isolation” tests confirming that “spoofed tenant header” does not leak system-tenant data.
This indicates the dev header override is not enabled in the test/runtime environment, and tenant header spoofing is ineffective.
(Evidence: `test-results/phase16_e2e_smoke.rerun.txt`, `e2e/test-results/results.json`)

### 3) Multi-tenant operability (critical)

This run created a second tenant (“Tenant B”) successfully via `POST /api/tenants` (super-admin).
(Evidence: `runtime-responses/tenantb_create.json`)

However, tenant operationalization has critical gaps:

1. Auth/login is not tenant-scoped by domain or tenant context:
   - `AuthService.login()` selects the user by `email` only (`findFirst`), even though schema allows duplicates across tenants (`@@unique([tenantId, email])`).
   - Runtime proof: after creating `shared@example.com` in *two* tenants, login consistently returns the **system tenant** user (JWT payload `tenantId: system`).
   (Evidence: `logs/phase10_auth_service.ts`, `runtime-responses/auth_login_shared.payload.json`, user creation responses.)

2. Tenant B user provisioning is not achievable through the published “tenant-scoped” contract alone:
   - Backend supports `tenantId` in `POST /api/users` body for super-admin (to target tenant), but OpenAPI `createUser` schema does not include `tenantId`.
   - Role assignment and role creation are tenant-scoped to the actor tenant, and do not provide a super-admin cross-tenant targeting pathway in the contract.
   (Evidence: `logs/phase9_users_controller.ts`, `logs/phase9_roles_controller.ts`, OpenAPI excerpt lines in `packages/contracts/openapi.yaml` shown in Phase 9 work.)

Net impact:
- Structural tenant schema exists, but **multi-tenant operating mode is not currently safe/usable** due to login ambiguity and incomplete cross-tenant admin pathways.

## Tenancy verdict (this run)

**TENANCY PARTIAL**

Rationale:
- PASS: tenant-domain resolution exists; spoofed `x-tenant-id` access does not leak data (runtime-tested via Playwright smoke).
- FAIL (for multi-tenant readiness): authentication is not tenant-aware for duplicate emails; tenant B cannot be safely operated without contract drift and additional admin pathways.

