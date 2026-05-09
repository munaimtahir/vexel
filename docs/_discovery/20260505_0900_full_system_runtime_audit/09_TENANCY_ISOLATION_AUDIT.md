# 09_TENANCY_ISOLATION_AUDIT.md

Status: IN PROGRESS (static review started; runtime tenant A/B tests pending)

## Tenant Resolution (Request Context)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_tenant_tenant-resolver.middleware.ts.txt`

Observed:
- Production path: resolves tenant by `req.hostname` via `TenantService.findByDomain(host)`; if found, calls `setTenantId(req, tenant.id)`.
- Dev override: accepts `x-tenant-id` only when `TENANCY_DEV_HEADER_ENABLED === 'true'`.

Initial assessment: PASS (matches locked baseline), pending runtime confirmation of Host mapping behavior.

## Prisma Schema TenantId Coverage (Heuristic)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/83_prisma_model_tenant_matrix.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/84_prisma_models_without_tenantId_blocks.txt`

Observed:
- Majority of domain models include `tenantId: True` (patients/encounters/documents/catalog/opd/etc.).
- Models without `tenantId` detected (requires intent review): `Tenant`, `RefreshToken`, `UserRole`, `RolePermission`, `TemplateBlueprint`, `WorkerHeartbeat`, `OpsScheduleTarget`.

Risk notes (static, not yet verified):
- Some non-tenant tables are expected (e.g., `Tenant` itself, worker heartbeat).
- Join tables without `tenantId` can still be safe if they reference tenant-scoped parents and are never queried without parent scoping; this requires query review + runtime testing.

## Runtime Isolation Verification

Status: NOT VERIFIED (requires boot + safe test data)

Planned runtime checks (when stack boots):
- Tenant A creates patient/encounter; Tenant B attempts to list/get the same records → expect empty/404/403.
- Dev header override gated by env (`TENANCY_DEV_HEADER_ENABLED`) → confirm ignored when disabled.
