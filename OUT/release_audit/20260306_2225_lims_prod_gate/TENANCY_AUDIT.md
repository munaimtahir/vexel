# Tenancy Audit — LIMS Production Gate

## Schema-Level Isolation

### tenantId on all customer-owned models
Verified by direct schema inspection (`apps/api/prisma/schema.prisma`):

| Model | tenantId field | Tenant-scoped unique | Notes |
|-------|---------------|---------------------|-------|
| Tenant | (root) | — | — |
| User | ✅ | `@@unique([tenantId, email])` | |
| Role | ✅ | `@@unique([tenantId, name])` | |
| Patient | ✅ | `@@unique([tenantId, mrn])` | |
| Encounter | ✅ | — | |
| LabOrder | ✅ | — | |
| Specimen | ✅ | — | |
| SpecimenItem | ✅ | `@@unique([tenantId_encounterId_catalogSpecimenType])` | |
| LabResult | ✅ | — | |
| Document | ✅ | `@@unique([tenantId, type, templateId, payloadHash])` | |
| CatalogTest | ✅ | `@@unique([tenantId, name])` | |
| Parameter | ✅ | — | |
| TenantFeature | ✅ | `@@unique([tenantId, key])` | |
| AuditEvent | ✅ | — | |
| CashTransaction | ✅ | — | |

**Result: PASS** — All customer-owned entities have `tenantId`.

## Service-Layer Isolation

All service methods inspected accept `tenantId` as first argument and pass it to every Prisma query as a `where` clause filter:

- `EncountersService.list()` → `where: { tenantId, moduleType: 'LIMS' }`
- `EncountersService.getEncounterOrThrow()` → `where: { id, tenantId }`
- `PatientsService.findByMobile()` → `where: { tenantId, mobile }`
- `PatientsService.create()` → validates uniqueness with `tenantId`
- `DocumentsService.generate()` → `findUnique` uses full `tenantId_type_templateId_payloadHash` index

**Result: PASS** — Service layer enforces tenant filter on every operation.

## Tenant Resolution

- Production: resolved via `Host` header matched against `TenantDomain` table
- Dev override: `TENANCY_DEV_HEADER_ENABLED=true` allows `x-tenant-id` header
- **Production container:** `TENANCY_DEV_HEADER_ENABLED=false` — confirmed from running container

**Result: PASS**

## Cross-Tenant Isolation Live Test

**Status: UNVERIFIED** — Only one tenant (`system`) exists in the production database. A second tenant is required to prove cross-tenant read blocking at runtime. Code review confirms correct `tenantId` filtering but no live cross-tenant probe was possible.

## Super-Admin Access

- `isSuperAdmin` flag is read from DB on every request (not from JWT claim) — `jwt.strategy.ts` confirmed
- Super-admin bypasses RBAC permission checks — this is explicit and by design
- Super-admin users are documented and audited

**Result: PASS (by design)**

## JWT Tenant Binding

- `tenantId` is embedded in the JWT payload at login
- JWT strategy loads `isSuperAdmin` from DB (not JWT) per request
- Users with `status !== 'active'` are rejected per-request via DB lookup

**Result: PASS** — Tenant context is validated server-side on every protected request.
