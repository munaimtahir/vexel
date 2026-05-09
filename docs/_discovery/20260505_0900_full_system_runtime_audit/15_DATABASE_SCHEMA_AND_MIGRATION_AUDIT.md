# 15_DATABASE_SCHEMA_AND_MIGRATION_AUDIT.md

Status: IN PROGRESS (static schema inventory started; runtime migration status pending)

## Prisma Schema Inventory

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/79_prisma_models_list.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/83_prisma_model_tenant_matrix.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/84_prisma_models_without_tenantId_blocks.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/81_prisma_unique_indexes.txt`

Observed:
- Prisma schema present at `apps/api/prisma/schema.prisma`.
- Broad coverage includes LIMS (patients/encounters/lab orders/results/specimens), deterministic docs (documents/templates), auth (users/roles/refresh tokens), ops/jobs, and OPD domain models (suite-mode signal).

Potential tenancy hotspots (static):
- Models without `tenantId` exist; intent needs validation to ensure no cross-tenant leakage through joins/queries. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/84_prisma_models_without_tenantId_blocks.txt`

## Migrations

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/150_prisma_migrations_list.txt`

Status: NOT VERIFIED
- Migration application status (prisma migrate status) requires DB connectivity and is covered under runtime boot and test phases.
