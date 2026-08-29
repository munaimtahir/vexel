# OPD Production Runbook

**Release status:** `NOT READY` — this runbook supports verification only; it does not authorize production enablement.

## Preflight

1. Confirm `docs/opd/OPD_RELEASE_READINESS.md` is `OPD PRODUCTION READY` before any production enablement.
2. Capture a full backup and verify restore to an isolated database.
3. Export/count all legacy OPD tables before retirement; compare reconciled canonical counts and retain the signed artifact.
4. Run Prisma validation, migration status, SDK freshness, typechecks, builds, unit/integration/security/concurrency/document tests, and Playwright with least-privilege OPD personas.
5. Confirm dependency scan has no Critical/High finding.

## Local verification commands

```bash
DATABASE_URL=postgresql://vexel:vexel@127.0.0.1:5433/vexel pnpm --filter @vexel/api exec prisma validate
pnpm check:sdk-freshness
pnpm typecheck
pnpm build
pnpm --filter @vexel/api test -- --runInBand
docker compose config --quiet
docker compose up -d
docker compose ps
```

Enable `module.opd` and required canonical subfeatures through the audited tenant feature-flag API/Admin UI. Do not edit workflow state or flags directly in production SQL.

## Smoke sequence

Use a dedicated tenant and least-privilege users to verify: login, disabled-feature denial, patient registration, appointment/queue linkage, intake, clinician ownership denial/allow, draft/sign, prescription publish, invoice/partial payment/refund, document render/download, audit/correlation IDs, reload persistence, invalid transition, logout, restart recovery, and cross-tenant denial.

Record request IDs, entity IDs, document hashes, test output, screenshots/traces, migration counts, and backup/restore identifiers in a dated immutable evidence directory.

## Failure and rollback

- Disable `module.opd` through the audited API to stop new OPD work.
- Preserve database, Redis/job, application, proxy, and object-storage evidence.
- Retry failed documents only through the authorized retry command after root cause is understood.
- Do not reverse a destructive schema migration ad hoc. Restore the verified pre-deploy snapshot or execute an approved forward reconciliation plan.
- Escalate any tenant-isolation, financial-integrity, immutable-record, or document-hash mismatch as a release-blocking incident.
