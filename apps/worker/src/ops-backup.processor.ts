/**
 * Ops Backup Processor — BullMQ worker for ops-backup queue
 *
 * Handles: ops.full_backup.run, ops.tenant_export.run,
 *          ops.restore_full.dry_run, ops.restore_full.run,
 *          ops.healthcheck.run, ops.storage_target.test
 *
 * Each job:
 * 1. Sets run status → RUNNING
 * 2. Opens log file at runtime/data/logs/
 * 3. Runs the operation (calling existing shell scripts via child_process)
 * 4. Sets run status → SUCCEEDED | FAILED
 * 5. Writes AuditEvent
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const VEXEL_ROOT    = process.env.VEXEL_ROOT    ?? '/home/munaim/srv/apps/vexel';
const VEXEL_RUNTIME = process.env.VEXEL_RUNTIME_DIR ?? path.join(VEXEL_ROOT, 'runtime');
const LOGS_DIR      = path.join(VEXEL_RUNTIME, 'data', 'logs');
const BACKUPS_FULL  = path.join(VEXEL_RUNTIME, 'backups', 'full');
const BACKUPS_TENANT = path.join(VEXEL_RUNTIME, 'backups', 'tenants');
const OPS_DIR       = path.join(VEXEL_ROOT, 'ops');
const RETENTION_DAYS = Number(process.env.OPS_BACKUP_RETENTION_DAYS ?? '30');

function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function getLogPath(runId: string, type: string): string {
  ensureDir(LOGS_DIR);
  return path.join(LOGS_DIR, `ops_${type}_${runId}.log`);
}

function log(logFile: fs.WriteStream, msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  logFile.write(line);
}

// Safe tenantId validation — only allow alphanumeric, dash, underscore
function validateTenantId(tenantId: string): void {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId)) {
    throw new Error(`Invalid tenantId format: ${tenantId}`);
  }
}

// Safe artifact path validation — must be under VEXEL_RUNTIME
function validateArtifactPath(artifactPath: string): string {
  const resolved = path.resolve(artifactPath);
  const runtimeResolved = path.resolve(VEXEL_RUNTIME);
  if (!resolved.startsWith(runtimeResolved) && !resolved.startsWith('/tmp/')) {
    throw new Error(`Artifact path must be under ${VEXEL_RUNTIME} or /tmp/`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`Artifact file not found: ${resolved}`);
  }
  return resolved;
}

function fileSha256(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

export async function processOpsBackup(job: Job, prisma: PrismaClient): Promise<void> {
  const { runId } = job.data;
  if (!runId) throw new Error('runId is required');

  const run = await prisma.opsBackupRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error(`Run not found: ${runId}`);

  const type = run.type; // FULL | TENANT_EXPORT | RESTORE | HEALTHCHECK
  const logPath = getLogPath(runId, type.toLowerCase());
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  await prisma.opsBackupRun.update({
    where: { id: runId },
    data: { status: 'RUNNING', startedAt: new Date(), logPath },
  });

  log(logStream, `=== OpsBackup: ${type} === runId=${runId}`);
  log(logStream, `job.name=${job.name} data=${JSON.stringify(job.data)}`);

  try {
    if (type === 'FULL') {
      await runFullBackup(runId, run.metaJson as any, logStream, prisma);
    } else if (type === 'TENANT_EXPORT') {
      await runTenantExport(runId, job.data.tenantId ?? (run.metaJson as any)?.tenantId, logStream, prisma);
    } else if (type === 'RESTORE') {
      const meta = run.metaJson as any;
      if (meta?.mode === 'DRY_RUN') {
        await runRestoreDryRun(runId, job.data.artifactPath ?? meta?.artifactPath, logStream, prisma);
      } else {
        await runRestoreApply(runId, job.data.artifactPath ?? meta?.artifactPath, meta?.preSnapshotEnabled ?? true, logStream, prisma);
      }
    } else if (type === 'HEALTHCHECK') {
      await runHealthcheck(runId, logStream, prisma);
    } else {
      throw new Error(`Unknown run type: ${type}`);
    }

    log(logStream, `=== SUCCEEDED ===`);
    await prisma.opsBackupRun.update({
      where: { id: runId },
      data: { status: 'SUCCEEDED', finishedAt: new Date(), logPath },
    });

    // Audit
    await writeAuditEvent(prisma, run, 'succeeded');

  } catch (err: any) {
    const errMsg = err?.message ?? String(err);
    log(logStream, `=== FAILED: ${errMsg} ===`);

    await prisma.opsBackupRun.update({
      where: { id: runId },
      data: { status: 'FAILED', finishedAt: new Date(), errorSummary: errMsg.slice(0, 500), logPath },
    });

    await writeAuditEvent(prisma, run, 'failed', errMsg);
    throw err; // re-throw so BullMQ marks job as failed
  } finally {
    logStream.end();
  }
}

async function runFullBackup(runId: string, meta: any, logStream: fs.WriteStream, prisma: PrismaClient) {
  ensureDir(BACKUPS_FULL);
  const script = path.join(OPS_DIR, 'backup_full.sh');

  if (!fs.existsSync(script)) {
    throw new Error(`Backup script not found: ${script}`);
  }

  log(logStream, `Running full backup via ${script}`);

  const result = spawnSync('bash', [script], {
    env: process.env,
    cwd: VEXEL_ROOT,
    timeout: 600_000, // 10 min
    encoding: 'utf8',
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  logStream.write(stdout);
  if (stderr) logStream.write(`[stderr] ${stderr}\n`);

  if (result.status !== 0 || result.error) {
    throw new Error(`backup_full.sh exited with status ${result.status}: ${stderr.slice(0, 300)}`);
  }

  // Find the latest artifact in backups/full/
  const files = fs.readdirSync(BACKUPS_FULL)
    .filter(f => f.startsWith('vexel-full-') && f.endsWith('.tar.gz'))
    .map(f => ({ f, mtime: fs.statSync(path.join(BACKUPS_FULL, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length > 0) {
    const artifactName = files[0].f;
    const artifactAbsPath = path.join(BACKUPS_FULL, artifactName);
    const stat = fs.statSync(artifactAbsPath);
    const sha = fileSha256(artifactAbsPath);

    await prisma.opsBackupRun.update({
      where: { id: runId },
      data: {
        artifactPath:      artifactAbsPath,
        artifactSizeBytes: BigInt(stat.size),
        checksumSha256:    sha,
      },
    });

    log(logStream, `Artifact: ${artifactAbsPath} (${stat.size} bytes, sha256=${sha})`);
    await cleanupExpiredArtifacts(prisma, 'FULL', runId, logStream);
  }
}

async function runTenantExport(runId: string, tenantId: string, logStream: fs.WriteStream, prisma: PrismaClient) {
  validateTenantId(tenantId);
  ensureDir(BACKUPS_TENANT);

  const script = path.join(OPS_DIR, 'backup_tenant.sh');
  if (!fs.existsSync(script)) throw new Error(`Tenant export script not found: ${script}`);

  log(logStream, `Running tenant export for tenantId=${tenantId}`);

  const result = spawnSync('bash', [script, tenantId], {
    env: process.env,
    cwd: VEXEL_ROOT,
    timeout: 300_000,
    encoding: 'utf8',
  });

  logStream.write(result.stdout ?? '');
  if (result.stderr) logStream.write(`[stderr] ${result.stderr}\n`);

  if (result.status !== 0 || result.error) {
    throw new Error(`backup_tenant.sh exited with status ${result.status}`);
  }

  // Find latest tenant artifact
  const safeId = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const files = fs.readdirSync(BACKUPS_TENANT)
    .filter(f => f.startsWith(`vexel-tenant-${safeId}-`) && f.endsWith('.tar.gz'))
    .map(f => ({ f, mtime: fs.statSync(path.join(BACKUPS_TENANT, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length > 0) {
    const artifactAbsPath = path.join(BACKUPS_TENANT, files[0].f);
    const stat = fs.statSync(artifactAbsPath);
    const sha = fileSha256(artifactAbsPath);

    await prisma.opsBackupRun.update({
      where: { id: runId },
      data: {
        artifactPath:      artifactAbsPath,
        artifactSizeBytes: BigInt(stat.size),
        checksumSha256:    sha,
        tenantId,
      },
    });

    log(logStream, `Artifact: ${artifactAbsPath} (${stat.size} bytes)`);
    await cleanupExpiredArtifacts(prisma, 'TENANT_EXPORT', runId, logStream);
  }
}

async function runRestoreDryRun(runId: string, artifactPath: string, logStream: fs.WriteStream, prisma: PrismaClient) {
  const resolved = validateArtifactPath(artifactPath);
  log(logStream, `[DRY RUN] Restore preview for: ${resolved}`);

  // Extract manifest and show what would be restored
  const tmpDir = `/tmp/vexel-dry-run-${runId}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const result = spawnSync('tar', ['xzf', resolved, '-C', tmpDir, '--strip-components=1', '--wildcards', '*/manifest.json'], {
      timeout: 30_000, encoding: 'utf8',
    });

    logStream.write(result.stdout ?? '');
    if (result.stderr) logStream.write(`[stderr] ${result.stderr}\n`);

    const manifestPath = path.join(tmpDir, 'manifest.json');
    let manifest: any = {};
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      log(logStream, `Manifest: ${JSON.stringify(manifest, null, 2)}`);
    } else {
      log(logStream, `No manifest.json found — package may be invalid`);
    }

    const restorePlan = {
      artifactPath: resolved,
      manifest,
      wouldOverwrite: ['PostgreSQL database (vexel)', 'MinIO data volume (vexel_minio_data)'],
      wouldRestore: [
        manifest.db?.format ? `DB dump (${manifest.db.format}, ${manifest.db.size})` : null,
        manifest.minio ? `MinIO data (${manifest.minio.size})` : null,
        manifest.caddy_config ? 'Caddy routing config' : null,
      ].filter(Boolean),
      warnings: ['This operation is DESTRUCTIVE and will replace all current data'],
    };

    await prisma.opsBackupRun.update({
      where: { id: runId },
      data: { metaJson: { mode: 'DRY_RUN', restorePlan, artifactPath: resolved } as any },
    });

    log(logStream, `Dry run complete. Plan: ${JSON.stringify(restorePlan, null, 2)}`);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

async function runRestoreApply(runId: string, artifactPath: string, preSnapshotEnabled: boolean, logStream: fs.WriteStream, prisma: PrismaClient) {
  if (process.env.VEXEL_ALLOW_RESTORE !== 'true') {
    throw new Error('Restore is disabled by environment policy (set VEXEL_ALLOW_RESTORE=true)');
  }

  const resolved = validateArtifactPath(artifactPath);
  log(logStream, `[APPLY] Full restore from: ${resolved}`);

  // Pre-snapshot
  if (preSnapshotEnabled) {
    log(logStream, `Pre-snapshot enabled — taking snapshot before restore...`);
    const { preSnapshotRunId } = await createRestorePreSnapshotRun(prisma, runId);

    await prisma.opsBackupRun.update({
      where: { id: preSnapshotRunId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    try {
      await runFullBackup(preSnapshotRunId, null, logStream, prisma);
      await prisma.opsBackupRun.update({
        where: { id: preSnapshotRunId },
        data: { status: 'SUCCEEDED', finishedAt: new Date() },
      });
    } catch (error: any) {
      await prisma.opsBackupRun.update({
        where: { id: preSnapshotRunId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorSummary: String(error?.message ?? error).slice(0, 500),
        },
      });
      throw error;
    }
    await prisma.opsBackupRun.update({
      where: { id: runId },
      data: {
        metaJson: {
          parentRestoreRunId: runId,
          preSnapshotRunId,
          artifactPath: resolved,
          mode: 'APPLY',
          preSnapshotEnabled: true,
        } as any,
      },
    });
    log(logStream, `Pre-snapshot complete. runId=${preSnapshotRunId}`);
  }

  const script = path.join(OPS_DIR, 'restore_full.sh');
  if (!fs.existsSync(script)) throw new Error(`Restore script not found: ${script}`);

  const result = spawnSync('bash', [script, resolved, '--confirm'], {
    env: process.env,
    cwd: VEXEL_ROOT,
    timeout: 600_000,
    encoding: 'utf8',
  });

  logStream.write(result.stdout ?? '');
  if (result.stderr) logStream.write(`[stderr] ${result.stderr}\n`);

  if (result.status !== 0 || result.error) {
    throw new Error(`restore_full.sh exited with status ${result.status}`);
  }

  log(logStream, 'Restore applied. Running healthcheck...');

  // Post-restore healthcheck
  await runHealthcheck(undefined, logStream, prisma);
}

export async function createRestorePreSnapshotRun(prisma: PrismaClient, parentRestoreRunId: string) {
  const preSnapshotRunId = crypto.randomUUID();
  const preSnapshotCorrelationId = `restore-presnap-${parentRestoreRunId}`;

  await prisma.opsBackupRun.create({
    data: {
      id: preSnapshotRunId,
      type: 'FULL',
      status: 'QUEUED',
      correlationId: preSnapshotCorrelationId,
      initiatedByUserId: null,
      metaJson: {
        source: 'restore-pre-snapshot',
        parentRestoreRunId,
      } as any,
    },
  });

  await prisma.auditEvent.create({
    data: {
      tenantId: 'system',
      actorUserId: null,
      action: 'ops.restore.pre_snapshot.queued',
      entityType: 'OpsBackupRun',
      entityId: preSnapshotRunId,
      correlationId: preSnapshotCorrelationId,
      metadata: { parentRestoreRunId } as any,
    },
  });

  return { preSnapshotRunId, preSnapshotCorrelationId };
}

async function runHealthcheck(runId: string | undefined, logStream: fs.WriteStream, prisma: PrismaClient) {
  log(logStream, 'Running healthcheck...');

  const checks: Record<string, { ok: boolean; msg: string }> = {};

  // Check each container via docker inspect
  const containers = [
    'vexel-api-1', 'vexel-worker-1', 'vexel-admin-1',
    'vexel-operator-1', 'vexel-pdf-1', 'vexel-postgres-1',
    'vexel-redis-1', 'vexel-minio-1',
  ];

  for (const ctr of containers) {
    const r = spawnSync('docker', ['inspect', ctr, '--format', '{{.State.Status}}'], { encoding: 'utf8', timeout: 10_000 });
    const status = (r.stdout ?? '').trim();
    checks[ctr] = { ok: status === 'running', msg: status || 'inspect failed' };
    log(logStream, `  ${ctr}: ${status}`);
  }

  // Check internal ports
  const portChecks: Array<[string, number, string]> = [
    ['API /api/health', 9021, '/api/health'],
    ['PDF /health/pdf', 9022, '/health/pdf'],
    ['MinIO health',   9027, '/minio/health/live'],
  ];

  for (const [label, port, checkPath] of portChecks) {
    const r = spawnSync('curl', ['-sf', `http://127.0.0.1:${port}${checkPath}`], {
      encoding: 'utf8', timeout: 10_000,
    });
    checks[label] = { ok: r.status === 0, msg: r.status === 0 ? 'OK' : `curl exit ${r.status}` };
    log(logStream, `  ${label}: ${r.status === 0 ? 'OK' : 'FAIL'}`);
  }

  const passed = Object.values(checks).filter(c => c.ok).length;
  const total  = Object.keys(checks).length;
  const allOk  = passed === total;

  log(logStream, `Healthcheck: ${passed}/${total} passed`);

  if (runId) {
    await prisma.opsBackupRun.updateMany({
      where: { id: runId },
      data: { metaJson: { checks, passed, total, allOk } as any },
    });
  }

  if (!allOk) {
    throw new Error(`Healthcheck failed: ${passed}/${total} passed`);
  }
}

export async function cleanupExpiredArtifacts(
  prisma: PrismaClient,
  type: 'FULL' | 'TENANT_EXPORT',
  currentRunId: string,
  logStream: fs.WriteStream,
) {
  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) {
    log(logStream, `Retention cleanup skipped: OPS_BACKUP_RETENTION_DAYS=${process.env.OPS_BACKUP_RETENTION_DAYS ?? 'unset'}`);
    return;
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const oldRuns = await prisma.opsBackupRun.findMany({
    where: {
      type,
      status: 'SUCCEEDED',
      artifactPath: { not: null },
      finishedAt: { lt: cutoff },
      id: { not: currentRunId },
    },
    select: {
      id: true,
      tenantId: true,
      correlationId: true,
      artifactPath: true,
      metaJson: true,
    },
  });

  if (oldRuns.length === 0) return;

  for (const run of oldRuns) {
    const artifactPath = run.artifactPath as string;
    const resolved = path.resolve(artifactPath);
    const runtimeResolved = path.resolve(VEXEL_RUNTIME);
    if (!resolved.startsWith(runtimeResolved)) {
      log(logStream, `Retention skipped for run ${run.id}: artifact outside runtime (${resolved})`);
      continue;
    }

    if (fs.existsSync(resolved)) {
      try {
        fs.unlinkSync(resolved);
      } catch (e: any) {
        log(logStream, `Retention failed to delete ${resolved}: ${e?.message ?? e}`);
        continue;
      }
    }

    await prisma.opsBackupRun.update({
      where: { id: run.id },
      data: {
        artifactPath: null,
        artifactSizeBytes: null,
        checksumSha256: null,
        metaJson: {
          ...(typeof run.metaJson === 'object' && run.metaJson ? run.metaJson as Record<string, any> : {}),
          retentionCleanup: {
            cleanedAt: new Date().toISOString(),
            retentionDays: RETENTION_DAYS,
            deletedArtifactPath: resolved,
          },
        } as any,
      },
    });

    await prisma.auditEvent.create({
      data: {
        tenantId: run.tenantId ?? 'system',
        actorUserId: null,
        action: 'ops.artifact.retention_purged',
        entityType: 'OpsBackupRun',
        entityId: run.id,
        correlationId: run.correlationId ?? null,
        metadata: {
          deletedArtifactPath: resolved,
          retentionDays: RETENTION_DAYS,
        } as any,
      },
    });

    log(logStream, `Retention purged artifact for run ${run.id}: ${resolved}`);
  }
}

async function writeAuditEvent(prisma: PrismaClient, run: any, outcome: 'succeeded' | 'failed', error?: string) {
  await prisma.auditEvent.create({
    data: {
      tenantId: run.tenantId ?? 'system',
      actorUserId: run.initiatedByUserId ?? null,
      action: `ops.${run.type.toLowerCase()}.${outcome}`,
      entityType: 'OpsBackupRun',
      entityId: run.id,
      correlationId: run.correlationId,
      ...(error ? { metadata: { error: error.slice(0, 500) } as any } : {}),
    },
  });
}
