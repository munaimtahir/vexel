# Ops Backup Hardening — Implementation Summary

Date: 2026-03-07

## Scope applied
This remediation implemented FIX-01, FIX-02, FIX-03, FIX-04, FIX-06, FIX-07, FIX-08, and FIX-09 from `OUT/ops_backup_audit/ops_backup_fix_plan.md` with minimal blast radius.

## What was changed

1. Worker runtime wiring (FIX-01)
- Worker now has required runtime tools: `bash`, `curl`, `docker-cli`, `openssl`, `postgresql-client`.
- Worker now mounts:
  - Docker socket (`/var/run/docker.sock`)
  - persistent runtime directory (`./runtime`)
  - ops scripts (`./ops` read-only)
  - `docker-compose.yml` (read-only)
  - `.env` (read-only)
- Worker env wiring added:
  - `VEXEL_ROOT`, `VEXEL_RUNTIME_DIR`
  - `BACKUP_PASSPHRASE`
  - `VEXEL_ALLOW_RESTORE`
  - `OPS_BACKUP_RETENTION_DAYS`
- Backup/restore shell work dirs moved from container-local `/tmp` to mounted runtime (`$VEXEL_ROOT/runtime/tmp`) so Docker-socket operations can access mounted host paths.

2. Restore pre-snapshot coherence bug (FIX-02)
- Removed fabricated pre-snapshot ID flow.
- Added `createRestorePreSnapshotRun(...)` helper that creates a real `OpsBackupRun` + audit event before pre-snapshot execution.
- Pre-snapshot run now receives proper lifecycle updates (`QUEUED -> RUNNING -> SUCCEEDED|FAILED`).

3. Correlation ID retry-safe behavior (FIX-03)
- Added idempotent correlation handling in all trigger methods.
- If an existing run uses the same correlation ID and same run type, service returns the existing run instead of failing.
- If correlation ID is reused for a different run type, API returns `409 Conflict`.
- Prevents retry 500s caused by unique `correlationId` collisions while preserving traceability.

4. OPS permission seeding (FIX-04)
- Seeded to super-admin role:
  - `ops.view`
  - `ops.run_backup`
  - `ops.export_tenant`
  - `ops.configure_schedules`
  - `ops.configure_storage`
- `ops.restore` remains intentionally unseeded by default.

5. Explicit restore env guard (FIX-06)
- Added API-level restore guard for both dry-run and apply endpoints (`OpsService.ensureRestoreEnabled`).
- Added restore script guard (`restore_full.sh`) requiring `VEXEL_ALLOW_RESTORE=true`.
- Guarded attempts are audited as blocked actions.
- Restore remains fail-closed by default.

6. Backup passphrase env hardening (FIX-07)
- Removed insecure runtime fallback from worker processor.
- In `backup_full.sh`, production now fails if `BACKUP_PASSPHRASE` is missing.
- Dev mode keeps explicit dev-only fallback for ergonomics.
- `.env.example` updated with required vars.

7. Retention/cleanup (FIX-08)
- Added worker-side retention cleanup (`cleanupExpiredArtifacts`) for `FULL` and `TENANT_EXPORT` artifacts.
- Retention controlled by `OPS_BACKUP_RETENTION_DAYS` (default 30).
- Cleanup skips current/in-progress runs and logs/audits purge operations.

8. Schedule behavior clarity (FIX-09)
- No fake scheduler added.
- Admin schedules page now clearly states execution is external/manual in this release.
- Docs updated to state schedules are policy records; execution responsibility is external.

9. Restore UI safety clarity
- Restore page warning updated to explicitly mention env guard requirement.

10. Documentation updates
- Added `docs/ops/BACKUPS.md` as the current operational source for:
  - capabilities/limits
  - storage path
  - retention
  - required env vars
  - permission model
  - restore disabled-by-default policy
  - staging drill requirement
