# Backup Posture & Revalidation Proof (Updated 2026-07-29)

## Current Posture
- In-app Ops backups are available for full backups (`POST /api/ops/backups/full:run`) and tenant exports (`POST /api/ops/backups/tenant:run`).
- Artifacts are stored on local persistent runtime storage (`runtime/backups/full/`).
- Retention is enforced via `OPS_BACKUP_RETENTION_DAYS` (default: 30 days) and automated purge (`ops.artifact.retention_purged` audit event).
- Full backup packages contain:
  1. PostgreSQL custom-format database dump (`vexel.dump`)
  2. Encrypted `.env` file (AES-256-CBC with PBKDF2)
  3. Caddy reverse-proxy configuration (`vexel.Caddyfile`)
  4. MinIO S3 object storage volume tarball (`minio_data.tar.gz`)
  5. JSON metadata manifest (`manifest.json`)
- Restore safety guard: `VEXEL_ALLOW_RESTORE=true` required, along with mandatory dry-run preview and `confirmPhrase="yes-restore"` confirmation payload. Pre-snapshot automatically runs before applying any restore.

## Dated Verification Proof (2026-07-29)
- **Full Backup Execution**:
  - Request: `POST http://127.0.0.1:9021/api/ops/backups/full:run` (Bearer Super Admin JWT)
  - Run ID: `05c55970-475a-458e-bb71-37c9b2efd5c1`
  - Generated Artifact: `runtime/backups/full/vexel-full-20260728_011755.tar.gz` (59.6 MB)
  - Result: `SUCCEEDED` (verified DB dump 1.4M + MinIO 58.3M archived)
- **Restore Dry-Run Execution**:
  - Request: `POST http://127.0.0.1:9021/api/ops/restores/full:dryRun`
  - Run ID: `af94b115-aefe-426c-8d52-c4c0476d7a56`
  - Result: `SUCCEEDED` (returned JSON restore plan containing `wouldRestore` and `wouldOverwrite` arrays)
- **Restore Apply Execution**:
  - Request: `POST http://127.0.0.1:9021/api/ops/restores/full:run` with `confirmPhrase="yes-restore"`
  - Run ID: `1f75acd2-9095-47ac-a14d-bdfe688d5157`
  - Pre-snapshot Run ID: `fcf43b4a-be21-47cf-be25-fc47c58aaa59` (`vexel-full-20260729_143827.tar.gz` 59.6MB created prior to restore)
  - Restore Action: Active DB connections terminated via `pg_terminate_backend`, `vexel` database dropped and recreated, `pg_restore` applied cleanly.
  - API Health Post-Restore: `GET /api/health` -> `200 OK`, `GET /api/reports/registrations` -> `200 OK` (762 patients intact).

## Guardrails
- `BACKUP_PASSPHRASE` is required in production.
- `VEXEL_ALLOW_RESTORE` must remain `false` in production environments unless performing maintenance.
- Restores require `confirmPhrase="yes-restore"` in payload.
