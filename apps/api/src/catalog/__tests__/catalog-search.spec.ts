import { CatalogService } from '../catalog.service';

function buildService() {
  const tests = [
    { id: 'a1', tenantId: 'tenant-a', name: 'Complete Blood Count', externalId: 'CBC', userCode: 'H-CBC', department: 'Hematology', sampleType: 'Blood', price: 500, isActive: true },
    { id: 'a2', tenantId: 'tenant-a', name: 'Bilirubin Total', externalId: 'BILT', userCode: 'BILI-T', department: 'Chemistry', sampleType: 'Blood', price: 400, isActive: true },
    { id: 'a3', tenantId: 'tenant-a', name: 'Direct Bilirubin', externalId: 'BILD', userCode: 'BILI-D', department: 'Chemistry', sampleType: 'Blood', price: 420, isActive: true },
    { id: 'a4', tenantId: 'tenant-a', name: 'CBC Extended Panel', externalId: 'T900', userCode: 'CBC-X', department: 'Hematology', sampleType: 'Blood', price: 900, isActive: true },
    { id: 'b1', tenantId: 'tenant-b', name: 'Complete Blood Count', externalId: 'CBC', userCode: 'TB-CBC', department: 'Hematology', sampleType: 'Blood', price: 700, isActive: true },
  ];

  const prisma: any = {
    catalogTest: {
      findMany: jest.fn(async ({ where }: any) => {
        const q = String(where?.OR?.[0]?.name?.contains ?? '').toLowerCase();
        return tests
          .filter((row) => row.tenantId === where.tenantId && row.isActive === true)
          .filter((row) => {
            const name = row.name.toLowerCase();
            const ext = (row.externalId ?? '').toLowerCase();
            const user = (row.userCode ?? '').toLowerCase();
            return name.includes(q) || ext.includes(q) || user.includes(q);
          })
          .map((row) => ({
            id: row.id,
            name: row.name,
            externalId: row.externalId,
            userCode: row.userCode,
            department: row.department,
            sampleType: row.sampleType,
            price: row.price,
            sampleTypeRef: null,
          }));
      }),
    },
    tenantTopTest: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(async (arg: any) => {
      if (typeof arg === 'function') return arg(prisma);
      return Promise.all(arg);
    }),
  };

  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new CatalogService(prisma, audit),
    prisma,
  };
}

describe('CatalogService operator search', () => {
  it('is case-insensitive for code query (CBC equals cbc)', async () => {
    const { service } = buildService();
    const upper = await service.searchTestsForOperator('tenant-a', { q: 'CBC', limit: 20 });
    const lower = await service.searchTestsForOperator('tenant-a', { q: 'cbc', limit: 20 });

    expect(upper.map((row) => row.id)).toEqual(lower.map((row) => row.id));
    expect(lower.length).toBeGreaterThan(0);
  });

  it('supports partial contains match (bili finds bilirubin tests)', async () => {
    const { service } = buildService();
    const rows = await service.searchTestsForOperator('tenant-a', { q: 'bili', limit: 20 });

    expect(rows.map((row) => row.name)).toEqual(['Bilirubin Total', 'Direct Bilirubin']);
  });

  it('ranks exact code match before name contains match', async () => {
    const { service } = buildService();
    const rows = await service.searchTestsForOperator('tenant-a', { q: 'cbc', limit: 20 });

    expect(rows[0].testCode).toBe('CBC');
    expect(rows[0].name).toBe('Complete Blood Count');
    expect(rows.some((row) => row.name === 'CBC Extended Panel')).toBe(true);
  });

  it('supports userCode search', async () => {
    const { service } = buildService();
    const rows = await service.searchTestsForOperator('tenant-a', { q: 'bili-d', limit: 20 });

    expect(rows).toHaveLength(1);
    expect(rows[0].userCode).toBe('BILI-D');
    expect(rows[0].name).toBe('Direct Bilirubin');
  });

  it('enforces tenant isolation for same query', async () => {
    const { service, prisma } = buildService();
    const rowsA = await service.searchTestsForOperator('tenant-a', { q: 'cbc', limit: 20 });
    const rowsB = await service.searchTestsForOperator('tenant-b', { q: 'cbc', limit: 20 });

    expect(rowsA.every((row) => row.id.startsWith('a'))).toBe(true);
    expect(rowsB.every((row) => row.id.startsWith('b'))).toBe(true);
    expect(prisma.catalogTest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }));
    expect(prisma.catalogTest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-b' }) }));
  });
});
