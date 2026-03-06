import { AccountController } from './account.controller';

describe('AccountController', () => {
  const service = {
    getMe: jest.fn(),
    updateMe: jest.fn(),
    changePassword: jest.fn(),
    getAdminNavigationSummary: jest.fn(),
    getAdminLanding: jest.fn(),
  };
  const controller = new AccountController(service as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses authenticated caller identity for profile update', async () => {
    const req: any = {
      user: { userId: 'caller-1', tenantId: 'tenant-1', email: 'caller@example.com' },
    };
    await controller.updateMe(req, { displayName: 'Caller Name' }, 'cid-1');
    expect(service.updateMe).toHaveBeenCalledWith(
      req.user,
      { displayName: 'Caller Name' },
      'cid-1',
    );
  });

  it('uses authenticated caller identity for password change', async () => {
    const req: any = {
      user: { userId: 'caller-2', tenantId: 'tenant-2', email: 'caller2@example.com' },
    };
    await controller.changePassword(
      req,
      { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' },
      'cid-2',
    );
    expect(service.changePassword).toHaveBeenCalledWith(
      req.user,
      { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' },
      'cid-2',
    );
  });
});
