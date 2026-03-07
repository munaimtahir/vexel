import * as ExcelJS from 'exceljs';
import { CatalogImportExportService } from '../catalog-import-export.service';

describe('CatalogImportExportService reference range workbook import', () => {
  it('parses reference ranges from workbook sheet with header variants and en-dash expression', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Reference Ranges');
    ws.addRow([
      'Parameter External ID',
      'Test External ID',
      'Gender',
      'Age Min Years',
      'Age Max Years',
      'Range Expression',
      'Unit',
    ]);
    ws.addRow(['p1', 't1', 'M', '18', '65', '70–110', 'mg/dL']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const prisma: any = {
      parameter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'param-1', externalId: 'p1' }),
      },
      catalogTest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'test-1', externalId: 't1' }),
      },
      referenceRange: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rr-1' }),
      },
    };
    const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new CatalogImportExportService(prisma, audit);

    const result = await svc.importFromWorkbook(
      'tenant-1',
      buf,
      { mode: 'UPSERT_PATCH', validate: false },
      'user-1',
      'corr-1',
    );

    expect(result.bySheet.ReferenceRanges.totalRows).toBe(1);
    expect(result.bySheet.ReferenceRanges.inserted).toBe(1);
    expect(result.bySheet.ReferenceRanges.errors).toBe(0);
    expect(prisma.referenceRange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parameterId: 'param-1',
          testId: 'test-1',
          gender: 'M',
          ageMinYears: 18,
          ageMaxYears: 65,
          lowValue: 70,
          highValue: 110,
          unit: 'mg/dL',
        }),
      }),
    );
  });
});
