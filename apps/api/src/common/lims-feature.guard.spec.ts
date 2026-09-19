import { ForbiddenException } from '@nestjs/common';
import { LimsFeatureGuard } from './lims-feature.guard';

describe('LimsFeatureGuard', () => {
  const featureFlags = { isEnabled: jest.fn() };
  const guard = new LimsFeatureGuard(featureFlags as any);
  const contextFor = (user: unknown) => ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as any;

  beforeEach(() => jest.clearAllMocks());

  it('allows the authenticated tenant when LIMS is enabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(true);

    await expect(guard.canActivate(contextFor({ tenantId: 'tenant-a' }))).resolves.toBe(true);
    expect(featureFlags.isEnabled).toHaveBeenCalledWith('tenant-a', 'module.lims');
  });

  it('rejects a disabled tenant', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    await expect(guard.canActivate(contextFor({ tenantId: 'tenant-a' }))).rejects.toThrow(ForbiddenException);
  });

  it('rejects a request without authenticated tenant context', async () => {
    await expect(guard.canActivate(contextFor(undefined))).rejects.toThrow(ForbiddenException);
    expect(featureFlags.isEnabled).not.toHaveBeenCalled();
  });
});
