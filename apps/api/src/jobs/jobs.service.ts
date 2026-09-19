import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { AuditService } from '../audit/audit.service';

const QUEUE_NAMES = ['document-render', 'catalog-import', 'catalog-export', 'ops-backup'] as const;
type QueueName = typeof QUEUE_NAMES[number];

function getRedisConnection() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new IORedis(url, { maxRetriesPerRequest: null });
}

@Injectable()
export class JobsService {
  private readonly queues: Map<QueueName, Queue>;

  constructor(private readonly audit: AuditService) {
    this.queues = new Map(QUEUE_NAMES.map((name) => [
      name,
      new Queue(name, { connection: getRedisConnection() as any }),
    ]));
  }

  private queueNames(requested?: string): QueueName[] {
    if (!requested) return [...QUEUE_NAMES];
    if ((QUEUE_NAMES as readonly string[]).includes(requested)) return [requested as QueueName];
    return [];
  }

  private safeData(data: Record<string, any> | undefined) {
    if (!data || typeof data !== 'object') return {};
    const allowed = ['tenantId', 'jobRunId', 'correlationId', 'documentId', 'encounterId', 'type'];
    return Object.fromEntries(allowed.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
  }

  private async toRow(queue: QueueName, job: any) {
    const status = await job.getState();
    return {
      id: job.id,
      queue,
      name: job.name,
      status,
      data: this.safeData(job.data),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
    };
  }

  private belongsToTenant(job: any, tenantId: string, isSuperAdmin: boolean) {
    return isSuperAdmin || job?.data?.tenantId === tenantId;
  }

  async list(q: { page?: number; limit?: number; status?: string; queue?: string }, scope: { tenantId: string; isSuperAdmin?: boolean }) {
    const { page = 1, limit = 20, status } = q;
    const types = status ? [status as any] : ['waiting', 'active', 'completed', 'failed', 'delayed'];
    const queueNames = this.queueNames(q.queue);
    const allJobs = (await Promise.all(queueNames.map(async (queue) => {
      const jobs = await this.queues.get(queue)!.getJobs(types, 0, -1);
      return jobs.filter((job) => this.belongsToTenant(job, scope.tenantId, scope.isSuperAdmin === true))
        .map((job) => ({ queue, job }));
    }))).flat();
    allJobs.sort((a, b) => (b.job.timestamp ?? 0) - (a.job.timestamp ?? 0));
    const pageJobs = allJobs.slice((Number(page) - 1) * Number(limit), Number(page) * Number(limit));
    const rows = await Promise.all(pageJobs.map(({ queue, job }) => this.toRow(queue, job)));

    return {
      data: rows,
      pagination: { page: Number(page), limit: Number(limit), total: allJobs.length, totalPages: Math.ceil(allJobs.length / Number(limit)) },
    };
  }

  async listFailed(q: { page?: number; limit?: number }, scope: { tenantId: string; isSuperAdmin?: boolean }) {
    return this.list({ ...q, status: 'failed' }, scope);
  }

  async failedCount(scope: { tenantId: string; isSuperAdmin?: boolean }) {
    const result = await this.list({ status: 'failed', page: 1, limit: 1 }, scope);
    return { count: result.pagination.total };
  }

  async retryJob(
    jobId: string,
    opts: { tenantId: string; actorUserId: string; correlationId?: string; isSuperAdmin?: boolean },
  ) {
    let queue: QueueName | undefined;
    let job: any;
    for (const candidate of QUEUE_NAMES) {
      const found = await this.queues.get(candidate)!.getJob(jobId);
      if (found) { queue = candidate; job = found; break; }
    }
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    if (!this.belongsToTenant(job, opts.tenantId, opts.isSuperAdmin === true)) {
      throw new ForbiddenException('Job does not belong to the current tenant');
    }

    const state = await job.getState();
    if (state !== 'failed') {
      throw new ConflictException(`Job ${jobId} is not in a failed state (current: ${state})`);
    }

    await job.retry();

    await this.audit.log({
      tenantId: opts.tenantId,
      actorUserId: opts.actorUserId,
      action: 'job.retry',
      entityType: 'Job',
      entityId: jobId,
      correlationId: opts.correlationId,
    });

    return {
      id: job.id,
      queue,
      name: job.name,
      status: 'waiting',
      attemptsMade: job.attemptsMade,
      createdAt: new Date(job.timestamp).toISOString(),
    };
  }
}
