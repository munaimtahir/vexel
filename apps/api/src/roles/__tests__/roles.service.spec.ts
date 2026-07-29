import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from '../roles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ConflictException } from '@nestjs/common';

describe('RolesService', () => {
  let service: RolesService;
  let prismaMock: any;
  let auditMock: any;

  beforeEach(async () => {
    prismaMock = {
      role: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'r1', ...data, rolePermissions: [] })),
      },
    };

    auditMock = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should list roles for tenant', async () => {
    const roles = await service.list('tenant-a');
    expect(roles).toEqual([]);
    expect(prismaMock.role.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      include: { rolePermissions: true },
      orderBy: { name: 'asc' },
    });
  });

  it('should prevent duplicate role names in same tenant', async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: 'r0', name: 'Operator' });
    await expect(
      service.create('tenant-a', { name: 'Operator', permissions: ['patient.manage'] }, 'actor-1')
    ).rejects.toThrow(ConflictException);
  });
});
