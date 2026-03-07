import { PermissionsGuard } from './permissions.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { Permission } from './permissions';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const makeContext = (user: any, required: Permission[] = []) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as any;
  };

  it('allows when no permissions required', () => {
    expect(guard.canActivate(makeContext({ userId: '1' }, []))).toBe(true);
  });

  it('allows super-admin regardless of permissions', () => {
    const ctx = makeContext({ userId: '1', isSuperAdmin: true, permissions: [] }, [Permission.AUDIT_READ]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows when user has required permission', () => {
    const ctx = makeContext(
      { userId: '1', isSuperAdmin: false, permissions: [Permission.USER_READ] },
      [Permission.USER_READ],
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when permission missing', () => {
    const ctx = makeContext(
      { userId: '1', isSuperAdmin: false, permissions: [] },
      [Permission.USER_CREATE],
    );
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no user', () => {
    const ctx = makeContext(null, [Permission.USER_READ]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('enforces OPS permissions explicitly', () => {
    const deny = makeContext(
      { userId: '1', isSuperAdmin: false, permissions: [Permission.OPS_VIEW] },
      [Permission.OPS_RUN_BACKUP],
    );
    expect(() => guard.canActivate(deny)).toThrow(ForbiddenException);

    const allow = makeContext(
      { userId: '1', isSuperAdmin: false, permissions: [Permission.OPS_RUN_BACKUP] },
      [Permission.OPS_RUN_BACKUP],
    );
    expect(guard.canActivate(allow)).toBe(true);
  });
});
