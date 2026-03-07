# Ops Backup Subsystem — Fix Plan

**Priority order:** Critical → High → Medium → Low

---

## CRITICAL FIXES (must be done before any backup is trusted)

### FIX-01: Wire worker container for shell-based backup execution

**Why:** Every backup/restore/healthcheck job fails silently inside the container.

**Files to change:**
1. `docker-compose.yml` — add to `worker` service:
```yaml
worker:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    - ./runtime:/home/munaim/srv/apps/vexel/runtime
    - ./ops:/home/munaim/srv/apps/vexel/ops:ro
  environment:
    VEXEL_ROOT: /home/munaim/srv/apps/vexel
    VEXEL_RUNTIME_DIR: /home/munaim/srv/apps/vexel/runtime
    BACKUP_PASSPHRASE: ${BACKUP_PASSPHRASE}
```

2. `apps/worker/Dockerfile` — add to runtime stage:
```dockerfile
FROM node:20-alpine AS runtime
RUN apk add --no-cache docker-cli bash postgresql-client curl
```

3. Rebuild and restart worker: `docker compose build worker && docker compose up -d worker`

**Verification:** Trigger a healthcheck via `POST /api/ops/healthcheck:run`, poll the run, verify status → SUCCEEDED and log shows container states.

---

### FIX-02: Fix pre-snapshot bug in runRestoreApply

**Why:** Every restore-apply job fails at the pre-snapshot step with a Prisma P2025 error.

**File:** `apps/worker/src/ops-backup.processor.ts`

**Change:** Replace the inline `runFullBackup(runId + '-pre-snap', ...)` call with a proper pre-snapshot that creates a real DB record first:

```typescript
// Before calling runRestoreApply, create a real pre-snapshot run record:
async function runRestoreApply(
  runId: string,
  artifactPath: string,
  preSnapshotEnabled: boolean,
  logStream: fs.WriteStream,
  prisma: PrismaClient
) {
  const resolved = validateArtifactPath(artifactPath);
  log(logStream, `[APPLY] Full restore from: ${resolved}`);

  if (preSnapshotEnabled) {
    log(logStream, `Pre-snapshot enabled — taking snapshot before restore...`);
    
    // Create a real pre-snapshot run record
    const preSnapRun = await prisma.opsBackupRun.create({
      data: {
        id: uuidv4(),  // import { v4 as uuidv4 } from 'uuid'
        type: 'FULL',
        status: 'QUEUED',
        correlationId: `pre-snap-${runId}`,  // unique
        metaJson: { triggeredBy: 'restore-pre-snapshot', parentRunId: runId } as any,
      },
    });
    
    await runFullBackup(preSnapRun.id, null, logStream, prisma);
    log(logStream, `Pre-snapshot complete: ${preSnapRun.id}`);
  }

  // ... rest of restore
}
```

Also add `import { v4 as uuidv4 } from 'uuid';` at top if not already present.

---

### FIX-03: Handle correlationId uniqueness collision gracefully

**Why:** HTTP retries with same correlationId cause 500 errors due to UNIQUE constraint.

**Option A (recommended):** Make it idempotent — return existing run if correlationId already exists.

**File:** `apps/api/src/ops/ops.service.ts` — wrap `prisma.opsBackupRun.create()` in each trigger method:

```typescript
async triggerFullBackup(body: any, actorUserId: string, correlationId: string) {
  // Idempotency: return existing run if already queued for this correlationId
  const existing = await this.prisma.opsBackupRun.findUnique({ 
    where: { correlationId } 
  });
  if (existing) {
    return { runId: existing.id, status: existing.status, correlationId, idempotent: true };
  }
  // ... rest of method
}
```

Apply same pattern to all five trigger methods.

**Option B:** Drop the UNIQUE constraint via a new migration. Less safe but simpler.

---

### FIX-04: Seed OPS permissions to super-admin role

**Why:** No user can access any ops feature without manual DB intervention.

**File:** `apps/api/prisma/seed.ts`

Add to the super-admin permissions array:
```typescript
Permission.OPS_VIEW,
Permission.OPS_RUN_BACKUP,
Permission.OPS_EXPORT_TENANT,
Permission.OPS_CONFIGURE_SCHEDULES,
Permission.OPS_CONFIGURE_STORAGE,
// OPS_RESTORE intentionally NOT seeded to any default role
```

Re-run seed or apply via migration if seed is idempotent.

---

## HIGH-VALUE FIXES

### FIX-05: Parameterize VEXEL_ROOT in shell scripts

**Why:** Hardcoded host paths break portability and will fail on any different server.

**Files:** `ops/backup_full.sh`, `ops/restore_full.sh`, `ops/backup_tenant.sh`, `ops/healthcheck.sh`

**Change:** Replace hardcoded assignment with env-var-with-default pattern:
```bash
# Replace: VEXEL_ROOT="/home/munaim/srv/apps/vexel"
# With:
VEXEL_ROOT="${VEXEL_ROOT:-/home/munaim/srv/apps/vexel}"
```

---

### FIX-06: Add VEXEL_ALLOW_RESTORE guard to restore script

**Why:** Restore drops the production database. Must require explicit opt-in env var.

**File:** `ops/restore_full.sh` — add after the initial variable setup:
```bash
if [ "${VEXEL_ALLOW_RESTORE:-false}" != "true" ]; then
  echo "ERROR: VEXEL_ALLOW_RESTORE is not set to 'true'." >&2
  echo "Set VEXEL_ALLOW_RESTORE=true in the worker environment to enable restore operations." >&2
  exit 1
fi
```

Also add `VEXEL_ALLOW_RESTORE: "false"` to the worker environment in `docker-compose.yml` (default off).

---

### FIX-07: Set BACKUP_PASSPHRASE in production environment

**Why:** Default passphrase `$(hostname)-vexel-backup` is predictable and weak.

**Changes:**
1. Add `BACKUP_PASSPHRASE=` to `.env.example`
2. Add `BACKUP_PASSPHRASE: ${BACKUP_PASSPHRASE}` to worker environment in `docker-compose.yml`
3. Document in `docs/ops/BACKUP_POSTURE.md` as a required production secret
4. In `ops/backup_full.sh`, change the fallback warning to an `error_exit` in production if unset

---

### FIX-08: Implement retention/cleanup logic

**Why:** Backup artifacts accumulate indefinitely. `retentionDays` is stored but never enforced.

**Implementation options:**
- Add a `cleanupOldBackups(scheduleId)` method in `OpsService` that reads `retentionDays` from the schedule, finds runs older than that threshold with status SUCCEEDED, deletes artifact files, and updates run records.
- Wire it as a BullMQ repeatable job triggered daily, or as a post-backup step in the full backup job.

---

### FIX-09: Implement or document cron schedule executor

**Why:** Admin UI lets users create schedules with cron expressions that are never fired.

**Option A — Implement:**  
Add a NestJS `@Injectable()` cron service (using `@nestjs/schedule` or `BullMQ` repeatable jobs) that reads enabled `OpsSchedule` records and fires backup jobs at the correct intervals.

**Option B — Document and disable:**  
If not implementing in this cycle, add a banner to the Admin `/ops/schedules` page: "Scheduled backups are not yet active. Use the Dashboard to trigger manual backups."

---

### FIX-10: Use parameterized SQL in backup_tenant.sh

**Why:** tenantId is interpolated directly into a psql -c SQL string.

**File:** `ops/backup_tenant.sh`

**Change:** Use psql `\set` and a variable-passing approach:
```bash
docker exec vexel-postgres-1 psql -U vexel \
  -v TENANT_ID="'${TENANT_ID}'" \
  -c "\\COPY (SELECT * FROM ${TABLE} WHERE \"tenantId\" = :TENANT_ID) TO STDOUT WITH (FORMAT CSV, HEADER)" \
  > "$WORK_DIR/data/${TABLE}.csv"
```
Or use a heredoc with `$1` parameter to avoid inline variable expansion in the SQL string.

---

## NICE-TO-HAVE FIXES

### FIX-11: Replace execSync with spawnSync for dry-run cleanup

**File:** `apps/worker/src/ops-backup.processor.ts`

```typescript
// Replace:
try { execSync(`rm -rf ${tmpDir}`); } catch { /* ignore */ }
// With:
try { spawnSync('rm', ['-rf', tmpDir]); } catch { /* ignore */ }
```

---

### FIX-12: Add integration smoke test for backup

Add to `apps/e2e/tests/` (or a dedicated ops smoke test file):
1. POST `/api/ops/healthcheck:run` → verify run reaches SUCCEEDED within 30s
2. POST `/api/ops/backups/full:run` → verify run reaches SUCCEEDED within 120s
3. Verify artifact file exists at the path stored in run record

---

### FIX-13: Implement S3/MinIO upload in processor

**File:** `apps/worker/src/ops-backup.processor.ts`

After `runFullBackup()` completes and artifact path is known, add an optional upload step:
```typescript
const target = await prisma.opsStorageTarget.findFirst({ 
  where: { type: 'S3', isEnabled: true } 
});
if (target) {
  await uploadToS3(artifactAbsPath, target.configJson as any);
}
```

Implement `uploadToS3()` using `@aws-sdk/client-s3` (already a transitive dependency in node_modules).

---

## CONTRACT UPDATES NEEDED

None required — all 17 ops endpoints are already in `packages/contracts/openapi.yaml` and regenerated into the SDK.

Optional improvements to the contract:
- Add `idempotent: true` field to trigger response schemas (for FIX-03)
- Add error response for `409 Conflict` on duplicate correlationId
- Add `VEXEL_ALLOW_RESTORE not set` as a 422 response to restore endpoint

---

## TEST ADDITIONS NEEDED

| Test | Type | File |
|------|------|------|
| Confirm phrase rejection | Unit | `ops.service.spec.ts` — already exists |
| Duplicate correlationId → idempotent return | Unit | `ops.service.spec.ts` |
| Pre-snapshot creates real DB record | Unit | `ops.service.spec.ts` / processor test |
| Backup trigger → job in queue → artifact on disk | Integration | `apps/e2e/tests/ops.smoke.spec.ts` |
| Tenant export only contains correct tenantId rows | Integration | `apps/e2e/tests/ops.smoke.spec.ts` |
| Restore reject without VEXEL_ALLOW_RESTORE | Integration | `apps/e2e/tests/ops.smoke.spec.ts` |
| OPS permissions not accessible to non-ops role | Unit | `ops.controller.spec.ts` |
