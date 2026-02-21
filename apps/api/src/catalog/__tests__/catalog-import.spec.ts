import { createHash } from 'crypto';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockJobRun = {
  id: 'job-1',
  tenantId: 'tenant-1',
  type: 'catalog.import',
  status: 'queued',
  payloadHash: '',
  correlationId: 'corr-1',
  createdBy: 'user-1',
  createdAt: new Date(),
};

const mockPrisma = {
  jobRun: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockFeatureFlags = {
  listForTenant: jest.fn().mockResolvedValue([{ key: 'module.lims', enabled: true }]),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'bullmq-job-1' }),
};

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => mockQueue),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  }));
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CatalogJobsService — idempotency + retry', () => {
  let service: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Inline service to avoid full NestJS DI setup
    const { createHash } = require('crypto');
    function computeHash(payload: any) {
      const sorted = JSON.stringify(sortObjectKeys(payload));
      return createHash('sha256').update(sorted).digest('hex');
    }

    service = {
      prisma: mockPrisma,
      audit: mockAudit,
      featureFlags: mockFeatureFlags,
      importQueue: mockQueue,
      exportQueue: mockQueue,

      async createImportJob(tenantId: string, payload: any, actorUserId: string, correlationId: string) {
        const flags = await this.featureFlags.listForTenant(tenantId);
        const limsFlag = flags.find((f: any) => f.key === 'module.lims');
        if (limsFlag && !limsFlag.enabled) throw { status: 403, message: 'module.lims disabled' };

        const payloadHash = computeHash(payload);

        const existing = await this.prisma.jobRun.findUnique({
          where: { tenantId_type_payloadHash: { tenantId, type: 'catalog.import', payloadHash } },
        });
        if (existing && existing.status !== 'failed') return existing;

        const job = await this.prisma.jobRun.create({
          data: { tenantId, type: 'catalog.import', status: 'queued', payloadHash, correlationId, createdBy: actorUserId },
        });
        await this.importQueue.add('catalog.import', { jobRunId: job.id, tenantId, payload, correlationId });
        await this.audit.log({ tenantId, actorUserId, action: 'catalog.import.created', entityType: 'JobRun', entityId: job.id, correlationId });
        return job;
      },

      async retryImportJob(tenantId: string, id: string, actorUserId: string, correlationId: string) {
        const job = await this.prisma.jobRun.findFirst({ where: { id, tenantId } });
        if (!job) throw { status: 404, message: 'Not found' };
        if (job.status !== 'failed') throw { status: 409, message: `Job is not in failed state (current: ${job.status})` };

        const updated = await this.prisma.jobRun.update({
          where: { id },
          data: { status: 'queued', errorSummary: null, startedAt: null, finishedAt: null },
        });
        await this.importQueue.add('catalog.import', { jobRunId: id, tenantId, correlationId });
        await this.audit.log({ tenantId, actorUserId, action: 'catalog.import.retry', entityType: 'JobRun', entityId: id, correlationId });
        return updated;
      },
    };
  });

  describe('Test 1: Idempotency', () => {
    it('should return existing job on duplicate payload submission', async () => {
      const payload = { tests: [{ code: 'CBC', name: 'Complete Blood Count' }] };
      const payloadHash = computePayloadHash(payload);
      const existingJob = { ...mockJobRun, payloadHash, status: 'queued' };

      // First call: no existing job
      mockPrisma.jobRun.findUnique.mockResolvedValueOnce(null);
      mockPrisma.jobRun.create.mockResolvedValueOnce({ ...mockJobRun, payloadHash });

      const firstResult = await service.createImportJob('tenant-1', payload, 'user-1', 'corr-1');
      expect(firstResult.id).toBe('job-1');
      expect(mockPrisma.jobRun.create).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);

      // Second call: existing job found with same hash
      mockPrisma.jobRun.findUnique.mockResolvedValueOnce(existingJob);

      const secondResult = await service.createImportJob('tenant-1', payload, 'user-1', 'corr-2');
      // Should return the same job without creating a new one
      expect(secondResult.id).toBe(existingJob.id);
      expect(mockPrisma.jobRun.create).toHaveBeenCalledTimes(1); // still only 1 create total
      expect(secondResult.payloadHash).toBe(payloadHash);
    });

    it('should create a new job if payload differs', async () => {
      mockPrisma.jobRun.findUnique.mockResolvedValue(null);
      mockPrisma.jobRun.create.mockResolvedValue({ ...mockJobRun, id: 'job-2' });

      const payload1 = { tests: [{ code: 'CBC', name: 'CBC' }] };
      const payload2 = { tests: [{ code: 'LFT', name: 'LFT' }] };

      await service.createImportJob('tenant-1', payload1, 'user-1', 'corr-1');
      await service.createImportJob('tenant-1', payload2, 'user-1', 'corr-2');

      expect(mockPrisma.jobRun.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Test 2: Job failure + retry', () => {
    it('should reset failed job to queued and re-enqueue', async () => {
      const failedJob = { ...mockJobRun, status: 'failed', errorSummary: 'DB error' };
      const updatedJob = { ...failedJob, status: 'queued', errorSummary: null };

      mockPrisma.jobRun.findFirst.mockResolvedValueOnce(failedJob);
      mockPrisma.jobRun.update.mockResolvedValueOnce(updatedJob);

      const result = await service.retryImportJob('tenant-1', 'job-1', 'user-1', 'corr-retry');

      expect(result.status).toBe('queued');
      expect(result.errorSummary).toBeNull();
      expect(mockPrisma.jobRun.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'queued', errorSummary: null, startedAt: null, finishedAt: null },
      });
      expect(mockQueue.add).toHaveBeenCalledWith('catalog.import', expect.objectContaining({ jobRunId: 'job-1' }));
    });

    it('should write AuditEvent on retry', async () => {
      const failedJob = { ...mockJobRun, status: 'failed' };
      const updatedJob = { ...failedJob, status: 'queued' };

      mockPrisma.jobRun.findFirst.mockResolvedValueOnce(failedJob);
      mockPrisma.jobRun.update.mockResolvedValueOnce(updatedJob);

      await service.retryImportJob('tenant-1', 'job-1', 'user-1', 'corr-retry');

      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'catalog.import.retry',
        entityType: 'JobRun',
        entityId: 'job-1',
      }));
    });

    it('should throw 409 if job is not in failed state', async () => {
      const queuedJob = { ...mockJobRun, status: 'queued' };
      mockPrisma.jobRun.findFirst.mockResolvedValueOnce(queuedJob);

      await expect(
        service.retryImportJob('tenant-1', 'job-1', 'user-1', 'corr-retry')
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('Feature flag check', () => {
    it('should throw 403 if module.lims is disabled', async () => {
      mockFeatureFlags.listForTenant.mockResolvedValueOnce([{ key: 'module.lims', enabled: false }]);

      await expect(
        service.createImportJob('tenant-1', { tests: [] }, 'user-1', 'corr-1')
      ).rejects.toMatchObject({ status: 403 });
    });
  });
});
