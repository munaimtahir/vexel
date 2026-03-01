/**
 * Integration tests for TenantsService.enableLims()
 *
 * Tests:
 * 1. Enable LIMS + seed catalog on first call → creates catalog rows for correct tenant
 * 2. Second call with already-seeded tenant → no-op (idempotency guard)
 * 3. Tenancy isolation — seeding Tenant A does not create rows for Tenant B
 */

// ─── Mock deps ────────────────────────────────────────────────────────────────

const mockCatalogImport = {
  importFromWorkbook: jest.fn().mockResolvedValue({ inserted: 40, updated: 0, skipped: 0, errors: [] }),
};

const mockFeatureFlags = {
  setForTenant: jest.fn().mockResolvedValue([{ key: 'module.lims', enabled: true }]),
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockTenantService = {
  list: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
};

// In-memory tenant store for Prisma mock
const tenantStore: Record<string, any> = {};

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(({ where }: any) => Promise.resolve(tenantStore[where.id] ?? null)),
    update: jest.fn(({ where, data }: any) => {
      tenantStore[where.id] = { ...tenantStore[where.id], ...data };
      return Promise.resolve(tenantStore[where.id]);
    }),
  },
};

// ─── Mock fs so base catalog artifact is available ────────────────────────────

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: (p: string) => p.includes('base_catalog_v1') ? true : actualFs.existsSync(p),
    readFileSync: (p: string, encoding?: any) => {
      if (p.includes('base_catalog_v1.json')) {
        const meta = { baseVersion: '2026-03-01', notes: 'Test', sha256: 'abc123' };
        return encoding ? JSON.stringify(meta) : Buffer.from(JSON.stringify(meta));
      }
      if (p.includes('base_catalog_v1.xlsx')) {
        return Buffer.from('fake-xlsx-bytes');
      }
      return encoding ? actualFs.readFileSync(p, encoding) : actualFs.readFileSync(p);
    },
  };
});

jest.mock('crypto', () => ({
  createHash: () => ({
    update: () => ({ digest: () => 'mocked-hash-hex' }),
  }),
}));

// ─── Import SUT after mocks ───────────────────────────────────────────────────

import { TenantsService } from '../tenants.service';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TenantsService.enableLims()', () => {
  let svc: TenantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(tenantStore).forEach((k) => delete tenantStore[k]);

    svc = new TenantsService(
      mockTenantService as any,
      mockAudit as any,
      mockCatalogImport as any,
      mockFeatureFlags as any,
      mockPrisma as any,
    );
  });

  it('seeds catalog on first enable-lims call', async () => {
    tenantStore['tenant-a'] = { id: 'tenant-a', name: 'Tenant A', catalogSeededAt: null };

    const result = await svc.enableLims('tenant-a', { seedCatalog: true, seedMode: 'BASE_ON_ENABLE' }, 'actor-1');

    expect(result.limsEnabled).toBe(true);
    expect(result.catalogSeeded).toBe(true);
    expect(result.catalogAlreadySeeded).toBe(false);
    expect(result.seedSummary?.inserted).toBe(40);

    // Feature flag was set
    expect(mockFeatureFlags.setForTenant).toHaveBeenCalledWith(
      'tenant-a',
      [{ key: 'module.lims', enabled: true }],
      'actor-1',
      undefined,
    );

    // importFromWorkbook called for tenant-a only
    expect(mockCatalogImport.importFromWorkbook).toHaveBeenCalledTimes(1);
    expect(mockCatalogImport.importFromWorkbook.mock.calls[0][0]).toBe('tenant-a');

    // Audit events written
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'catalog.seed_from_base', tenantId: 'tenant-a' }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant.lims.enable', tenantId: 'tenant-a' }),
    );

    // Tenant seeded state persisted
    expect(tenantStore['tenant-a'].catalogSeededAt).toBeTruthy();
    expect(tenantStore['tenant-a'].catalogSeedBaseVersion).toBe('2026-03-01');
  });

  it('is idempotent — second call returns no-op when already seeded', async () => {
    tenantStore['tenant-a'] = {
      id: 'tenant-a',
      name: 'Tenant A',
      catalogSeededAt: new Date('2026-02-01'),
      catalogSeedBaseVersion: '2026-02-01',
      catalogSeedHash: 'old-hash',
    };

    const result = await svc.enableLims('tenant-a', { seedCatalog: true }, 'actor-1');

    expect(result.catalogAlreadySeeded).toBe(true);
    expect(result.catalogSeeded).toBe(false);

    // Import should NOT be called on second enable
    expect(mockCatalogImport.importFromWorkbook).not.toHaveBeenCalled();
  });

  it('tenancy isolation — seeding Tenant A does not create rows for Tenant B', async () => {
    tenantStore['tenant-a'] = { id: 'tenant-a', name: 'A', catalogSeededAt: null };
    tenantStore['tenant-b'] = { id: 'tenant-b', name: 'B', catalogSeededAt: null };

    await svc.enableLims('tenant-a', { seedCatalog: true }, 'actor-1');

    // Only one importFromWorkbook call, with tenant-a's tenantId
    expect(mockCatalogImport.importFromWorkbook).toHaveBeenCalledTimes(1);
    const [calledTenantId] = mockCatalogImport.importFromWorkbook.mock.calls[0];
    expect(calledTenantId).toBe('tenant-a');
    expect(calledTenantId).not.toBe('tenant-b');

    // Tenant B catalog state unchanged
    expect(tenantStore['tenant-b'].catalogSeededAt).toBeFalsy();
  });

  it('throws NotFoundException for unknown tenant', async () => {
    await expect(
      svc.enableLims('nonexistent', { seedCatalog: true }, 'actor-1'),
    ).rejects.toThrow('Tenant nonexistent not found');
  });

  it('seeds with EMPTY mode — does not call importFromWorkbook', async () => {
    tenantStore['tenant-a'] = { id: 'tenant-a', name: 'A', catalogSeededAt: null };

    const result = await svc.enableLims('tenant-a', { seedCatalog: true, seedMode: 'EMPTY' }, 'actor-1');

    expect(result.limsEnabled).toBe(true);
    expect(result.catalogSeeded).toBe(false);
    expect(mockCatalogImport.importFromWorkbook).not.toHaveBeenCalled();
  });
});
