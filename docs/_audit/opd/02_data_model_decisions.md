# OPD Data Model Decisions

## Decision summary
- Reused KMVP OPD model family instead of creating another parallel abstraction.
- Extended existing OPD models minimally to support locked MVP.

## Schema updates
- `OpdDoctor` enriched with doctor profile + print identity fields:
  - designation, degrees, pmdcNumber, phcNumber, clinicName, clinicAddress, clinicPhone, signatureLabel, signatureUrl.
- `OpdEncounter` workflow/status moved to locked model:
  - `DRAFT | READY_FOR_PRINT | COMPLETED | CANCELLED`
  - added terminal metadata: `cancelledAt`, `cancelledReason`, `completedAt`.
- `OpdNote` enriched for diagnosis/advice/follow-up/investigation/remarks fields.

## Tenancy and constraints
- Tenant scoping remains explicit on all OPD records (`tenantId`).
- Doctor code uniqueness remains tenant-scoped.
- Encounter uniqueness remains tenant-scoped (`visitCode`, `encounterId`).
- Service-layer reads/writes remain tenant-filtered.

## Migration
- Added migration:
  - `apps/api/prisma/migrations/20260327000100_opd_mvp_doctor_profile_and_workflow/migration.sql`
- Includes additive columns and status mapping from previous OPD values to locked statuses.
