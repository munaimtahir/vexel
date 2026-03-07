import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from '../templates.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

// Minimal mock factories
function makePrintTemplate(overrides: Record<string, any> = {}) {
  return {
    id: 'tpl-1',
    tenantId: 'tenant-1',
    code: 'general_table_v1',
    name: 'General Table',
    schemaType: 'TABULAR',
    templateFamily: 'GENERAL_TABLE',
    templateVersion: 1,
    status: 'DRAFT',
    configJson: {},
    isSystemProvisioned: false,
    sourceBlueprintId: null,
    supersedesTemplateId: null,
    createdByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePrismaService() {
  return {
    // Allow dynamic model access via (prisma as any).modelName
    templateBlueprint: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    printTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    testTemplateMap: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    catalogTest: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    tenantConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Test' }) },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(makePrismaService())),
  };
}

// Build proxy so (prisma as any).printTemplate still works after wrapping
function wrapWithDynamic(mock: any) {
  return new Proxy(mock, {
    get: (target, prop) => (prop in target ? target[prop] : target[prop]),
  });
}

describe('TemplatesService', () => {
  let service: TemplatesService;
  let prismaMock: ReturnType<typeof makePrismaService>;
  let auditMock: { log: jest.Mock };

  beforeEach(async () => {
    prismaMock = makePrismaService();
    auditMock = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
  });

  // ─── activateTemplate ──────────────────────────────────────────────────────

  describe('activateTemplate', () => {
    it('activates a DRAFT template successfully', async () => {
      const draft = makePrintTemplate({ status: 'DRAFT' });
      prismaMock.printTemplate.findUnique.mockResolvedValueOnce(draft);
      prismaMock.printTemplate.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.printTemplate.update.mockResolvedValue({ ...draft, status: 'ACTIVE' });

      const result = await service.activateTemplate('tenant-1', 'tpl-1', 'user-1', 'corr-1');
      expect(result.status).toBe('ACTIVE');
      expect(prismaMock.printTemplate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ARCHIVED' } }),
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'template.activate' }),
      );
    });

    it('throws ConflictException if template is already ACTIVE', async () => {
      prismaMock.printTemplate.findUnique.mockResolvedValueOnce(makePrintTemplate({ status: 'ACTIVE' }));
      await expect(service.activateTemplate('tenant-1', 'tpl-1', 'user-1', 'corr-1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if template is ARCHIVED', async () => {
      prismaMock.printTemplate.findUnique.mockResolvedValueOnce(makePrintTemplate({ status: 'ARCHIVED' }));
      await expect(service.activateTemplate('tenant-1', 'tpl-1', 'user-1', 'corr-1')).rejects.toThrow(ConflictException);
    });
  });

  // ─── archiveTemplate ───────────────────────────────────────────────────────

  describe('archiveTemplate', () => {
    it('archives a template with no default mappings', async () => {
      prismaMock.printTemplate.findUnique.mockResolvedValueOnce(makePrintTemplate({ status: 'ACTIVE' }));
      prismaMock.testTemplateMap.findMany.mockResolvedValue([]); // no default mappings
      prismaMock.printTemplate.update.mockResolvedValue({ ...makePrintTemplate(), status: 'ARCHIVED' });

      const result = await service.archiveTemplate('tenant-1', 'tpl-1', 'user-1', 'corr-1');
      expect(result.status).toBe('ARCHIVED');
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'template.archive' }),
      );
    });

    it('throws ConflictException if template is the default for a test', async () => {
      prismaMock.printTemplate.findUnique.mockResolvedValueOnce(makePrintTemplate({ status: 'ACTIVE' }));
      prismaMock.testTemplateMap.findMany.mockResolvedValue([{ id: 'map-1', isDefault: true, isEnabled: true }]);

      await expect(service.archiveTemplate('tenant-1', 'tpl-1', 'user-1', 'corr-1')).rejects.toThrow(ConflictException);
    });
  });

  // ─── createNewVersion ─────────────────────────────────────────────────────

  describe('createNewVersion', () => {
    it('throws ConflictException if template is not ACTIVE', async () => {
      prismaMock.printTemplate.findUnique.mockResolvedValueOnce(makePrintTemplate({ status: 'DRAFT' }));
      await expect(service.createNewVersion('tenant-1', 'tpl-1', 'user-1', 'corr-1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if template is ARCHIVED', async () => {
      prismaMock.printTemplate.findUnique.mockResolvedValueOnce(makePrintTemplate({ status: 'ARCHIVED' }));
      await expect(service.createNewVersion('tenant-1', 'tpl-1', 'user-1', 'corr-1')).rejects.toThrow(ConflictException);
    });

    it('creates a new DRAFT version from an ACTIVE template', async () => {
      const active = makePrintTemplate({ status: 'ACTIVE', templateVersion: 1 });
      prismaMock.printTemplate.findUnique
        .mockResolvedValueOnce(active)  // first getTemplate call
        .mockResolvedValueOnce(active); // second getTemplate call in updateTemplate

      prismaMock.printTemplate.count.mockResolvedValue(0); // for generateUniqueCode
      prismaMock.printTemplate.create.mockResolvedValue({
        ...active,
        id: 'tpl-2',
        status: 'DRAFT',
        templateVersion: 2,
        supersedesTemplateId: 'tpl-1',
      });

      const result = await service.createNewVersion('tenant-1', 'tpl-1', 'user-1', 'corr-1');
      expect(result.status).toBe('DRAFT');
      expect(result.templateVersion).toBe(2);
      expect(result.supersedesTemplateId).toBe('tpl-1');
    });
  });

  // ─── setTestMappings ──────────────────────────────────────────────────────

  describe('setTestMappings', () => {
    it('throws BadRequestException when two mappings are marked isDefault', async () => {
      prismaMock.catalogTest.findFirst.mockResolvedValue({
        id: 'test-1', tenantId: 'tenant-1', resultSchemaType: 'TABULAR',
      });

      await expect(
        service.setTestMappings('tenant-1', 'test-1', 'user-1', 'corr-1', {
          mappings: [
            { templateId: 'tpl-a', isDefault: true },
            { templateId: 'tpl-b', isDefault: true },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when template schemaType mismatches test', async () => {
      prismaMock.catalogTest.findFirst.mockResolvedValue({
        id: 'test-1', tenantId: 'tenant-1', resultSchemaType: 'TABULAR',
      });
      prismaMock.printTemplate.findUnique.mockResolvedValue(
        makePrintTemplate({ schemaType: 'HISTOPATHOLOGY', status: 'ACTIVE' }),
      );

      await expect(
        service.setTestMappings('tenant-1', 'test-1', 'user-1', 'corr-1', {
          mappings: [{ templateId: 'tpl-1', isDefault: true }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when template is archived', async () => {
      prismaMock.catalogTest.findFirst.mockResolvedValue({
        id: 'test-1', tenantId: 'tenant-1', resultSchemaType: 'TABULAR',
      });
      prismaMock.printTemplate.findUnique.mockResolvedValue(
        makePrintTemplate({ schemaType: 'TABULAR', status: 'ARCHIVED' }),
      );

      await expect(
        service.setTestMappings('tenant-1', 'test-1', 'user-1', 'corr-1', {
          mappings: [{ templateId: 'tpl-1', isDefault: true }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if template belongs to different tenant', async () => {
      prismaMock.catalogTest.findFirst.mockResolvedValue({
        id: 'test-1', tenantId: 'tenant-1', resultSchemaType: 'TABULAR',
      });
      prismaMock.printTemplate.findUnique.mockResolvedValue(
        makePrintTemplate({ tenantId: 'tenant-OTHER', schemaType: 'TABULAR', status: 'ACTIVE' }),
      );

      await expect(
        service.setTestMappings('tenant-1', 'test-1', 'user-1', 'corr-1', {
          mappings: [{ templateId: 'tpl-1', isDefault: true }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── resolveReportTemplate ────────────────────────────────────────────────

  describe('resolveReportTemplate', () => {
    it('returns test-specific default template when available', async () => {
      prismaMock.testTemplateMap.findFirst.mockResolvedValue({
        id: 'map-1',
        template: makePrintTemplate({ code: 'my_custom', templateFamily: 'TWO_COLUMN_TABLE', templateVersion: 2 }),
      });

      const result = await service.resolveReportTemplate('tenant-1', 'test-1');
      expect(result).not.toBeNull();
      expect(result!.templateCode).toBe('my_custom');
      expect(result!.templateFamily).toBe('TWO_COLUMN_TABLE');
      expect(result!.templateVersion).toBe(2);
    });

    it('falls back to tenant default GENERAL_TABLE template', async () => {
      prismaMock.testTemplateMap.findFirst.mockResolvedValue(null); // no test-specific
      prismaMock.printTemplate.findFirst.mockResolvedValue(
        makePrintTemplate({ code: 'general_table_v1', templateFamily: 'GENERAL_TABLE', templateVersion: 1 }),
      );

      const result = await service.resolveReportTemplate('tenant-1', 'test-1');
      expect(result).not.toBeNull();
      expect(result!.templateCode).toBe('general_table_v1');
      expect(result!.templateFamily).toBe('GENERAL_TABLE');
    });

    it('returns null if no template is configured at all', async () => {
      prismaMock.testTemplateMap.findFirst.mockResolvedValue(null);
      prismaMock.printTemplate.findFirst.mockResolvedValue(null);

      const result = await service.resolveReportTemplate('tenant-1');
      expect(result).toBeNull();
    });
  });
});
