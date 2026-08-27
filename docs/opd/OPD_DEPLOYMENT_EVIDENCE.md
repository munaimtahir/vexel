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

Historical platform deployment evidence is excluded from OPD readiness. Current OPD evidence does not demonstrate complete production-like workflow, PDF runtime, migration reconciliation, or OPD-specific rollback verification.
