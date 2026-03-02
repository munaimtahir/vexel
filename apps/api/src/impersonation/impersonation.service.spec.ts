import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { ImpersonationService } from './impersonation.service';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    path: '/api/test',
    method: 'GET',
    ip: '127.0.0.1',
    ...overrides,
  } as any;
}

describe('ImpersonationService', () => {
  const actor = {
    userId: 'admin-1',
    tenantId: 'system',
    isSuperAdmin: true,
    roles: ['super-admin'],
    permissions: ['admin.super'],
  };

  function setup() {
    const prisma: any = {
      user: {
        findFirst: jest.fn(),
      },
      impersonationSession: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const audit: any = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    return { prisma, audit, svc: new ImpersonationService(prisma, audit) };
  }

  it('starts impersonation for admin and sets signed cookie', async () => {
    const { prisma, svc } = setup();
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-2',
      tenantId: 'system',
      email: 'resident@example.com',
      firstName: 'Resident',
      lastName: 'One',
      isSuperAdmin: false,
      userRoles: [{ role: { name: 'resident', rolePermissions: [{ permission: 'encounter.manage' }] } }],
    });
    prisma.impersonationSession.create.mockResolvedValue({ id: 'sess-1' });

    const req = makeReq({ headers: { 'user-agent': 'jest' } });
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn() };

    const result = await svc.start(actor, { userId: 'user-2', reason: 'Testing resident flow path' }, req, res);

    expect(result.sessionId).toBe('sess-1');
    expect(result.mode).toBe('READ_ONLY');
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('rejects non-admin start', async () => {
    const { svc } = setup();
    const req = makeReq();
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn() };

    await expect(
      svc.start(
        { userId: 'u-1', tenantId: 'system', roles: ['operator'], permissions: [] },
        { userId: 'u-2', reason: 'Testing resident flow path' },
        req,
        res,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('swaps request.user and preserves request.realUser when active', async () => {
    const { prisma, svc } = setup();
    const req = makeReq();
    (req as any).cookies = {};

    // Seed valid signed cookie via start helper.
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-2',
      tenantId: 'system',
      email: 'resident@example.com',
      firstName: 'Resident',
      lastName: 'One',
      isSuperAdmin: false,
      userRoles: [{ role: { name: 'resident', rolePermissions: [{ permission: 'encounter.manage' }] } }],
    });
    prisma.impersonationSession.create.mockResolvedValue({ id: 'sess-1' });

    const res: any = { cookie: jest.fn(), clearCookie: jest.fn() };
    await svc.start(actor, { userId: 'user-2', reason: 'Testing resident flow path' }, req, res);

    const token = res.cookie.mock.calls[0][1] as string;
    (req as any).cookies = { [svc.getCookieName()]: token };

    prisma.impersonationSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      tenantId: 'system',
      startedById: 'admin-1',
      impersonatedUserId: 'user-2',
      isActive: true,
      mode: 'READ_ONLY',
      startedAt: new Date(),
      startedBy: { id: 'admin-1', firstName: 'Admin', lastName: 'One' },
      impersonatedUser: {
        id: 'user-2',
        email: 'resident@example.com',
        tenantId: 'system',
        isSuperAdmin: false,
        firstName: 'Resident',
        lastName: 'One',
        userRoles: [{ role: { name: 'resident', rolePermissions: [{ permission: 'encounter.manage' }] } }],
      },
    });

    await svc.applyToRequest(actor, req);

    expect((req as any).realUser.userId).toBe('admin-1');
    expect((req as any).user.userId).toBe('user-2');
    expect((req as any).impersonation.mode).toBe('READ_ONLY');
  });

  it('stops impersonation and clears cookie', async () => {
    const { prisma, svc } = setup();
    const req = makeReq();
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn() };
    const now = Math.floor(Date.now() / 1000) + 300;
    const payloadToken = Buffer.from(JSON.stringify({
      session_id: 'sess-1',
      impersonated_user_id: 'user-2',
      mode: 'READ_ONLY',
      exp: now,
    })).toString('base64url');
    // Placeholder invalid token first should still clear cookie.
    (req as any).cookies = { [svc.getCookieName()]: `${payloadToken}.bad` };

    await svc.stop(actor, req, res, 'corr-1');
    expect(res.clearCookie).toHaveBeenCalledTimes(1);

    // Valid path with session row for audit coverage.
    const req2 = makeReq();
    const res2: any = { cookie: jest.fn(), clearCookie: jest.fn() };
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-2',
      tenantId: 'system',
      email: 'resident@example.com',
      firstName: 'Resident',
      lastName: 'One',
      isSuperAdmin: false,
      userRoles: [{ role: { name: 'resident', rolePermissions: [] } }],
    });
    prisma.impersonationSession.create.mockResolvedValue({ id: 'sess-1' });
    await svc.start(actor, { userId: 'user-2', reason: 'Testing resident flow path' }, req2, res2);

    (req2 as any).cookies = { [svc.getCookieName()]: res2.cookie.mock.calls[0][1] };
    prisma.impersonationSession.findUnique.mockResolvedValue({ id: 'sess-1', tenantId: 'system', endedAt: new Date() });

    await svc.stop(actor, req2, res2, 'corr-2');
    expect(prisma.impersonationSession.updateMany).toHaveBeenCalled();
    expect(res2.clearCookie).toHaveBeenCalledTimes(1);
  });

  it('logs blocked write metadata for active impersonation', async () => {
    const { prisma, audit, svc } = setup();
    const req = makeReq({ method: 'POST', path: '/api/encounters' });
    (req as any).impersonation = {
      sessionId: 'sess-1',
      mode: 'READ_ONLY',
      startedById: 'admin-1',
      expiresAt: new Date(Date.now() + 60_000),
    };

    await svc.logBlockedWrite({
      req,
      actor,
      tenantId: 'system',
      correlationId: 'corr-3',
    });

    expect(prisma.impersonationSession.update).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'impersonation.write_blocked' }));
  });

  it('returns inactive status when no active session exists', async () => {
    const { svc } = setup();
    const req = makeReq();
    const status = await svc.status(actor, req);
    expect(status).toEqual({ active: false });
  });
});
