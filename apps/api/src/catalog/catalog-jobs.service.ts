import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

function getRedisConnection() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new IORedis(url, { maxRetriesPerRequest: null });
}

function computePayloadHash(payload: any): string {
  const sorted = JSON.stringify(sortObjectKeys(payload));
  return createHash('sha256').update(sorted).digest('hex');
}

function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc: any, key) => {
      acc[key] = sortObjectKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

@Injectable()
export class CatalogJobsService {
  private readonly importQueue: Queue;
  private readonly exportQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly featureFlags: FeatureFlagsService,
  ) {
    const conn = getRedisConnection();
    this.importQueue = new Queue('catalog-import', { connection: conn as any });
    this.exportQueue = new Queue('catalog-export', { connection: conn as any });
  }

  async createImportJob(tenantId: string, payload: any, actorUserId: string, correlationId: string) {
    const flags = await this.featureFlags.listForTenant(tenantId);
    const limsFlag = flags.find((f) => f.key === 'module.lims');
    if (limsFlag && !limsFlag.enabled) {
      throw new ForbiddenException('module.lims feature is disabled for this tenant');
    }

    const payloadHash = computePayloadHash(payload);

    const existing = await this.prisma.jobRun.findUnique({
      where: { tenantId_type_payloadHash: { tenantId, type: 'catalog.import', payloadHash } },
    });
    if (existing && existing.status !== 'failed') {
      return existing;
    }

    const job = await this.prisma.jobRun.create({
      data: {
        tenantId,
        type: 'catalog.import',
        status: 'queued',
        payloadHash,
        correlationId,
        createdBy: actorUserId,
      },
    });

    await this.importQueue.add('catalog.import', { jobRunId: job.id, tenantId, payload, correlationId });

    await this.audit.log({
      tenantId, actorUserId, action: 'catalog.import.created',
      entityType: 'JobRun', entityId: job.id, correlationId,
    });

    return job;
  }

  async retryImportJob(tenantId: string, id: string, actorUserId: string, correlationId: string) {
    const job = await this.prisma.jobRun.findFirst({ where: { id, tenantId } });
    if (!job) throw new NotFoundException('Import job not found');
    if (job.status !== 'failed') throw new ConflictException(`Job is not in failed state (current: ${job.status})`);

    const updated = await this.prisma.jobRun.update({
      where: { id },
      data: { status: 'queued', errorSummary: null, startedAt: null, finishedAt: null },
    });

    await this.importQueue.add('catalog.import', { jobRunId: id, tenantId, correlationId });

    await this.audit.log({
      tenantId, actorUserId, action: 'catalog.import.retry',
      entityType: 'JobRun', entityId: id, correlationId,
    });

    return updated;
  }

  async listImportJobs(tenantId: string, opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = opts;
    const where = { tenantId, type: 'catalog.import' };
    const [data, total] = await Promise.all([
      this.prisma.jobRun.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.jobRun.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getImportJob(tenantId: string, id: string) {
    const job = await this.prisma.jobRun.findFirst({ where: { id, tenantId, type: 'catalog.import' } });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  async createExportJob(tenantId: string, actorUserId: string, correlationId: string) {
    const job = await this.prisma.jobRun.create({
      data: {
        tenantId,
        type: 'catalog.export',
        status: 'queued',
        correlationId,
        createdBy: actorUserId,
      },
    });

    await this.exportQueue.add('catalog.export', { jobRunId: job.id, tenantId, correlationId });

    await this.audit.log({
      tenantId, actorUserId, action: 'catalog.export.created',
      entityType: 'JobRun', entityId: job.id, correlationId,
    });

    return job;
  }

  async listExportJobs(tenantId: string, opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = opts;
    const where = { tenantId, type: 'catalog.export' };
    const [data, total] = await Promise.all([
      this.prisma.jobRun.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.jobRun.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getExportJob(tenantId: string, id: string) {
    const job = await this.prisma.jobRun.findFirst({ where: { id, tenantId, type: 'catalog.export' } });
    if (!job) throw new NotFoundException('Export job not found');
    return job;
  }
}
