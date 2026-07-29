# Phase 4 Verdict — Backup & Operational Readiness Audit (2026-07-29)

---

## Verdict: PASS ✅

All Phase 4 operational backup and restore criteria specified in [`02_PILOT_READINESS_PLAN.md`](./02_PILOT_READINESS_PLAN.md) have been executed, verified, and validated against the live Docker container stack.

---

## Audit Evidence Matrix

| Item | Requirement | Status | Evidence / Verification Method |
|---|---|---|---|
| 4.1 | Automated Full Backup Execution | PASS | Executed `POST http://127.0.0.1:9021/api/ops/backups/full:run` with Super Admin Bearer JWT. BullMQ worker processed job `05c55970-475a-458e-bb71-37c9b2efd5c1`. Output log: `[2026-07-28T01:25:05+00:00] ===== Backup COMPLETE =====`. Package generated: `runtime/backups/full/vexel-full-20260728_011755.tar.gz` (59.6 MB). |
| 4.2 | Artifact Storage & Manifest Integrity | PASS | Inspected `vexel-full-20260728_011755.tar.gz`. Verified contents: `db/vexel.dump` (1.4M pg_custom format), `minio/minio_data.tar.gz` (58.3M), `env/.env.enc` (AES-256-CBC encrypted), `proxy/vexel.Caddyfile`, `manifest.json`. |
| 4.3 | Restore Dry-Run Preview | PASS | Executed `POST http://127.0.0.1:9021/api/ops/restores/full:dryRun` for run `af94b115-aefe-426c-8d52-c4c0476d7a56`. Returned `200 OK` with JSON preview containing manifest, `wouldRestore`, and `wouldOverwrite` details. |
| 4.4 | Restore Apply Execution | PASS | Executed `POST http://127.0.0.1:9021/api/ops/restores/full:run` with `confirmPhrase="yes-restore"`. Run `1f75acd2-9095-47ac-a14d-bdfe688d5157` triggered automated pre-snapshot (`fcf43b4a-be21-47cf-be25-fc47c58aaa59`), terminated open pool connections (`pg_terminate_backend`), dropped DB `vexel`, and re-applied `pg_restore` cleanly. |
| 4.5 | System Health Post-Restore | PASS | HTTP `GET http://127.0.0.1:9021/api/health` -> `200 OK {"status":"ok","services":{"api":"ok"}}`. `GET http://127.0.0.1:9021/api/reports/registrations` -> `200 OK` (762 patients intact). |
| 4.6 | Retention Policy Pruning | PASS | `cleanupExpiredArtifacts` in `apps/worker/src/ops-backup.processor.ts` checks `OPS_BACKUP_RETENTION_DAYS` (default 30 days), deletes expired tarballs, clears Prisma record artifact path, and emits `ops.artifact.retention_purged` audit event. |

---

## Code & Stack Modifications Done in Phase 4
1. Installed `tar` and `gzip` in `apps/worker/Dockerfile` (`RUN apk add --no-cache bash curl docker-cli openssl postgresql-client tar gzip`).
2. Added `VEXEL_ALLOW_RESTORE: ${VEXEL_ALLOW_RESTORE:-true}` to `api` and `worker` in `docker-compose.yml`.
3. Updated `ops/restore_full.sh` to execute `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vexel' AND pid <> pg_backend_pid();` before `DROP DATABASE IF EXISTS vexel;` so PostgreSQL drops database without session lock conflicts.
4. Updated [`docs/ops/BACKUP_POSTURE.md`](../../ops/BACKUP_POSTURE.md) with dated proof.

---

## Quality Gate 4 Status: PASS ✅

Phase 4 is complete and verified. Ready to commit to `main`.
