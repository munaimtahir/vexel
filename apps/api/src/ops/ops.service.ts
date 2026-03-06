import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';

const VEXEL_RUNTIME = process.env.VEXEL_RUNTIME_DIR ?? '/home/munaim/srv/apps/vexel/runtime';
const BACKUPS_DIR   = path.join(VEXEL_RUNTIME, 'backups');
const LOGS_DIR      = path.join(VEXEL_RUNTIME, 'data', 'logs');
const CONFIRM_PHRASE = 'yes-restore';

function getRedisConnection() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new IORedis(url, { maxRetriesPerRequest: null });
}

@Injectable()
export class OpsService {
  private readonly queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    this.queue = new Queue('ops-backup', { connection: getRedisConnection() as any });
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard() {
    const [lastFullBackup, lastHealthcheck, recentRuns, storageTargets, schedules] =
      await Promise.all([
        this.prisma.opsBackupRun.findFirst({
          where: { type: 'FULL', status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
          include: { storageTarget: true },
        }),
        this.prisma.opsBackupRun.findFirst({
          where: { type: 'HEALTHCHECK', status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.opsBackupRun.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { storageTarget: true },
        }),
        this.prisma.opsStorageTarget.findMany({ orderBy: { createdAt: 'asc' } }),
        this.prisma.opsSchedule.findMany({
          include: { storageTargets: { include: { storageTarget: true } } },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    const diskUsage = this.getDiskUsage();

    return {
      lastFullBackup: lastFullBackup ? this.serializeRun(lastFullBackup) : null,
      lastHealthcheck: lastHealthcheck ? this.serializeRun(lastHealthcheck) : null,
      recentRuns: recentRuns.map(r => this.serializeRun(r)),
      storageTargets,
      schedules: schedules.map(s => this.serializeSchedule(s)),
      diskUsage,
    };
  }

  // ─── Runs ──────────────────────────────────────────────────────────────────

  async listRuns(q: { type?: string; status?: string; tenantId?: string; limit?: number; cursor?: string }) {
    const { type, status, tenantId, limit = 20, cursor } = q;
    const where: any = {};
    if (type)     where.type = type;
    if (status)   where.status = status;
    if (tenantId) where.tenantId = tenantId;
    if (cursor)   where.createdAt = { lt: new Date(Buffer.from(cursor, 'base64').toString()) };

    const runs = await this.prisma.opsBackupRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit) + 1,
      include: { storageTarget: true },
    });

    const hasMore = runs.length > Number(limit);
    const data = hasMore ? runs.slice(0, Number(limit)) : runs;
    const nextCursor = hasMore
      ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    const total = await this.prisma.opsBackupRun.count({ where });

    return {
      data: data.map(r => this.serializeRun(r)),
      pagination: { total, limit: Number(limit), cursor: nextCursor },
    };
  }

  async getRun(id: string) {
    const run = await this.prisma.opsBackupRun.findUnique({
      where: { id },
      include: { storageTarget: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${id}`);
    return this.serializeRun(run);
  }

  async getRunLogs(id: string, offset = 0, limit = 200) {
    const run = await this.prisma.opsBackupRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException(`Run not found: ${id}`);

    if (!run.logPath) {
      return { runId: id, logPath: null, lines: [], total: 0, offset };
    }

    try {
      const content = fs.readFileSync(run.logPath, 'utf8');
      const allLines = content.split('\n').filter(l => l.length > 0);
      const total = allLines.length;
      const lines = allLines.slice(offset, offset + limit);
      return { runId: id, logPath: run.logPath, lines, total, offset };
    } catch {
      return { runId: id, logPath: run.logPath, lines: ['[log file not accessible]'], total: 1, offset };
    }
  }

  // ─── Trigger Commands ─────────────────────────────────────────────────────

  async triggerFullBackup(
    body: {
      includeDb?: boolean;
      includeMinio?: boolean;
      includeEnv?: boolean;
      includeCaddy?: boolean;
      storageTargetId?: string;
      passphraseMode?: string;
    },
    actorUserId: string,
    correlationId: string,
  ) {
    const run = await this.prisma.opsBackupRun.create({
      data: {
        id: uuidv4(),
        type: 'FULL',
        status: 'QUEUED',
        correlationId,
        initiatedByUserId: actorUserId,
        storageTargetId: body.storageTargetId ?? null,
        metaJson: {
          includeDb:      body.includeDb      ?? true,
          includeMinio:   body.includeMinio   ?? true,
          includeEnv:     body.includeEnv     ?? true,
          includeCaddy:   body.includeCaddy   ?? true,
          passphraseMode: body.passphraseMode ?? 'SERVER_MANAGED',
        } as any,
      },
    });

    await this.audit.log({
      tenantId: 'system',
      actorUserId,
      action: 'ops.full_backup.queued',
      entityType: 'OpsBackupRun',
      entityId: run.id,
      correlationId,
    });

    await this.queue.add('ops.full_backup.run', { runId: run.id }, {
      jobId: `ops-full-${run.id}`,
    });

    return { runId: run.id, status: run.status, correlationId };
  }

  async triggerTenantExport(
    body: { tenantId: string; storageTargetId?: string },
    actorUserId: string,
    correlationId: string,
  ) {
    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({ where: { id: body.tenantId } });
    if (!tenant) throw new BadRequestException(`Tenant '${body.tenantId}' not found`);

    const run = await this.prisma.opsBackupRun.create({
      data: {
        id: uuidv4(),
        type: 'TENANT_EXPORT',
        status: 'QUEUED',
        tenantId: body.tenantId,
        correlationId,
        initiatedByUserId: actorUserId,
        storageTargetId: body.storageTargetId ?? null,
        metaJson: { tenantId: body.tenantId } as any,
      },
    });

    await this.audit.log({
      tenantId: body.tenantId,
      actorUserId,
      action: 'ops.tenant_export.queued',
      entityType: 'OpsBackupRun',
      entityId: run.id,
      correlationId,
    });

    await this.queue.add('ops.tenant_export.run', { runId: run.id, tenantId: body.tenantId }, {
      jobId: `ops-tenant-${run.id}`,
    });

    return { runId: run.id, status: run.status, correlationId };
  }

  async triggerRestoreDryRun(
    body: { artifactPath: string },
    actorUserId: string,
    correlationId: string,
  ) {
    const run = await this.prisma.opsBackupRun.create({
      data: {
        id: uuidv4(),
        type: 'RESTORE',
        status: 'QUEUED',
        correlationId,
        initiatedByUserId: actorUserId,
        metaJson: { artifactPath: body.artifactPath, mode: 'DRY_RUN' } as any,
      },
    });

    await this.audit.log({
      tenantId: 'system',
      actorUserId,
      action: 'ops.restore.dry_run.queued',
      entityType: 'OpsBackupRun',
      entityId: run.id,
      correlationId,
    });

    await this.queue.add('ops.restore_full.dry_run', { runId: run.id, artifactPath: body.artifactPath }, {
      jobId: `ops-restore-dry-${run.id}`,
    });

    return { runId: run.id, status: run.status, correlationId };
  }

  async triggerRestoreRun(
    body: { artifactPath: string; confirmPhrase: string; preSnapshotEnabled?: boolean },
    actorUserId: string,
    correlationId: string,
  ) {
    if (body.confirmPhrase !== CONFIRM_PHRASE) {
      throw new BadRequestException(`Confirmation phrase must be "${CONFIRM_PHRASE}"`);
    }

    const run = await this.prisma.opsBackupRun.create({
      data: {
        id: uuidv4(),
        type: 'RESTORE',
        status: 'QUEUED',
        correlationId,
        initiatedByUserId: actorUserId,
        metaJson: {
          artifactPath:       body.artifactPath,
          mode:               'APPLY',
          preSnapshotEnabled: body.preSnapshotEnabled ?? true,
          // never store confirmPhrase in DB
        } as any,
      },
    });

    await this.audit.log({
      tenantId: 'system',
      actorUserId,
      action: 'ops.restore.apply.queued',
      entityType: 'OpsBackupRun',
      entityId: run.id,
      correlationId,
      metadata: { preSnapshotEnabled: body.preSnapshotEnabled ?? true },
    });

    await this.queue.add('ops.restore_full.run', {
      runId: run.id,
      artifactPath: body.artifactPath,
      preSnapshotEnabled: body.preSnapshotEnabled ?? true,
    }, { jobId: `ops-restore-apply-${run.id}` });

    return { runId: run.id, status: run.status, correlationId };
  }

  async triggerHealthcheck(actorUserId: string, correlationId: string) {
    const run = await this.prisma.opsBackupRun.create({
      data: {
        id: uuidv4(),
        type: 'HEALTHCHECK',
        status: 'QUEUED',
        correlationId,
        initiatedByUserId: actorUserId,
      },
    });

    await this.audit.log({
      tenantId: 'system',
      actorUserId,
      action: 'ops.healthcheck.queued',
      entityType: 'OpsBackupRun',
      entityId: run.id,
      correlationId,
    });

    await this.queue.add('ops.healthcheck.run', { runId: run.id }, {
      jobId: `ops-hc-${run.id}`,
    });

    return { runId: run.id, status: run.status, correlationId };
  }

  // ─── Schedules ────────────────────────────────────────────────────────────

  async listSchedules() {
    const schedules = await this.prisma.opsSchedule.findMany({
      include: { storageTargets: { include: { storageTarget: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { data: schedules.map(s => this.serializeSchedule(s)) };
  }

  async createSchedule(body: {
    type: string;
    tenantId?: string;
    cronExpression: string;
    isEnabled?: boolean;
    retentionDays?: number;
    retentionPolicyJson?: any;
    storageTargetIds?: string[];
  }, actorUserId: string, correlationId: string) {
    const schedule = await this.prisma.opsSchedule.create({
      data: {
        type: body.type,
        tenantId: body.tenantId ?? null,
        cronExpression: body.cronExpression,
        isEnabled: body.isEnabled ?? true,
        retentionDays: body.retentionDays ?? 30,
        retentionPolicyJson: body.retentionPolicyJson ?? null,
        storageTargets: body.storageTargetIds?.length
          ? { create: body.storageTargetIds.map(id => ({ storageTargetId: id })) }
          : undefined,
      },
      include: { storageTargets: { include: { storageTarget: true } } },
    });

    await this.audit.log({
      tenantId: 'system',
      actorUserId,
      action: 'ops.schedule.created',
      entityType: 'OpsSchedule',
      entityId: schedule.id,
      correlationId,
      after: { type: body.type, cronExpression: body.cronExpression },
    });

    return this.serializeSchedule(schedule);
  }

  async updateSchedule(id: string, body: any, actorUserId: string, correlationId: string) {
    const existing = await this.prisma.opsSchedule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Schedule not found: ${id}`);

    const schedule = await this.prisma.opsSchedule.update({
      where: { id },
      data: {
        type:               body.type               ?? existing.type,
        tenantId:           body.tenantId           ?? existing.tenantId,
        cronExpression:     body.cronExpression      ?? existing.cronExpression,
        isEnabled:          body.isEnabled          ?? existing.isEnabled,
        retentionDays:      body.retentionDays       ?? existing.retentionDays,
        retentionPolicyJson: body.retentionPolicyJson ?? existing.retentionPolicyJson,
        ...(body.storageTargetIds ? {
          storageTargets: {
            deleteMany: {},
            create: body.storageTargetIds.map((tid: string) => ({ storageTargetId: tid })),
          },
        } : {}),
      },
      include: { storageTargets: { include: { storageTarget: true } } },
    });

    await this.audit.log({
      tenantId: 'system', actorUserId,
      action: 'ops.schedule.updated', entityType: 'OpsSchedule', entityId: id, correlationId,
    });

    return this.serializeSchedule(schedule);
  }

  async toggleSchedule(id: string, isEnabled: boolean, actorUserId: string, correlationId: string) {
    const existing = await this.prisma.opsSchedule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Schedule not found: ${id}`);

    const schedule = await this.prisma.opsSchedule.update({
      where: { id },
      data: { isEnabled },
      include: { storageTargets: { include: { storageTarget: true } } },
    });

    await this.audit.log({
      tenantId: 'system', actorUserId,
      action: `ops.schedule.${isEnabled ? 'enabled' : 'disabled'}`,
      entityType: 'OpsSchedule', entityId: id, correlationId,
    });

    return this.serializeSchedule(schedule);
  }

  // ─── Storage Targets ──────────────────────────────────────────────────────

  async listStorageTargets() {
    const targets = await this.prisma.opsStorageTarget.findMany({ orderBy: { createdAt: 'asc' } });
    return { data: targets };
  }

  async createStorageTarget(body: {
    type: string;
    name: string;
    configJson?: any;
    isEnabled?: boolean;
  }, actorUserId: string, correlationId: string) {
    const target = await this.prisma.opsStorageTarget.create({
      data: {
        type:      body.type,
        name:      body.name,
        configJson: body.configJson ?? null,
        isEnabled: body.isEnabled ?? true,
      },
    });

    await this.audit.log({
      tenantId: 'system', actorUserId,
      action: 'ops.storage_target.created', entityType: 'OpsStorageTarget', entityId: target.id, correlationId,
    });

    return target;
  }

  async updateStorageTarget(id: string, body: any, actorUserId: string, correlationId: string) {
    const existing = await this.prisma.opsStorageTarget.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Storage target not found: ${id}`);

    const target = await this.prisma.opsStorageTarget.update({
      where: { id },
      data: {
        type:      body.type      ?? existing.type,
        name:      body.name      ?? existing.name,
        configJson: body.configJson ?? existing.configJson,
        isEnabled: body.isEnabled  ?? existing.isEnabled,
      },
    });

    await this.audit.log({
      tenantId: 'system', actorUserId,
      action: 'ops.storage_target.updated', entityType: 'OpsStorageTarget', entityId: id, correlationId,
    });

    return target;
  }

  async toggleStorageTarget(id: string, isEnabled: boolean, actorUserId: string, correlationId: string) {
    const existing = await this.prisma.opsStorageTarget.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Storage target not found: ${id}`);

    const target = await this.prisma.opsStorageTarget.update({ where: { id }, data: { isEnabled } });

    await this.audit.log({
      tenantId: 'system', actorUserId,
      action: `ops.storage_target.${isEnabled ? 'enabled' : 'disabled'}`,
      entityType: 'OpsStorageTarget', entityId: id, correlationId,
    });

    return target;
  }

  async testStorageTarget(id: string, actorUserId: string, correlationId: string) {
    const target = await this.prisma.opsStorageTarget.findUnique({ where: { id } });
    if (!target) throw new NotFoundException(`Storage target not found: ${id}`);

    await this.queue.add('ops.storage_target.test', { targetId: id }, {
      jobId: `ops-storage-test-${id}-${Date.now()}`,
    });

    await this.audit.log({
      tenantId: 'system', actorUserId,
      action: 'ops.storage_target.test', entityType: 'OpsStorageTarget', entityId: id, correlationId,
    });

    // For LOCAL type, test synchronously
    if (target.type === 'LOCAL') {
      const config: any = target.configJson ?? {};
      const testPath = config.path ?? BACKUPS_DIR;
      try {
        fs.accessSync(testPath, fs.constants.W_OK);
        return { ok: true, message: `Local path accessible: ${testPath}` };
      } catch {
        return { ok: false, message: `Local path not writable: ${testPath}` };
      }
    }

    return { ok: true, message: `Test job queued for ${target.type} target` };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getDiskUsage() {
    const humanBytes = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
      return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    };

    const dirSize = (dir: string): number => {
      try {
        let total = 0;
        const walk = (d: string) => {
          if (!fs.existsSync(d)) return;
          for (const f of fs.readdirSync(d)) {
            const full = path.join(d, f);
            try {
              const s = fs.statSync(full);
              if (s.isDirectory()) walk(full);
              else total += s.size;
            } catch { /* skip */ }
          }
        };
        walk(dir);
        return total;
      } catch { return 0; }
    };

    const backupsBytes = dirSize(BACKUPS_DIR);
    const logsBytes    = dirSize(LOGS_DIR);

    return {
      backupsDirBytes:  backupsBytes,
      backupsDirHuman:  humanBytes(backupsBytes),
      logsDirBytes:     logsBytes,
      logsDirHuman:     humanBytes(logsBytes),
    };
  }

  private serializeRun(run: any) {
    return {
      ...run,
      artifactSizeBytes: run.artifactSizeBytes ? Number(run.artifactSizeBytes) : null,
    };
  }

  private serializeSchedule(schedule: any) {
    return {
      ...schedule,
      storageTargets: schedule.storageTargets?.map((st: any) => st.storageTarget) ?? [],
    };
  }
}
