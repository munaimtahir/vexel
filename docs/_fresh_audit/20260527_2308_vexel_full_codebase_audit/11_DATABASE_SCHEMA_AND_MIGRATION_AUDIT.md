# Database Schema and Migration Audit (Prisma)

Primary evidence:
- Prisma model list: `logs/phase8_prisma_models.txt`
- TenantId hits: `logs/phase8_prisma_tenantid_hits.txt`
- Tenancy matrix (heuristic): `db/prisma_model_tenancy_matrix.json` and `.csv`
- Migration list: `logs/phase8_migration_sql_list.txt`, `logs/phase8_ls_migrations.txt`

## Prisma schema location
- `apps/api/prisma/schema.prisma`

## Model inventory
- Total models discovered (by scanning `schema.prisma`): 54 (Evidence: `logs/phase8_prisma_models.txt`)

## Tenancy coverage (static heuristic)

This run generated a simple model→`tenantId` presence matrix by parsing `schema.prisma` blocks.

Models without a `tenantId` field (count: 7):
- `Tenant` (expected global root)
- `RefreshToken` (potential risk; needs auth/tenancy review)
- `RolePermission` (join table; may be global by design)
- `UserRole` (join table; may derive tenancy via User/Tenant)
- `TemplateBlueprint` (unclear; needs templates contract review)
- `WorkerHeartbeat` (likely global/system)
- `OpsScheduleTarget` (unclear; ops scheduler targets may be global)

Evidence:
- `db/prisma_model_tenancy_matrix.csv`

Interpretation note:
- Presence/absence of `tenantId` alone is not sufficient to judge correctness. Some system/global tables are expected to be global. Final tenancy verdict requires runtime isolation proof (Phase 9).

## Migrations
- Migration SQL files found: 26 (Evidence: `logs/phase8_migration_sql_list.txt`)
- Latest migrations observed (by filename ordering) include OPD-related migrations and ops backup tables. (Evidence: `logs/phase8_migration_sql_list.txt`)

Not yet verified here:
- Applied migration status on the current database (`prisma migrate status`)
- Drift between DB and schema
- Runtime query tenant filtering

These are covered in Phase 18 (Docker runtime) and Phase 9 (Tenancy runtime audit).

