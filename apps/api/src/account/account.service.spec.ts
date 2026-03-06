import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AccountService } from './account.service';

describe('AccountService', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const prisma: any = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  const service = new AccountService(prisma, audit as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves safe admin landing for non-admin users', () => {
    const result = service.getAdminNavigationSummary({
      userId: 'u1',
      email: 'user@example.com',
      tenantId: 't1',
      permissions: ['patient.manage'],
      isSuperAdmin: false,
    });

    expect(result.hasAdminAppAccess).toBe(false);
    expect(result.landingPath).toBe('/account');
    expect(result.sections.find((s: any) => s.key === 'account')?.allowed).toBe(true);
    expect(result.sections.find((s: any) => s.key === 'catalog')?.allowed).toBe(false);
  });

  it('resolves dashboard landing when admin access is granted', () => {
    const result = service.getAdminNavigationSummary({
      userId: 'u1',
      email: 'admin@example.com',
      tenantId: 't1',
      permissions: ['admin.app.access', 'admin.dashboard.read'],
      isSuperAdmin: false,
    });

    expect(result.hasAdminAppAccess).toBe(true);
    expect(result.hasAnyAdminPermission).toBe(true);
    expect(result.landingPath).toBe('/dashboard');
  });

  it('treats legacy admin permissions as admin app access', () => {
    const result = service.getAdminNavigationSummary({
      userId: 'u2',
      email: 'legacy-admin@example.com',
      tenantId: 't1',
      permissions: ['tenant.read'],
      isSuperAdmin: false,
    });

    expect(result.hasAdminAppAccess).toBe(true);
    expect(result.landingPath).toBe('/dashboard');
  });

  it('updates only authenticated caller profile and audits mutation', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      firstName: 'Old',
      lastName: 'Name',
      email: 'u@example.com',
      tenantId: 't1',
      tenant: { name: 'Tenant One' },
      userRoles: [{ role: { name: 'operator' } }],
      status: 'active',
    });
    prisma.user.update.mockResolvedValue(undefined);

    await service.updateMe(
      {
        userId: 'user-1',
        email: 'u@example.com',
        tenantId: 't1',
        permissions: ['account.profile.update-self'],
        isSuperAdmin: false,
      },
      { displayName: 'New Display Name' },
      'cid-1',
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1', tenantId: 't1', status: 'active' },
    }));
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
    }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'account.profile.update_self',
      actorUserId: 'user-1',
      correlationId: 'cid-1',
    }));
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        firstName: 'New',
        lastName: 'Display Name',
      }),
    }));
  });

  it('rejects password change when current password is invalid', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      passwordHash: '$2b$12$F2SN6I8N2HEfU9IfhMY6hO8YXQw1QvI5Igf0kgeQyx/T3WjNfWFOG', // Password1!
    });

    await expect(service.changePassword(
      {
        userId: 'user-1',
        email: 'u@example.com',
        tenantId: 't1',
        permissions: ['account.password.change-self'],
      },
      { currentPassword: 'wrong', newPassword: 'BetterPass123!' },
      'cid-2',
    )).rejects.toThrow(BadRequestException);
  });

  it('preserves tenant isolation on self profile reads', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getMe({
      userId: 'user-1',
      email: 'u@example.com',
      tenantId: 'other-tenant',
      permissions: [],
    })).rejects.toThrow(UnauthorizedException);
  });
});
