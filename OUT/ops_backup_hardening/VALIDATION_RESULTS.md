# Validation Results

Date: 2026-03-07

## 1) Test results

### Targeted API tests
Command:
`pnpm --filter @vexel/api test -- src/ops/__tests__/ops.service.spec.ts src/ops/__tests__/ops-backup.processor.spec.ts src/ops/__tests__/ops-backup.retention.spec.ts src/rbac/permissions.guard.spec.ts`

Result:
- PASS `ops.service.spec.ts`
- PASS `ops-backup.processor.spec.ts`
- PASS `ops-backup.retention.spec.ts`
- PASS `permissions.guard.spec.ts`
- Total: 21 tests passed

### Type checks
Command:
`pnpm --filter @vexel/api exec tsc --noEmit && pnpm --filter @vexel/worker exec tsc --noEmit`

Result:
- PASS

## 2) Backup artifact creation path (worker runtime)

### Worker rebuild/restart with new wiring
Command:
`docker compose up -d --build worker`

Result:
- PASS (worker rebuilt/restarted with mounts + runtime tools)

### End-to-end artifact generation from worker container
Command:
`docker compose exec -T worker bash -lc 'bash /home/munaim/srv/apps/vexel/ops/backup_full.sh; ls -1 /home/munaim/srv/apps/vexel/runtime/backups/full | tail -n 5'`

Result:
- PASS
- Artifact created:
  - `/home/munaim/srv/apps/vexel/runtime/backups/full/vexel-full-20260307_043756.tar.gz`

### Persistence after container restart
Command:
`docker compose restart worker && docker compose exec -T worker bash -lc 'test -f /home/munaim/srv/apps/vexel/runtime/backups/full/vexel-full-20260307_043756.tar.gz && echo artifact_persisted'`

Result:
- PASS (`artifact_persisted`)

## 3) Restore disabled-by-default guard

### Script-level guard check
Command:
`docker compose exec -T worker bash -lc '/home/munaim/srv/apps/vexel/ops/restore_full.sh /home/munaim/srv/apps/vexel/runtime/backups/full/vexel-full-20260307_043756.tar.gz --confirm'`

Result:
- PASS (blocked as expected)
- Error observed:
  - `Restore is disabled. Set VEXEL_ALLOW_RESTORE=true to enable.`

### API-level guard check
Covered by unit test in `ops.service.spec.ts`:
- `triggerRestoreRun` rejects by default with explicit guard error and writes blocked audit action.

## 4) BACKUP_PASSPHRASE requirement

### Production-mode guard
Command:
`docker compose exec -T worker bash -lc 'unset BACKUP_PASSPHRASE; NODE_ENV=production /home/munaim/srv/apps/vexel/ops/backup_full.sh'`

Result:
- PASS (fails closed)
- Error observed:
  - `BACKUP_PASSPHRASE is required in production`

## 5) OPS permission seeding

Verification:
- `apps/api/prisma/seed.ts` includes seeded OPS permissions for super-admin:
  - `ops.view`, `ops.run_backup`, `ops.export_tenant`, `ops.configure_schedules`, `ops.configure_storage`
- `ops.restore` remains unseeded by default.

## 6) Correlation retry collision

Coverage:
- `ops.service.spec.ts` now includes retry test proving same-correlation full-backup trigger returns existing run and does not requeue/create duplicate.

## Required status answers

- Artifact generation path now works: **YES**
- Artifact storage location: **`/home/munaim/srv/apps/vexel/runtime/backups/full/`**
- Restore blocked by default: **YES**
- OPS permissions seeded: **YES**
- Retry collision fixed: **YES**
- Intentionally deferred:
  - Native in-app schedule executor (execution remains external/manual)
  - S3/MinIO storage-target execution path beyond local artifact storage
