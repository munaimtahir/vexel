import { ForbiddenException } from '@nestjs/common';
import { AuditEventsController } from './audit-events.controller';

describe('AuditEventsController', () => {
  const svc = { list: jest.fn().mockResolvedValue({ data: [], pagination: {} }) } as any;
  const controller = new AuditEventsController(svc);

  beforeEach(() => jest.clearAllMocks());

  it('always derives tenant audit scope from the authenticated user', async () => {
    await controller.list(
      { user: { tenantId: 'tenant-a' } } as any,
      'actor', undefined, undefined, undefined, undefined, undefined, undefined, '1', '20',
    );
    expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', actorUserId: 'actor' }));
  });

  it('rejects platform-wide audit access for a non-super-admin', async () => {
    await expect(controller.listPlatform(
      { user: { isSuperAdmin: false } } as any,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, '1', '20',
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an explicit platform query only for a super-admin', async () => {
    await controller.listPlatform(
      { user: { isSuperAdmin: true } } as any,
      'tenant-b', undefined, undefined, undefined, undefined, undefined, undefined, '1', '20',
    );
    expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-b' }));
  });
});
