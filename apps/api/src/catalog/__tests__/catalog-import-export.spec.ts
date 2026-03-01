import { CatalogImportExportService } from '../catalog-import-export.service';

describe('CatalogImportExportService', () => {
  it('applies UPSERT_PATCH idempotently for sample types', async () => {
    const stored = new Map<string, any>();
    const prisma: any = {
      sampleType: {
        findFirst: jest.fn(async ({ where }: any) => stored.get(where.externalId) ?? null),
        findMany: jest.fn(async () => Array.from(stored.values())),
        create: jest.fn(async ({ data }: any) => {
          const created = { id: `id-${data.externalId}`, ...data };
          stored.set(data.externalId, created);
          return created;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const prev = Array.from(stored.values()).find((row: any) => row.id === where.id);
          const next = { ...prev, ...data };
          stored.set(next.externalId, next);
          return next;
        }),
      },
      catalogTest: { findMany: jest.fn(async () => []) },
      parameter: { findMany: jest.fn(async () => []) },
      catalogPanel: { findMany: jest.fn(async () => []) },
    };
    const audit: any = { log: jest.fn() };
    const svc = new CatalogImportExportService(prisma, audit);

    const csv = Buffer.from('externalId,userCode,name,description,isActive\ns1,WB,Whole Blood,Primary,true');
    const first = await svc.importFromCsvSheet('tenant-1', csv, 'sample-types', { mode: 'UPSERT_PATCH', validate: false }, 'user-1');
    const second = await svc.importFromCsvSheet('tenant-1', csv, 'sample-types', { mode: 'UPSERT_PATCH', validate: false }, 'user-1');

    expect(first.inserted).toBe(1);
    expect(second.updated).toBe(1);
    expect(prisma.sampleType.create).toHaveBeenCalledTimes(1);
    expect(prisma.sampleType.update).toHaveBeenCalledTimes(1);
  });
});
