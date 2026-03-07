# Ops Backup Truth Map — Vexel

Flow traced: **Admin UI → API → Queue → Worker → Shell → Artifact → Audit**

---

## Full Backup Flow

```
[Admin UI: /ops/backups/new]
    │
    │  POST /ops/backups/full:run  (SDK)
    ▼
[API: OpsController.runFullBackup()]
    │  @RequirePermissions(OPS_RUN_BACKUP)
    │  JwtAuthGuard + PermissionsGuard
    ▼  VERIFIED ✅
[OpsService.triggerFullBackup()]
    │  1. prisma.opsBackupRun.create(type=FULL, status=QUEUED)
    │  2. audit.log('ops.full_backup.queued')
    │  3. queue.add('ops.full_backup.run', { runId })
    ▼  VERIFIED ✅
[Redis queue: 'ops-backup']
    ▼  VERIFIED ✅
[Worker: opsBackupWorker (main.ts:64)]
    │  new Worker('ops-backup', async (job) => processOpsBackup(job, prisma))
    ▼  VERIFIED ✅
[processOpsBackup() — ops-backup.processor.ts]
    │  1. prisma.opsBackupRun.update(status=RUNNING)
    │  2. open log file at LOGS_DIR/ops_full_<runId>.log
    │  3. runFullBackup(runId, meta, logStream, prisma)
    ▼  PARTIAL ⚠️  (processor code correct; container environment missing)
[runFullBackup()]
    │  spawnSync('bash', ['/home/munaim/srv/apps/vexel/ops/backup_full.sh'])
    ▼  MISSING ❌  (path not accessible in container; no docker CLI; no bash)
[ops/backup_full.sh]
    │  1. docker exec vexel-postgres-1 pg_dump → WORK_DIR/db/vexel.dump
    │  2. Copy Caddy config
    │  3. openssl encrypt .env → WORK_DIR/env/.env.enc
    │  4. docker run alpine tar czf MinIO volume → WORK_DIR/minio/minio_data.tar.gz
    │  5. Create manifest.json
    │  6. tar czf BACKUP_DIR/vexel-full-TIMESTAMP.tar.gz
    ▼  PARTIAL ⚠️  (works on host only)
[Artifact: runtime/backups/full/vexel-full-YYYYMMDD_HHMMSS.tar.gz]
    │  Host filesystem — not mounted in container
    ▼  PARTIAL ⚠️
[runFullBackup() continues: sha256 + prisma.opsBackupRun.update(artifactPath, checksum)]
    ▼  VERIFIED ✅ (code correct, conditional on artifact existence)
[processOpsBackup() success: prisma.opsBackupRun.update(status=SUCCEEDED)]
    ▼  VERIFIED ✅
[writeAuditEvent(prisma, run, 'succeeded')]
    ▼  VERIFIED ✅
[Admin UI: polls /ops/runs/{id} — sees SUCCEEDED]
    ▼  VERIFIED ✅ (SDK call, UI exists)
```

| Step | Status |
|------|--------|
| Admin UI → SDK → API endpoint | VERIFIED ✅ |
| RBAC guard on endpoint | VERIFIED ✅ |
| DB run record created (QUEUED) | VERIFIED ✅ |
| Audit log on trigger | VERIFIED ✅ |
| Job enqueued to Redis | VERIFIED ✅ |
| Worker picks up job | VERIFIED ✅ |
| Processor dispatches to runFullBackup | VERIFIED ✅ |
| Container has bash + docker CLI | **MISSING ❌** |
| Container can reach ops/ scripts | **MISSING ❌** |
| Shell script runs pg_dump | PARTIAL ⚠️ (host-only) |
| Shell script encrypts env | PARTIAL ⚠️ (host-only) |
| Shell script archives MinIO volume | PARTIAL ⚠️ (host-only) |
| Artifact written to runtime/backups/ | PARTIAL ⚠️ (host filesystem, not mounted) |
| Artifact checksum computed + stored | VERIFIED ✅ (code path correct) |
| Run status → SUCCEEDED | VERIFIED ✅ |
| Audit log on completion | VERIFIED ✅ |

---

## Tenant Export Flow

```
[Admin UI: /ops/tenants] → SDK → POST /ops/backups/tenant:export
    ▼  VERIFIED ✅
[OpsService.triggerTenantExport()]
    │  1. prisma.tenant.findUnique(tenantId) — validates tenant exists
    │  2. prisma.opsBackupRun.create(type=TENANT_EXPORT, tenantId)
    │  3. audit.log('ops.tenant_export.queued')
    │  4. queue.add('ops.tenant_export.run', { runId, tenantId })
    ▼  VERIFIED ✅
[processOpsBackup() → runTenantExport()]
    │  validateTenantId(tenantId) — regex check
    │  spawnSync('bash', [script, tenantId])
    ▼  MISSING ❌ (same container wiring gap)
[ops/backup_tenant.sh <tenantId>]
    │  Verifies tenant in DB
    │  Exports 35+ tables as CSV (WHERE tenantId = ...)
    │  Packages into runtime/backups/tenants/vexel-tenant-<id>-TIMESTAMP.tar.gz
    ▼  PARTIAL ⚠️ (host-only)
```

| Step | Status |
|------|--------|
| Tenant existence validation (API) | VERIFIED ✅ |
| tenantId format validation (processor) | VERIFIED ✅ |
| Tenant scoping in SQL export | VERIFIED ✅ |
| Container wiring | **MISSING ❌** |
| Artifact creation | PARTIAL ⚠️ (host-only) |
| Cross-tenant leakage risk | NONE — each table uses WHERE tenantId = '...' |

---

## Restore Flow

```
[Admin UI: /ops/restore]
    │  Step 1: Select succeeded full backup run
    │  Step 2: POST /ops/restores/full:dryRun → preview manifest
    │  Step 3: Enter "yes-restore" → POST /ops/restores/full:run
    ▼  VERIFIED ✅ (UI flow correct)
[OpsService.triggerRestoreRun()]
    │  confirmPhrase === 'yes-restore' check → VERIFIED ✅
    │  prisma.opsBackupRun.create(type=RESTORE, mode=APPLY)
    │  audit.log('ops.restore.apply.queued')
    │  queue.add('ops.restore_full.run', { runId, artifactPath, preSnapshotEnabled })
    ▼  VERIFIED ✅
[processOpsBackup() → runRestoreApply()]
    │  validateArtifactPath() — must be under VEXEL_RUNTIME or /tmp/ → VERIFIED ✅
    │  if preSnapshotEnabled: runFullBackup(runId + '-pre-snap', ...)
    ▼  BUG ❌  (fabricated runId, Prisma update will throw P2025)
    │  spawnSync('bash', [restore_full.sh, resolved, '--confirm'])
    ▼  MISSING ❌ (container wiring gap)
[ops/restore_full.sh <artifact_path> --confirm]
    │  Extract archive → WORK_DIR
    │  Verify manifest
    │  docker exec postgres: DROP DATABASE vexel
    │  docker exec postgres: CREATE DATABASE vexel
    │  cat dump | docker exec -i postgres pg_restore
    │  Restore MinIO volume
    │  Restore Caddy config
    ▼  PARTIAL ⚠️ (host-only; destructive; no env guard)
```

| Step | Status |
|------|--------|
| Confirm phrase validation | VERIFIED ✅ |
| Artifact path validation | VERIFIED ✅ |
| Pre-snapshot before restore | **BUG ❌** (fabricated runId) |
| Container wiring | **MISSING ❌** |
| DB drop + restore | PARTIAL ⚠️ (host-only; no env guard) |
| MinIO restore | PARTIAL ⚠️ (host-only) |
| Post-restore healthcheck | PARTIAL ⚠️ (host-only) |
| Audit on restore apply | VERIFIED ✅ |

---

## Healthcheck Flow

```
POST /ops/healthcheck:run → OpsService → queue → processOpsBackup() → runHealthcheck()
    │  spawnSync('docker', ['inspect', ctr, ...]) for 8 containers
    │  spawnSync('curl', ...) for 3 internal health endpoints
    ▼  MISSING ❌ (no docker CLI in container)
```

| Step | Status |
|------|--------|
| Endpoint + permissions | VERIFIED ✅ |
| Job queuing | VERIFIED ✅ |
| Container health check logic | PARTIAL ⚠️ (code correct; container lacks docker CLI) |

---

## Schedule Execution Flow

```
[Admin UI: /ops/schedules] → SDK → POST /ops/schedules:create
    │  OpsSchedule record created with cronExpression
    ▼  VERIFIED ✅
[??? Cron executor ???]
    ▼  MISSING ❌ — no @Cron, no BullMQ repeatable, no node-cron found anywhere
```

| Step | Status |
|------|--------|
| Schedule CRUD API | VERIFIED ✅ |
| Schedule storage in DB | VERIFIED ✅ |
| Schedule execution engine | **MISSING ❌** |

---

## Storage Target Flow

```
POST /ops/storage-targets:create → OpsStorageTarget in DB
    │
    POST /ops/storage-targets/{id}:test
        │  For LOCAL type: synchronous fs.accessSync check → VERIFIED ✅
        │  For S3/MINIO type: queues 'ops.storage_target.test' job
        ▼  STUB — test job handler not implemented in processor
    │
    After backup: artifact written to LOCAL path only
        S3/MinIO upload: NOT IMPLEMENTED
```

| Step | Status |
|------|--------|
| LOCAL storage test | VERIFIED ✅ |
| S3/MinIO storage test | STUB ⚠️ |
| LOCAL artifact write | PARTIAL ⚠️ (host-only) |
| S3/MinIO artifact upload | **MISSING ❌** |
