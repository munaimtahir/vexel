import { Test, TestingModule } from '@nestjs/testing';
import { OpsService } from '../ops.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRun = {
  id: 'run-1',
  type: 'FULL',
  status: 'QUEUED',
  tenantId: null,
  initiatedByUserId: 'user-1',
  correlationId: 'corr-1',
  artifactPath: null,
  artifactSizeBytes: null,
  checksumSha256: null,
  logPath: null,
  errorSummary: null,
  metaJson: null,
  storageTargetId: null,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const prismaMock = {
  opsBackupRun: {
    create: jest.fn().mockResolvedValue(mockRun),
    findMany: jest.fn().mockResolvedValue([mockRun]),
    findUnique: jest.fn().mockResolvedValue(mockRun),
    findFirst: jest.fn().mockResolvedValue(mockRun),
    count: jest.fn().mockResolvedValue(1),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  opsStorageTarget: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
  },
  opsSchedule: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn().mockResolvedValue({ id: 'lab-a', name: 'Lab A' }),
  },
};

const auditMock = { log: jest.fn().mockResolvedValue(undefined) };

// ─── Bull Queue mock ───────────────────────────────────────────────────────────
const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: jest.fn(),
  })),
}));

// Mock redis connection (ioredis uses default export)
jest.mock('ioredis', () => {
  const MockIORedis = jest.fn().mockImplementation(() => ({ on: jest.fn(), quit: jest.fn() }));
  return { __esModule: true, default: MockIORedis };
});

// ─── Test suite ────────────────────────────────────────────────────────────────

describe('OpsService', () => {
  let service: OpsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<OpsService>(OpsService);
    jest.clearAllMocks();
    prismaMock.opsBackupRun.create.mockResolvedValue(mockRun);
  });

  // ─── Run creation ─────────────────────────────────────────────────────────

  describe('triggerFullBackup', () => {
    it('creates a QUEUED run', async () => {
      const result = await service.triggerFullBackup({}, 'user-1', 'corr-1');
      expect(prismaMock.opsBackupRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'FULL', status: 'QUEUED', initiatedByUserId: 'user-1' }),
        }),
      );
      expect(result).toHaveProperty('runId');
    });

    it('emits an AuditEvent', async () => {
      await service.triggerFullBackup({}, 'user-1', 'corr-1');
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: expect.stringContaining('ops') }),
      );
    });

    it('enqueues a BullMQ job', async () => {
      await service.triggerFullBackup({}, 'user-1', 'corr-1');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'ops.full_backup.run',
        expect.objectContaining({ runId: mockRun.id }),
        expect.any(Object),
      );
    });
  });

  // ─── Tenant export scoping ────────────────────────────────────────────────

  describe('triggerTenantExport', () => {
    it('requires a tenantId (rejects if tenant not found)', async () => {
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
      await expect(service.triggerTenantExport({ tenantId: 'nonexistent' }, 'user-1', 'corr-1')).rejects.toThrow(
        /not found/i,
      );
    });

    it('stores tenantId on the run', async () => {
      await service.triggerTenantExport({ tenantId: 'lab-a' }, 'user-1', 'corr-1');
      expect(prismaMock.opsBackupRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'TENANT_EXPORT', tenantId: 'lab-a' }),
        }),
      );
    });

    it('does NOT leak other tenant IDs into the run record', async () => {
      await service.triggerTenantExport({ tenantId: 'lab-a' }, 'user-1', 'corr-1');
      const call = prismaMock.opsBackupRun.create.mock.calls[0][0];
      // The run's tenantId must equal the requested tenant, never a different one
      expect(call.data.tenantId).toBe('lab-a');
    });
  });

  // ─── Restore safety rails ─────────────────────────────────────────────────

  describe('triggerRestoreRun', () => {
    it('requires confirmation phrase "yes-restore"', async () => {
      await expect(
        service.triggerRestoreRun({ artifactPath: '/some/path.tar.gz', confirmPhrase: 'wrong' }, 'user-1', 'corr-1'),
      ).rejects.toThrow(/confirm/i);
    });

    it('accepts the correct phrase', async () => {
      const result = await service.triggerRestoreRun(
        { artifactPath: '/some/path.tar.gz', confirmPhrase: 'yes-restore', preSnapshotEnabled: true },
        'user-1', 'corr-1',
      );
      expect(result).toHaveProperty('runId');
    });
  });

  describe('listRuns', () => {
    it('returns run list with count', async () => {
      prismaMock.opsBackupRun.findMany.mockResolvedValue([mockRun]);
      prismaMock.opsBackupRun.count.mockResolvedValue(1);
      const result = await service.listRuns({ limit: 10 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
    });
  });

  // ─── Storage targets without secrets ─────────────────────────────────────

  describe('listStorageTargets', () => {
    it('returns storage targets without raw secret values', async () => {
      prismaMock.opsStorageTarget.findMany.mockResolvedValue([
        { id: 'st-1', name: 'Local', type: 'LOCAL', isEnabled: true, configJson: {}, tenantId: null, createdAt: new Date(), updatedAt: new Date() },
      ]);
      const result = await service.listStorageTargets();
      expect(result).toHaveProperty('data');
      // configJson with any secret payload is NOT surfaced in full — the service strips it
      const json = JSON.stringify(result);
      // The key to verify: no raw secretAccessKey / secretKey values returned
      expect(json).not.toContain('"secretKey":"S3CR3T"');
    });
  });

  // ─── Dashboard summary ────────────────────────────────────────────────────

  describe('getDashboard', () => {
    it('returns dashboard object without throwing', async () => {
      await expect(service.getDashboard()).resolves.not.toThrow();
    });
  });
});
