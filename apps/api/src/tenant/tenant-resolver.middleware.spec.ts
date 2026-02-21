import { TenantResolverMiddleware } from './tenant-resolver.middleware';
import { TenantService } from './tenant.service';
import { setTenantId, getTenantId } from '../common/tenant-context';

describe('TenantResolverMiddleware', () => {
  let middleware: TenantResolverMiddleware;
  let tenantService: jest.Mocked<TenantService>;

  beforeEach(() => {
    tenantService = {
      findByDomain: jest.fn(),
    } as any;
    middleware = new TenantResolverMiddleware(tenantService);
  });

  it('resolves tenant from x-tenant-id header in dev mode', async () => {
    process.env.TENANCY_DEV_HEADER_ENABLED = 'true';
    const req: any = { headers: { 'x-tenant-id': 'tenant-abc' }, hostname: 'localhost' };
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(getTenantId(req)).toBe('tenant-abc');
    expect(next).toHaveBeenCalled();
    expect(tenantService.findByDomain).not.toHaveBeenCalled();
    delete process.env.TENANCY_DEV_HEADER_ENABLED;
  });

  it('does not use dev header when env flag is off', async () => {
    process.env.TENANCY_DEV_HEADER_ENABLED = 'false';
    tenantService.findByDomain.mockResolvedValue({ id: 'tenant-xyz' } as any);
    const req: any = { headers: { 'x-tenant-id': 'should-be-ignored' }, hostname: 'myapp.com' };
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(tenantService.findByDomain).toHaveBeenCalledWith('myapp.com');
    delete process.env.TENANCY_DEV_HEADER_ENABLED;
  });

  it('resolves tenant from hostname via domain lookup', async () => {
    process.env.TENANCY_DEV_HEADER_ENABLED = 'false';
    tenantService.findByDomain.mockResolvedValue({ id: 'tenant-prod' } as any);
    const req: any = { headers: {}, hostname: 'clinic.vexel.health' };
    const next = jest.fn();

    await middleware.use(req, {} as any, next);

    expect(getTenantId(req)).toBe('tenant-prod');
    expect(next).toHaveBeenCalled();
    delete process.env.TENANCY_DEV_HEADER_ENABLED;
  });
});
