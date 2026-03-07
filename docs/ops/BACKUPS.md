# Vexel Ops Backups (Current Behavior)

## Scope

The in-app Ops subsystem supports:
- Full backup job trigger (`ops.run_backup`)
- Tenant export trigger (`ops.export_tenant`)
- Run/status/log inspection (`ops.view`)
- Storage/schedule configuration records

It does not yet provide:
- Native in-app cron execution engine (schedules are policy records only)
- S3/MinIO upload lifecycle execution from storage-target config
- Production restore enablement by default

## Storage Path

Artifacts are written to host-persistent runtime storage:
- Full backups: `/home/munaim/srv/apps/vexel/runtime/backups/full`
- Tenant exports: `/home/munaim/srv/apps/vexel/runtime/backups/tenants`
- Logs: `/home/munaim/srv/apps/vexel/runtime/data/logs`

Worker runtime assumptions:
- `VEXEL_ROOT=/home/munaim/srv/apps/vexel`
- `VEXEL_RUNTIME_DIR=/home/munaim/srv/apps/vexel/runtime`
- Docker socket mount: `/var/run/docker.sock`
- Ops scripts mount: `./ops -> /home/munaim/srv/apps/vexel/ops` (read-only)
- Runtime mount: `./runtime -> /home/munaim/srv/apps/vexel/runtime`

## Retention Policy

- `OPS_BACKUP_RETENTION_DAYS` (default `30`) controls local artifact cleanup.
- Cleanup runs after successful FULL and TENANT_EXPORT jobs.
- Only `SUCCEEDED` runs older than cutoff are eligible.
- Current run and in-progress runs are never purged.
- Purge events are logged and audited (`ops.artifact.retention_purged`).

## Required Environment Variables

- `BACKUP_PASSPHRASE`: required in production for env snapshot encryption.
  - Production without this value fails backup env encryption path.
  - Dev allows fallback for local ergonomics only.
- `VEXEL_ALLOW_RESTORE`: defaults to `false`.
  - Restore endpoints and restore script reject execution unless set to `true`.
- `OPS_BACKUP_RETENTION_DAYS`: retention window in days.

## Permissions Model

- Seeded to super-admin:
  - `ops.view`
  - `ops.run_backup`
  - `ops.export_tenant`
  - `ops.configure_schedules`
  - `ops.configure_storage`
- Not seeded by default:
  - `ops.restore` (manual explicit grant only)

## Restore Safety Policy

- Restore is disabled by default.
- Running restore requires both:
  - `ops.restore` permission
  - `VEXEL_ALLOW_RESTORE=true`
- API returns explicit guard failure when disabled.
- Guarded attempts are audited.

## Scheduling Responsibility

Schedule records (`/ops/schedules`) are currently configuration/policy only.
Execution is external in this release:
- Trigger via manual admin actions, or
- Trigger via external scheduler (cron/systemd/GitHub Actions) calling Ops API.

## Minimum Smoke Procedure

1. Ensure worker has mounts/tools and env vars from `docker-compose.yml`.
2. Trigger healthcheck:
   - `POST /api/ops/healthcheck:run`
   - Confirm run reaches `SUCCEEDED`.
3. Trigger full backup:
   - `POST /api/ops/backups/full:run`
   - Confirm run reaches `SUCCEEDED`.
4. Verify `artifactPath` exists under runtime backups path.
5. Restart worker container and confirm artifact file remains.

## Before Any Production Restore Enablement

A staging restore drill is mandatory:
- Enable restore only in staging with `VEXEL_ALLOW_RESTORE=true`.
- Execute dry-run and full apply from a real artifact.
- Validate post-restore health and data integrity.
- Keep production restore disabled until drill sign-off.
