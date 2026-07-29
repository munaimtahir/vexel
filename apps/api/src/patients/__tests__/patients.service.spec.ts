import { Test, TestingModule } from '@nestjs/testing';
import { PatientsService } from '../patients.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotFoundException } from '@nestjs/common';

describe('PatientsService', () => {
  let service: PatientsService;
  let prismaMock: any;
  let auditMock: any;

  beforeEach(async () => {
    prismaMock = {
      patient: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'p1', ...data })),
      },
      tenantConfig: {
        findUnique: jest.fn().mockResolvedValue({ registrationPrefix: 'PT' }),
      },
    };

    auditMock = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
  });

  it('should list patients with tenant isolation', async () => {
    const res = await service.list('tenant-a', { page: 1, limit: 10 });
    expect(res.data).toEqual([]);
    expect(res.pagination.total).toBe(0);
    expect(prismaMock.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) })
    );
  });

  it('should find patient by mobile', async () => {
    await service.findByMobile('tenant-a', '03001234567');
    expect(prismaMock.patient.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', mobile: '0300-1234567' },
    });
  });

  it('should generate MRN with prefix', async () => {
    const mrn = await service.generateMrn('tenant-a');
    expect(mrn).toMatch(/^PT-\d{2}-0001$/);
  });
});
