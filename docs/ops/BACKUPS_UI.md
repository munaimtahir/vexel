# Backup Management Console — Usage Guide

The Ops → Backups console in the Admin app provides a complete web UI for managing backups, restores, and monitoring.

## Access

- URL: `https://vexel.alshifalab.pk/admin/ops`
- Required permission: `ops.view` (view), `ops.run_backup` (trigger backups), `ops.restore` (restore)

## Pages

### Ops Dashboard (`/ops`)
Overview of the backup system:
- **Last Full Backup** — status, time, artifact size
- **Last Healthcheck** — pass/fail summary
- **Storage Targets** — enabled count / total
- **Recent Runs** — last 5 operations with status badges
- **Quick Actions**: Run Full Backup, Run Healthcheck, Export Tenant

### Full Backups (`/ops/backups`)
List of all full backup runs with filters:
- Filter by status: ALL | QUEUED | RUNNING | SUCCEEDED | FAILED
- Per-run: view details, view logs, artifact path

### Create Backup (`/ops/backups/new`)
Wizard to trigger a new full backup:
1. Select components: DB dump, MinIO volume, Caddy routing config
2. Select storage target (local by default)
3. Submit → job is queued, run ID is returned immediately
4. View progress in logs viewer

**What a full backup includes:**
- PostgreSQL database dump (`pg_dump` custom format)
- MinIO data volume (tar archive)
- Encrypted env snapshot (`openssl AES-256-CBC`)
- Vexel Caddy routing file (`runtime/proxy/vexel.Caddyfile`)
- `manifest.json` with checksums and metadata

### Tenant Exports (`/ops/tenants`)
Export a single tenant's data:
1. Enter tenant ID
2. Click "Export Tenant" → job queued
3. Artifact contains CSV exports of all 35 tenant-scoped tables filtered by `tenantId`

> ⚠️ Tenant exports are read-only — they do NOT delete source data.

### Restore Center (`/ops/restore`)

> ⛔ **DANGER ZONE** — Restore is destructive and will overwrite current database state.

**Steps:**
1. Select a succeeded full backup artifact from the list
2. Click **"Run Dry Run"** — shows restore plan (what will be overwritten)
3. Review the plan carefully
4. Enable "Pre-snapshot before restore" (default: ON — always recommended)
5. Type confirmation phrase: `yes-restore`
6. Click **"Apply Restore"** — the restore job is queued
7. After restore completes, a healthcheck runs automatically

**What restore does:**
- Takes pre-snapshot (if enabled)
- Drops and recreates the `vexel` database
- Restores from pg_dump artifact
- Restores MinIO data
- Restores Caddy routing config + relinks symlink
- Reloads Caddy

### Schedules (`/ops/schedules`)
Configure recurring backup jobs:
- Type: `FULL_BACKUP` or `TENANT_EXPORT`
- Cron expression (e.g., `0 2 * * *` = every day at 2am)
- Toggle enable/disable
- Retention policy (JSON)

> ⚠️ **Note:** Scheduled jobs run via BullMQ worker. The worker must be running for schedules to execute.
> Current implementation: schedules are stored in DB but the cron trigger (e.g., cron job calling the API) must be wired separately.

### Storage Targets (`/ops/storage`)
Configure where backup artifacts are stored:

| Type | Description |
|------|-------------|
| `LOCAL` | Default — writes to `/srv/apps/vexel/runtime/backups/` |
| `S3` | Upload to S3-compatible endpoint (MinIO or AWS) |
| `SSH` | rsync to remote SSH server |
| `GDRIVE` | Google Drive (future) |

Use **"Test Connection"** to verify a storage target is reachable before use.

### Logs (`/ops/logs`)
- Left pane: list of recent runs (all types)
- Right pane: log content for selected run
- Auto-refreshes every 3s for RUNNING jobs

Log files are stored at: `/srv/apps/vexel/runtime/data/logs/ops_<type>_<runId>.log`

---

## Running Backups from the CLI

See [ops/README.md](../../ops/README.md) for CLI-based backup commands.

---

## RBAC Permissions

| Permission | Grants |
|-----------|--------|
| `ops.view` | View dashboard, runs, logs, storage, schedules |
| `ops.run_backup` | Trigger full backups and healthchecks |
| `ops.export_tenant` | Trigger tenant exports |
| `ops.configure_schedules` | Create/update/toggle schedules |
| `ops.configure_storage` | Create/update/toggle/test storage targets |
| `ops.restore` | Trigger dry-run and apply restores (highest risk) |

Assign via Admin → Roles.
