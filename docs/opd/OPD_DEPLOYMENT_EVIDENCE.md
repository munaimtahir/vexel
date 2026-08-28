# OPD Deployment Evidence

**Release decision:** `NOT READY`

## Required production-like checks

- API, worker, PDF, Admin, Operator, PostgreSQL, Redis, and Caddy start from clean configuration.
- Required environment variables and tenant host resolution are verified.
- Additive migrations apply to empty and representative databases with reconciliation evidence.
- Health checks, structured logs, correlation IDs, audit visibility, metrics, alerts, and document retry operations are verified.
- Backup/restore and rollback implications are documented and tested.
- OPD deployment smoke tests complete a tenant-scoped workflow and verify negative tenant/permission cases.

## Current evidence boundary

Historical platform deployment evidence is excluded from OPD readiness. On 2026-08-28, the current Compose stack was rebuilt and checked: Compose configuration validated, all services reported healthy, 28 Prisma migrations were up to date, Prisma schema validation passed, API health returned 200 with a correlation ID, and Host-based resolution using `admin.localhost` returned successfully. The paid-invoice receipt command also returned 200 through the rebuilt API.

This remains partial evidence: it is not a clean empty-database deployment, does not prove additive legacy reconciliation, rollback rehearsal, public Caddy routing, or the complete OPD production workflow.
