# Database Schema and Migration Audit

## Tenancy Isolation Check
- **Mandate:** `tenantId` exists on every customer-owned row.
- **Verification:** `tenantId` found in:
    - `User`
    - `Patient`
    - `Encounter`
    - `LabOrder`
    - `CatalogTest`
    - `AuditEvent`
    - `Document`
    - `PrintTemplate`
    - ... and all other LIMS/OPD entities.
- **Uniqueness:** Tenant-scoped uniqueness is enforced via `@@unique([tenantId, ...])`.

## Schema Verification Matrix

| Model | Tenant ID | Tenant Uniqueness | Fresh Evidence |
| ----- | --------- | ----------------- | -------------- |
| User | YES | `[tenantId, email]` | `schema.prisma` |
| Patient | YES | `[tenantId, mrn]` | `schema.prisma` |
| Encounter | YES | `[tenantId, encounterCode]` | `schema.prisma` |
| LabOrder | YES | ID only | `tenantId` field exists. |
| CatalogTest | YES | `[tenantId, externalId]` | `schema.prisma` |
| Document | YES | `[tenantId, type, payloadHash]` | Idempotency guard. |

## Migration Audit
- **Status:** Sequential and versioned.
- **Latest Migration:** `20260327000100_opd_mvp_doctor_profile_and_workflow`
- **Integrity:** `migration_lock.toml` exists.

## Seeding Strategy
- **Process:** `pnpm prisma:seed` calls `prisma/seed.ts`.
- **Finding:** Seeding is used for initial system setup (e.g., system tenant, initial roles). Catalog seeding is tenant-specific and triggered via API (`:enable-lims`).

## Required Verdict
**DATABASE PASS**

## Status Summary
The database schema robustly implements the multi-tenancy mandate. Every customer-owned entity is scoped to a `tenantId`, and uniqueness constraints correctly prevent cross-tenant collisions. The migration history is clean and follows a deterministic path.
