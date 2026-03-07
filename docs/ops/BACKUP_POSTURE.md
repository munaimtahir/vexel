# Backup Posture (MVP)

## Current posture
- In-app Ops backups are available for full backups and tenant exports.
- Artifacts are stored on local persistent runtime storage.
- Retention is enforced via `OPS_BACKUP_RETENTION_DAYS` (default: 30).
- Restore remains disabled by default and requires explicit env enablement.

## Guardrails
- `BACKUP_PASSPHRASE` is required in production.
- `VEXEL_ALLOW_RESTORE` must remain `false` in ordinary environments.
- `ops.restore` permission is intentionally not seeded by default.

## Operational note
- Schedule records exist, but schedule execution is external in this release.

## Detailed runbook
- See [`docs/ops/BACKUPS.md`](./BACKUPS.md).
