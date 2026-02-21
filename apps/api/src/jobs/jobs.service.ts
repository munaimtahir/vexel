import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { AuditService } from '../audit/audit.service';

const QUEUE_NAME = 'jobs';

function getRedisConnection() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new IORedis(url, { maxRetriesPerRequest: null });
}

@Injectable()
export class JobsService {
  private readonly queue: Queue;

  constructor(private readonly audit: AuditService) {
    this.queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
  }

  async list(q: { page?: number; limit?: number; status?: string }) {
    const { page = 1, limit = 20, status } = q;
    const types = status ? [status as any] : ['waiting', 'active', 'completed', 'failed', 'delayed'];
    const jobs = await this.queue.getJobs(types, (page - 1) * limit, (page - 1) * limit + limit - 1);
    const total = await this.queue.getJobCounts(...types);
    const totalCount = Object.values(total).reduce((a, b) => a + b, 0);

    return {
      data: jobs.map((j) => ({
        id: j.id,
        queue: QUEUE_NAME,
        name: j.name,
        status: (j as any).failedReason ? 'failed' : 'unknown',
        data: j.data,
        attemptsMade: j.attemptsMade,
        failedReason: (j as any).failedReason ?? null,
        createdAt: new Date(j.timestamp).toISOString(),
        processedAt: j.processedOn ? new Date(j.processedOn).toISOString() : null,
      })),
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    };
  }

  async listFailed(q: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = q;
    const jobs = await this.queue.getFailed((page - 1) * limit, (page - 1) * limit + limit - 1);
    const total = await this.queue.getFailedCount();
    return {
      data: jobs.map((j) => ({
        id: j.id,
        queue: QUEUE_NAME,
        name: j.name,
        status: 'failed',
        data: j.data,
        attemptsMade: j.attemptsMade,
        failedReason: (j as any).failedReason ?? null,
        createdAt: new Date(j.timestamp).toISOString(),
        processedAt: j.processedOn ? new Date(j.processedOn).toISOString() : null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async failedCount() {
    const count = await this.queue.getFailedCount();
    return { count };
  }

  async retryJob(
    jobId: string,
    opts: { tenantId: string; actorUserId: string; correlationId?: string },
  ) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

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
      queue: QUEUE_NAME,
      name: job.name,
      status: 'waiting',
      attemptsMade: job.attemptsMade,
      createdAt: new Date(job.timestamp).toISOString(),
    };
  }
}
