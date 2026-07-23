# Vexel Ops Backup / Restore Audit Report
**Date:** 2026-03-06  
**Auditor:** Vexel Ops Backup Audit Agent  
**Commit HEAD:** `2287b59` (main)  
**Repo root:** `/home/munaim/srv/apps/vexel`

---

## 1. Executive Summary

A full ops backup subsystem was added to the Vexel repository on 2026-03-03. It includes an API module with 17 endpoints, a BullMQ worker processor, four shell scripts, three new DB tables, an admin UI with seven pages, and an OpenAPI contract. Code coverage is substantial and architecture intent is sound.

**However, the subsystem is currently non-functional in production** due to a single critical wiring failure: the worker container has no Docker socket mount, no `ops/` scripts directory mount, no `runtime/` output directory mount, and no Docker CLI binary. Every backup/restore/healthcheck job enqueued via the API will immediately fail inside the container because it tries to call `bash /home/munaim/srv/apps/vexel/ops/backup_full.sh` — a host-only path that does not exist inside the container. All shell scripts themselves rely on `docker exec vexel-postgres-1 pg_dump ...` which also requires Docker access.

Additionally, OPS permissions are defined but not granted to any seeded role, so no real user can trigger ops actions in production without manual DB intervention.

The subsystem must be fixed before it is trusted as a backup strategy.

---

## 2. Final Classification

| Area | Classification |
|------|---------------|
| API layer (controller, service, module) | **FULL** |
| OpenAPI contract (17 endpoints) | **FULL** |
| SDK generation | **FULL** |
| DB schema (3 tables + migration) | **FULL** |
| Admin UI (7 pages, SDK-compliant) | **FULL** |
| Worker processor registration | **FULL** |
| Worker processor job dispatch logic | **FULL** |
| Shell scripts (backup, restore, healthcheck) | **FULL** (host-only) |
| Worker container runtime wiring | **MISSING** ← critical |
| Persistent artifact storage (path) | **PARTIAL** — path exists on host, not mounted in container |
| Cron schedule execution engine | **STUB** — schema exists, no executor |
| S3/MinIO artifact upload | **STUB** — only LOCAL path is real |
| OPS permission grants (seed) | **MISSING** |
| Retention/cleanup logic | **MISSING** |
| Restore path | **PARTIAL + RISK** — works on host, but has pre-snapshot bug and runs against live DB |
| Unit tests | **PARTIAL** — mocks only, no artifact creation verified |

---

## 3. Inventory of All Ops/Backup-Related Files

| Path | Category | Key Symbols | Notes |
|------|----------|-------------|-------|
| `apps/api/src/ops/ops.service.ts` | API service | `OpsService` | 500+ lines, fully implemented |
| `apps/api/src/ops/ops.controller.ts` | API controller | `OpsController` | 17 routes, RBAC guarded |
| `apps/api/src/ops/ops.module.ts` | Module | `OpsModule` | Imports PrismaModule, AuditModule |
| `apps/api/src/ops/__tests__/ops.service.spec.ts` | Tests | `OpsService` spec | Mock-only unit tests |
| `apps/api/src/app.module.ts` | Module wiring | line 27, 55 | `OpsModule` imported ✅ |
| `apps/worker/src/ops-backup.processor.ts` | Worker | `processOpsBackup` | Full job dispatch logic |
| `apps/worker/src/main.ts` | Worker bootstrap | `opsBackupWorker` | Registered on queue `ops-backup` ✅ |
| `apps/worker/Dockerfile` | Container | — | node:20-alpine, NO docker CLI, NO bash |
| `apps/api/prisma/schema.prisma` | DB schema | `OpsBackupRun`, `OpsSchedule`, `OpsStorageTarget`, `OpsScheduleTarget` | All present |
| `apps/api/prisma/migrations/20260303220000_add_ops_backup_tables/migration.sql` | Migration | — | Applied, 4 tables |
| `apps/api/src/rbac/permissions.ts` | Permissions | `OPS_VIEW`, `OPS_RUN_BACKUP`, `OPS_EXPORT_TENANT`, `OPS_CONFIGURE_SCHEDULES`, `OPS_CONFIGURE_STORAGE`, `OPS_RESTORE` | Defined, not seeded to any role |
| `apps/admin/src/app/(protected)/ops/page.tsx` | Admin UI | `OpsDashboardPage` | SDK compliant |
| `apps/admin/src/app/(protected)/ops/backups/page.tsx` | Admin UI | backup list | SDK compliant |
| `apps/admin/src/app/(protected)/ops/backups/new/page.tsx` | Admin UI | trigger backup | SDK compliant |
| `apps/admin/src/app/(protected)/ops/restore/page.tsx` | Admin UI | 3-step restore flow | SDK compliant |
| `apps/admin/src/app/(protected)/ops/tenants/page.tsx` | Admin UI | tenant export | SDK compliant |
| `apps/admin/src/app/(protected)/ops/schedules/page.tsx` | Admin UI | schedule CRUD | SDK compliant |
| `apps/admin/src/app/(protected)/ops/storage/page.tsx` | Admin UI | storage targets | SDK compliant |
| `apps/admin/src/app/(protected)/ops/logs/page.tsx` | Admin UI | run log viewer | SDK compliant |
| `packages/contracts/openapi.yaml` | Contract | 17 `/ops/*` paths | All defined |
| `packages/sdk/src/generated/api.d.ts` | SDK | All ops paths typed | Regenerated ✅ |
| `ops/backup_full.sh` | Shell | — | Full backup (DB+MinIO+env+Caddy), host-only |
| `ops/backup_tenant.sh` | Shell | — | Per-tenant CSV export, host-only |
| `ops/restore_full.sh` | Shell | — | Full restore, destructive, host-only |
| `ops/healthcheck.sh` | Shell | — | Stack health, host-only |
| `ops/README.md` | Docs | — | Usage guide |
| `docs/ops/BACKUP_POSTURE.md` | Docs | — | Backup strategy doc |
| `docs/ops/DISASTER_RECOVERY.md` | Docs | — | DR runbook |
| `docs/ops/BACKUPS_UI.md` | Docs | — | UI usage guide |
| `docker-compose.yml` | Config | — | NO ops-specific volumes, NO docker socket, NO VEXEL_ROOT env |

---

## 4. End-to-End Architecture Actually Found

```
Admin UI (7 pages, SDK)
    │
    └─▶  SDK (packages/sdk) ──▶  API Container (:9021)
                                        │
                                 OpsController (RBAC)
                                        │
                                   OpsService
                                   ├── Prisma: create OpsBackupRun (status=QUEUED)
                                   ├── AuditService.log()
                                   └── BullMQ Queue("ops-backup").add(job)
                                                │
                                    Redis (:6380)
                                                │
                                    Worker Container
                                    └── Worker("ops-backup") ──▶ processOpsBackup()
                                                                    │
                                                            spawnSync('bash', [script])
                                                                    │
                                                            ❌ HOST PATH NOT ACCESSIBLE
                                                            ❌ NO DOCKER CLI IN CONTAINER
                                                            ❌ NO RUNTIME DIR MOUNTED
```

The break is at the last step. Everything above the worker processor runs correctly. The processor itself is correct code that fails at runtime because the container environment lacks the required host resources.

---

## 5. Backup Types Implemented

| Type | API Endpoint | Shell Script | Worker Handler | Status |
|------|-------------|-------------|----------------|--------|
| Full platform backup | `POST /ops/backups/full:run` | `ops/backup_full.sh` | `runFullBackup()` | PARTIAL (host-only) |
| Tenant data export | `POST /ops/backups/tenant:export` | `ops/backup_tenant.sh` | `runTenantExport()` | PARTIAL (host-only) |
| Full restore (dry run) | `POST /ops/restores/full:dryRun` | inline tar+manifest | `runRestoreDryRun()` | PARTIAL (host-only) |
| Full restore (apply) | `POST /ops/restores/full:run` | `ops/restore_full.sh` | `runRestoreApply()` | PARTIAL + RISK |
| Healthcheck | `POST /ops/healthcheck:run` | `ops/healthcheck.sh` | `runHealthcheck()` | PARTIAL (host-only) |
| Scheduled backup | DB schema only | — | None (no cron executor) | STUB |
| S3/MinIO upload | storage target model | — | Not implemented | STUB |

---

## 6. Restore Capability Status

Restore is **partially implemented but currently broken** (container wiring) and **carries significant production risk**:

- `restore_full.sh` does a hard `DROP DATABASE vexel` followed by `CREATE DATABASE` and `pg_restore`.
- There is no "staging only" guard or environment check.
- Restore runs against the live production DB of whatever Postgres container is active.
- Pre-snapshot automation has a code bug (see risk #3 below).
- The confirmation phrase `"yes-restore"` is validated in API layer; the shell script also prompts if `--confirm` not passed. This provides two layers of intent confirmation — good.
- Restore is accessible to any user with `OPS_RESTORE` permission — and that permission is not seeded to any default role (currently safe by omission, not by design).

---

## 7. API Contract Compliance

**PASS.** All 17 ops API routes are present in `packages/contracts/openapi.yaml` and regenerated into the SDK (`packages/sdk/src/generated/api.d.ts`). Admin UI pages call the API exclusively through `getApiClient()` from the generated SDK. No raw `fetch` or `axios` calls found in ops UI pages.

One minor concern: OpenAPI paths use colon-action notation (e.g., `/ops/backups/full:run`), which NestJS maps with escaped colons (`'backups/full\\:run'`). This is non-standard but consistent throughout the codebase. Not a compliance violation.

---

## 8. Worker Wiring Status

**Registration:** FULL — `opsBackupWorker` is instantiated in `apps/worker/src/main.ts` on queue `ops-backup` with concurrency=1, and the `processOpsBackup` function is imported and used correctly.

**Processor logic:** FULL — All five job types are dispatched, logs are written, run status is updated, audit events are emitted.

**Container runtime:** MISSING — The worker runs in `node:20-alpine`. The processor calls:
- `spawnSync('bash', ['/home/munaim/srv/apps/vexel/ops/backup_full.sh', ...])` — host path, not accessible inside container
- Shell scripts call `docker exec vexel-postgres-1 pg_dump ...` — requires Docker socket
- Output written to `/home/munaim/srv/apps/vexel/runtime/backups/` — host path, not mounted

No docker socket volume (`/var/run/docker.sock:/var/run/docker.sock`) is present in `docker-compose.yml` for the worker service. No `runtime/` bind mount exists. The `VEXEL_ROOT` and `VEXEL_RUNTIME_DIR` environment variables are not set in the worker's docker-compose environment block.

---

## 9. Storage Persistence Status

**Host filesystem:** The `runtime/` directory exists at `/home/munaim/srv/apps/vexel/runtime/` with subdirectories `backups/full/`, `backups/tenants/`, `data/logs/`. This is persistent on the VPS host.

**Container persistence:** MISSING — No Docker volume or bind mount connects the container's view of the filesystem to `runtime/`. Artifacts would only accumulate on the host if the scripts ran directly on the host, not via container.

**Named Docker volumes:** Only `pgdata` and `minio_data` are defined in `docker-compose.yml`. No `runtime` volume.

**S3/MinIO upload:** Not implemented. The `OpsStorageTarget` model with type `S3` or `MINIO` can be stored in DB, but the processor only handles the LOCAL case (writes to filesystem). Non-LOCAL targets queue a `ops.storage_target.test` job that does nothing beyond logging.

**Artifact naming:** Timestamped, unique (`vexel-full-YYYYMMDD_HHMMSS.tar.gz`). No collision risk under normal operation.

---

## 10. Security and Tenancy Findings

### Access Control
- 6 OPS permissions defined: `OPS_VIEW`, `OPS_RUN_BACKUP`, `OPS_EXPORT_TENANT`, `OPS_CONFIGURE_SCHEDULES`, `OPS_CONFIGURE_STORAGE`, `OPS_RESTORE`.
- Controller applies `JwtAuthGuard` + `PermissionsGuard` on the entire controller. Each endpoint is decorated with appropriate `@RequirePermissions(...)`.
- **No role in seed.ts has any OPS permission.** Super-admin and system-admin roles do not include OPS permissions by default. This means currently nobody can trigger ops actions in production without a manual DB grant. This is accidentally safe but should be intentional.

### Tenant Isolation in Export
- `backup_tenant.sh` validates `TENANT_ID` format with shell regex `^[a-zA-Z0-9_-]` in `SAFE_ID` construction.
- `validateTenantId()` in processor enforces `^[a-zA-Z0-9_-]{1,64}$`.
- Tenant existence is checked in `OpsService.triggerTenantExport()` via Prisma before enqueueing.
- Tenant existence is re-verified in `backup_tenant.sh` with a SQL query.
- HOWEVER: The SQL query in the script interpolates `${TENANT_ID}` directly into a `psql` command. While the validation regex prevents most SQL injection, this is not parameterized SQL. **Low risk given the regex, but not ideal.**
- All exported tables are scoped by `WHERE "tenantId" = '${TENANT_ID}'`. No cross-tenant leakage risk found.

### Secret Handling
- Confirmation phrase `"yes-restore"` is validated in service layer but never persisted in DB — good.
- `BACKUP_PASSPHRASE` env var is used for AES-256 encryption of `.env` file. If not set, defaults to `$(hostname)-vexel-backup` (weak fallback). This fallback is acceptable for dev but must be set explicitly in production.
- No secrets embedded in source code found.

### Path Traversal
- `validateArtifactPath()` in processor resolves the path and checks it starts with `VEXEL_RUNTIME` or `/tmp/`. This prevents path traversal for restore.
- Log file path is constructed from `runId` (UUID format). `getLogPath()` constructs path from server-controlled inputs only.

### Shell Command Safety
- `spawnSync('bash', [scriptPath])` — script path is server-controlled constant, not user input. Safe.
- `spawnSync('bash', [script, tenantId])` — tenantId is validated before this call. Safe.
- `spawnSync('bash', [script, resolved, '--confirm'])` — `resolved` is server-validated absolute path. Safe.
- `execSync(\`rm -rf ${tmpDir}\`)` in dry-run cleanup — `tmpDir` is constructed as `/tmp/vexel-dry-run-${runId}` where runId comes from DB. UUIDs are safe but `execSync` with string interpolation is a minor concern; `spawnSync('rm', ['-rf', tmpDir])` would be safer.

### Restore Live-DB Risk
- `restore_full.sh` drops and recreates the `vexel` database against whichever postgres container is running. There is no environment check (e.g., `if [ "$NODE_ENV" = "production" ]`). Running this against a live system is the intended use case, but it is inherently destructive and permanent.

---

## 11. Audit / Logging Findings

**Coverage: PASS for trigger events; PARTIAL for job lifecycle.**

| Event | Audit logged? |
|-------|---------------|
| Full backup queued | ✅ `ops.full_backup.queued` |
| Tenant export queued | ✅ `ops.tenant_export.queued` |
| Restore dry-run queued | ✅ `ops.restore.dry_run.queued` |
| Restore apply queued | ✅ `ops.restore.apply.queued` |
| Healthcheck queued | ✅ `ops.healthcheck.queued` |
| Schedule created | ✅ `ops.schedule.created` |
| Storage target created | ✅ `ops.storage_target.created` |
| Job succeeded | ✅ `ops.<type>.succeeded` (in processor) |
| Job failed | ✅ `ops.<type>.failed` (in processor) |
| Restore confirmation rejected | ❌ No audit (throws BadRequestException before any DB write) |

**CorrelationId:** Set from `X-Correlation-Id` header on trigger; propagated to `OpsBackupRun.correlationId`. The `correlationId` column has a UNIQUE constraint — if the same `correlationId` is sent twice (e.g. HTTP retry), the second `create()` will fail with a unique constraint violation (500 error). This is an operational bug.

**Run status lifecycle:** `QUEUED → RUNNING → SUCCEEDED | FAILED` is tracked in `ops_backup_runs`. Log file path stored in `logPath` field. Admin UI can read log lines via `GET /ops/runs/{id}/logs`.

---

## 12. Test Coverage Findings

**Unit tests exist** at `apps/api/src/ops/__tests__/ops.service.spec.ts`.

Tests cover:
- `triggerFullBackup` creates QUEUED run
- `triggerRestoreRun` rejects wrong confirmation phrase
- `listRuns` returns paginated data
- `getDashboard` returns expected shape

Tests do NOT cover:
- Any actual artifact creation (worker processor is not tested)
- Filesystem operations
- Shell script execution
- Tenant isolation in export (no test that export for tenant A doesn't include tenant B data)
- Container/worker wiring
- Restore destructiveness warning path
- `correlationId` uniqueness collision
- Permission enforcement at controller level
- Pre-snapshot bug in `runRestoreApply`

There are no integration tests for the ops subsystem. E2E tests in `apps/e2e/tests/` do not include ops scenarios.

---

## 13. Risks Ranked by Severity

### 🔴 CRITICAL

**RISK-01: Worker container cannot execute backup/restore jobs**  
*Evidence:* `apps/worker/Dockerfile` — `node:20-alpine`, no `docker` CLI, no `bash`, no bound volume. `docker-compose.yml` worker service — no volume mounts, no docker socket, no `VEXEL_ROOT`/`VEXEL_RUNTIME_DIR` env vars.  
*Impact:* Every backup job queued via the API will fail immediately. The system gives false confidence that backups are running.

**RISK-02: OPS permissions not granted to any role**  
*Evidence:* `apps/api/prisma/seed.ts` — no `ops.*` permissions assigned. `apps/api/src/rbac/permissions.ts` lines 76–81 — defined but not wired to roles.  
*Impact:* Currently no real user can trigger or view ops actions. Accidentally protective, but means the feature is inaccessible unless DB is manually modified.

### 🟠 HIGH

**RISK-03: Pre-snapshot bug in `runRestoreApply`**  
*Evidence:* `apps/worker/src/ops-backup.processor.ts` line ~248: `runFullBackup(runId + '-pre-snap', null, logStream, prisma)`. This passes a synthetic, non-existent runId to `runFullBackup`. Inside `runFullBackup`, after the script runs, it calls `prisma.opsBackupRun.update({ where: { id: runId + '-pre-snap' }, ... })`. Prisma `update` on a non-existent record throws. This causes every restore-apply job to fail during the pre-snapshot step.

**RISK-04: `correlationId` UNIQUE constraint causes retry failures**  
*Evidence:* `migration.sql` — `CREATE UNIQUE INDEX "ops_backup_runs_correlationId_key" ON "ops_backup_runs"("correlationId")`. If an HTTP client retries a backup trigger with the same `correlationId`, the second request will throw a Prisma `P2002` unique constraint error, resulting in a 500 response.

**RISK-05: Shell scripts have hardcoded host paths**  
*Evidence:* `ops/backup_full.sh:10` — `VEXEL_ROOT="/home/munaim/srv/apps/vexel"`. `ops/restore_full.sh:26` — same. Scripts do not read from env vars, making them non-portable and tightly coupled to this specific server layout.

**RISK-06: Cron schedule executor does not exist**  
*Evidence:* `OpsSchedule` Prisma model with `cronExpression` field. Searched all of `apps/api/src/` and `apps/worker/src/` — no `@Cron`, no `CronJob`, no `node-cron`, no BullMQ repeatable job registration for schedules. Admin UI allows creating schedules, but they are never executed.

**RISK-07: Restore runs against live production database**  
*Evidence:* `restore_full.sh:79-87` — `DROP DATABASE IF EXISTS vexel` then `CREATE DATABASE vexel OWNER vexel`. No environment guard. Triggering restore via the Admin UI sends a production system into immediate data loss.

### 🟡 MEDIUM

**RISK-08: S3/MinIO artifact upload not implemented**  
*Evidence:* `OpsStorageTarget.type = 'S3'` can be created but processor has no S3 upload code. Non-LOCAL storage targets queue a `ops.storage_target.test` job that does nothing useful.

**RISK-09: tenantId SQL interpolation in backup_tenant.sh**  
*Evidence:* `ops/backup_tenant.sh:~92` — tenantId interpolated into `psql -c "\\COPY (SELECT * FROM ${TABLE} WHERE \"tenantId\" = '${TENANT_ID}')"`. Validation regex mitigates injection risk but not fully parameterized.

**RISK-10: Weak backup passphrase fallback**  
*Evidence:* `ops/backup_full.sh:52-54` — if `BACKUP_PASSPHRASE` is unset, falls back to `$(hostname)-vexel-backup`. Predictable and weak. `BACKUP_PASSPHRASE` is not set in `docker-compose.yml`.

**RISK-11: `execSync` in dry-run cleanup**  
*Evidence:* `ops-backup.processor.ts` — `execSync(\`rm -rf ${tmpDir}\`)`. `tmpDir` is `/tmp/vexel-dry-run-${runId}` where `runId` is a DB-sourced UUID. Risk is low but `spawnSync` is safer.

**RISK-12: No retention/cleanup logic**  
*Evidence:* `retentionDays` field in `OpsSchedule`. No cleanup processor, no `retention` or `cleanup` function found anywhere in the codebase. Backup artifacts will accumulate indefinitely.

### 🟢 LOW

**RISK-13: Unit tests mock all infrastructure**  
Tests verify service logic but cannot catch runtime failures (container environment issues, filesystem errors, actual artifact creation).

**RISK-14: MinIO port in healthcheck processor may mismatch**  
*Evidence:* `ops-backup.processor.ts` curl check uses port `9027`. `docker-compose.yml` maps `127.0.0.1:9027:9000` (MinIO API). This is actually correct — port 9027 is the API port. However the healthcheck script `ops/healthcheck.sh` also uses `9027`. This is consistent.

---

## 14. Recommended Keep / Fix / Remove Decisions

| Component | Decision | Rationale |
|-----------|----------|-----------|
| `ops.module.ts` / `ops.service.ts` / `ops.controller.ts` | **KEEP + FIX** | Solid architecture, needs permission seeding and correlationId dedup fix |
| `ops-backup.processor.ts` | **KEEP + FIX** | Good job dispatch logic; fix pre-snapshot bug; needs container wiring |
| `ops/backup_full.sh` | **KEEP + FIX** | Works on host; parameterize VEXEL_ROOT from env |
| `ops/backup_tenant.sh` | **KEEP + FIX** | Works on host; use parameterized SQL |
| `ops/restore_full.sh` | **KEEP + FIX** | Works on host; add environment guard |
| `ops/healthcheck.sh` | **KEEP** | Solid standalone script |
| Admin ops UI (7 pages) | **KEEP** | SDK-compliant, functional UI |
| `OpsSchedule` cron executor | **FIX (implement or document as not-yet)** | Schema exists but executor missing; either wire BullMQ repeatable jobs or mark as future |
| S3 storage target | **DOCUMENT AS STUB** | Remove from UI or clearly label as "coming soon" |
| docker-compose worker service | **FIX** — add docker socket + runtime mount | Critical fix |

---

## 15. Minimal Path to Production-Safe Backup

These changes, in priority order, make the backup subsystem trustworthy:

### Step 1 (Critical — unblock all jobs)
Add to `docker-compose.yml` worker service:
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

Add `docker` CLI and `bash` to worker Dockerfile:
```dockerfile
RUN apk add --no-cache docker-cli bash postgresql-client
```

### Step 2 (Critical — fix pre-snapshot bug)
In `ops-backup.processor.ts`, `runRestoreApply()`, replace:
```ts
await runFullBackup(runId + '-pre-snap', null, logStream, prisma);
```
With a proper pre-snapshot that creates a real `OpsBackupRun` record before calling `runFullBackup`.

### Step 3 (Critical — fix correlationId collision)
Remove the UNIQUE constraint on `ops_backup_runs.correlationId`, or handle the constraint violation gracefully (return existing run if same correlationId exists).

### Step 4 (High — grant permissions)
In `seed.ts`, add `OPS_VIEW`, `OPS_RUN_BACKUP`, and `OPS_EXPORT_TENANT` to the super-admin role. Keep `OPS_RESTORE` off all default roles — require explicit manual grant.

### Step 5 (High — hardcoded paths)
Parameterize `VEXEL_ROOT` in all shell scripts via env var instead of hardcoding.

### Step 6 (High — retention/cleanup)
Add a BullMQ job or scheduled task that enforces `retentionDays` by deleting old artifacts from the filesystem and their corresponding DB records.

### Step 7 (Medium — set BACKUP_PASSPHRASE in prod)
Add `BACKUP_PASSPHRASE` to the production `.env` and document this in `docs/ops/`.

---

## 16. Final Verdict

**RECOMMENDATION: KEEP WITH FIXES**  
See detailed fix plan in `ops_backup_fix_plan.md`.

The architecture and code quality are good. The intent is correct. The contract-first discipline is respected. The failure is entirely operational (container wiring, a pre-snapshot bug, missing permission seeds) — none of these require a redesign. Once the Docker wiring is corrected and the pre-snapshot bug fixed, the core backup path (trigger → queue → worker → shell script → artifact) will work end-to-end. The subsystem should be fixed, not removed.

The restore path should remain **disabled for any non-super-admin role** until a full drill has been completed on staging.
