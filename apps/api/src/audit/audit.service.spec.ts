import { AuditService } from './audit.service';

describe('AuditService policy', () => {
  function makeService() {
    const prisma = {
      auditEvent: {
        create: jest.fn(),
      },
    };
    return { service: new AuditService(prisma as any), prisma };
  }

  it('throws when required audit write fails', async () => {
    const { service, prisma } = makeService();
    prisma.auditEvent.create.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.logRequired({
        tenantId: 'tenant-a',
        action: 'encounter.verify',
      }),
    ).rejects.toThrow('Required audit event write failed');
  });

  it('default mode is required', async () => {
    const { service, prisma } = makeService();
    prisma.auditEvent.create.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.log({
        tenantId: 'tenant-a',
        action: 'encounter.verify',
      }),
    ).rejects.toThrow('Required audit event write failed');
  });

  it('does not throw when best-effort audit write fails', async () => {
    const { service, prisma } = makeService();
    prisma.auditEvent.create.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.logBestEffort({
        tenantId: 'tenant-a',
        action: 'tenant.service_health.read',
      }),
    ).resolves.toBeUndefined();
  });
});
