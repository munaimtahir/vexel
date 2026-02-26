import { DocumentsService } from '../documents.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  tenantId: 'tenant-1',
  type: 'RECEIPT',
  templateId: 'tpl-1',
  payloadJson: {},
  payloadHash: 'hash-abc',
  pdfHash: null,
  status: 'DRAFT',
  version: 1,
  sourceRef: null,
  sourceType: null,
  errorMessage: null,
  publishedAt: null,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockTemplate = {
  id: 'tpl-1',
  tenantId: 'tenant-1',
  type: 'RECEIPT',
  templateKey: 'receipt_v1',
  version: 1,
  isActive: true,
};

const mockTenantConfig = {
  id: 'cfg-1',
  tenantId: 'tenant-1',
  brandName: 'Test Clinic',
  logoUrl: null,
  reportHeader: null,
  reportFooter: null,
};

const mockTenant = { id: 'tenant-1', name: 'Test Tenant' };
const mockEncounter = {
  id: 'enc-1',
  tenantId: 'tenant-1',
  status: 'verified',
  createdAt: new Date('2025-01-11T10:00:00.000Z'),
  updatedAt: new Date('2025-01-11T10:00:00.000Z'),
  patient: {
    id: 'pat-1',
    tenantId: 'tenant-1',
    firstName: 'Jane',
    lastName: 'Doe',
    mrn: 'MRN-001',
    dateOfBirth: new Date('2000-01-10T00:00:00.000Z'),
    gender: 'female',
  },
  labOrders: [],
};

function buildPrisma(docOverrides: Record<string, unknown> = {}) {
  return {
    tenantFeature: {
      findUnique: jest.fn().mockResolvedValue({ enabled: true }),
    },
    documentTemplate: {
      findFirst: jest.fn().mockResolvedValue(mockTemplate),
    },
    tenantConfig: {
      findUnique: jest.fn().mockResolvedValue(mockTenantConfig),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue(mockTenant),
    },
    document: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockDoc(docOverrides)),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(mockDoc({ ...docOverrides, ...data }))),
      findMany: jest.fn().mockResolvedValue([]),
    },
    encounter: {
      findFirst: jest.fn().mockResolvedValue(mockEncounter),
    },
    specimenItem: {
      findFirst: jest.fn().mockResolvedValue({
        createdAt: new Date('2025-01-11T10:05:00.000Z'),
        collectedAt: new Date('2025-01-11T10:05:00.000Z'),
      }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ firstName: 'Verifier', lastName: 'User' }),
    },
    auditEvent: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue({
        actorUserId: 'user-verify',
        createdAt: new Date('2025-01-11T10:30:00.000Z'),
      }),
    },
  };
}

function buildQueue() {
  return { add: jest.fn().mockResolvedValue({}) };
}

function buildAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

// Patch Queue constructor to return mock
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn().mockResolvedValue({}) })),
}));
jest.mock('ioredis', () => {
  const mock = jest.fn().mockImplementation(() => ({}));
  (mock as any).default = mock;
  return mock;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: ReturnType<typeof buildAudit>;

  beforeEach(() => {
    prisma = buildPrisma();
    audit = buildAudit();
    service = new DocumentsService(prisma as any, audit as any, {} as any);
  });

  describe('generateDocument', () => {
    it('returns created: true for new document', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      const result = await service.generateDocument(
        'tenant-1', 'RECEIPT', { receiptNumber: 'RCP-001' },
        undefined, undefined, 'user-1', 'corr-1',
      );
      expect(result.created).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'document.generate' }));
    });

    it('returns created: false (idempotent) when same payloadHash exists with non-FAILED status', async () => {
      prisma.document.findUnique.mockResolvedValue(mockDoc({ status: 'RENDERED' }));
      const result = await service.generateDocument(
        'tenant-1', 'RECEIPT', { receiptNumber: 'RCP-001' },
        undefined, undefined, 'user-1', 'corr-1',
      );
      expect(result.created).toBe(false);
      expect(result.document.id).toBe('doc-1');
      // Should NOT enqueue or create
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when module.lims is disabled', async () => {
      prisma.tenantFeature.findUnique.mockResolvedValue({ enabled: false });
      await expect(
        service.generateDocument('tenant-1', 'RECEIPT', {}, undefined, undefined, 'user-1', 'corr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when no active template exists', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.generateDocument('tenant-1', 'RECEIPT', {}, undefined, undefined, 'user-1', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('normalizes receipt issuedAt deterministically from encounter source', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await service.generateDocument(
        'tenant-1',
        'RECEIPT',
        { receiptNumber: 'RCP-001', issuedAt: '2099-01-01T00:00:00.000Z', patientAge: '99Y' },
        'enc-1',
        'ENCOUNTER',
        'user-1',
        'corr-1',
      );

      const payload = prisma.document.create.mock.calls[0][0].data.payloadJson;
      expect(payload.issuedAt).toBe('2025-01-11T10:00:00.000Z');
      expect(payload.patientAge).toBe('25Y');
    });

    it('generateFromEncounter keeps deterministic payload and idempotency on retry', async () => {
      prisma.document.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockDoc({ type: 'LAB_REPORT', status: 'RENDERED' }));

      const first = await service.generateFromEncounter('tenant-1', 'enc-1', 'user-1', 'corr-1');
      const second = await service.generateFromEncounter('tenant-1', 'enc-1', 'user-1', 'corr-2');

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(prisma.document.create).toHaveBeenCalledTimes(1);

      const payload = prisma.document.create.mock.calls[0][0].data.payloadJson;
      expect(payload.issuedAt).toBe('2025-01-11T10:30:00.000Z');
      expect(payload.patientAge).toBe('25Y');
      expect(payload.printedAt).toBeUndefined();
    });
  });

  describe('publishDocument', () => {
    it('publishes a RENDERED document and writes audit event', async () => {
      prisma.document.findUnique.mockResolvedValue(mockDoc({ status: 'RENDERED' }));
      const result = await service.publishDocument('tenant-1', 'doc-1', 'user-1', 'corr-1');
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'document.publish' }));
    });

    it('returns document as-is when already PUBLISHED (idempotent, no 409)', async () => {
      prisma.document.findUnique.mockResolvedValue(mockDoc({ status: 'PUBLISHED' }));
      const result = await service.publishDocument('tenant-1', 'doc-1', 'user-1', 'corr-1');
      expect(result.status).toBe('PUBLISHED');
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('throws 409 when document is in DRAFT status', async () => {
      prisma.document.findUnique.mockResolvedValue(mockDoc({ status: 'DRAFT' }));
      await expect(
        service.publishDocument('tenant-1', 'doc-1', 'user-1', 'corr-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when document belongs to different tenant', async () => {
      prisma.document.findUnique.mockResolvedValue(mockDoc({ tenantId: 'other-tenant' }));
      await expect(
        service.publishDocument('tenant-1', 'doc-1', 'user-1', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
