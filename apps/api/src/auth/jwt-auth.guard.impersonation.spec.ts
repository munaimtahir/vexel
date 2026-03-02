import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard impersonation write enforcement', () => {
  function makeContext(req: any, res: any) {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as any;
  }

  it('blocks write methods when impersonation is active', async () => {
    const impersonationService: any = {
      applyToRequest: jest.fn().mockResolvedValue({ sessionId: 'sess-1', mode: 'READ_ONLY', startedById: 'admin-1' }),
      clearCookie: jest.fn(),
      getCookieName: jest.fn().mockReturnValue('pgsims_impersonation'),
      logBlockedWrite: jest.fn().mockResolvedValue(undefined),
    };

    const guard = new JwtAuthGuard(impersonationService);
    const req = {
      headers: {},
      method: 'POST',
      path: '/api/patients',
      cookies: { pgsims_impersonation: 'token' },
      user: null,
    };
    const res = {};

    await expect(
      guard.handleRequest(null, {
        userId: 'admin-1',
        tenantId: 'system',
        roles: ['super-admin'],
        permissions: ['admin.super'],
        isSuperAdmin: true,
      }, null, makeContext(req, res)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(impersonationService.logBlockedWrite).toHaveBeenCalled();
  });

  it('returns effective impersonated user for safe requests', async () => {
    const impersonationService: any = {
      applyToRequest: jest.fn().mockImplementation(async (_user: any, req: any) => {
        req.user = {
          userId: 'resident-1',
          tenantId: 'system',
          roles: ['resident'],
          permissions: ['encounter.manage'],
          isSuperAdmin: false,
        };
        return { sessionId: 'sess-1', mode: 'READ_ONLY', startedById: 'admin-1' };
      }),
      clearCookie: jest.fn(),
      getCookieName: jest.fn().mockReturnValue('pgsims_impersonation'),
      logBlockedWrite: jest.fn().mockResolvedValue(undefined),
    };

    const guard = new JwtAuthGuard(impersonationService);
    const req = {
      headers: {},
      method: 'GET',
      path: '/api/me',
      cookies: { pgsims_impersonation: 'token' },
      user: null,
    };
    const res = {};

    const result = await guard.handleRequest(null, {
      userId: 'admin-1',
      tenantId: 'system',
      roles: ['super-admin'],
      permissions: ['admin.super'],
      isSuperAdmin: true,
    }, null, makeContext(req, res));

    expect(result.userId).toBe('resident-1');
    expect((req as any).user.userId).toBe('resident-1');
  });
});
