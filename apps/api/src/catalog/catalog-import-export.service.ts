import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const CLEAR_TOKEN = '__CLEAR__';

@Injectable()
export class CatalogImportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Template Generation ──────────────────────────────────────────────────

  async generateWorkbookTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    this._addSheet(wb, 'Parameters', [
      'externalId', 'userCode', 'name', 'resultType', 'defaultUnit',
      'decimals', 'allowedValues', 'loincCode', 'defaultValue', 'isActive',
    ], [['p1', 'GLU', 'Glucose', 'numeric', 'mg/dL', '2', '', '2339-0', '', 'true']]);

    this._addSheet(wb, 'Tests', [
      'externalId', 'userCode', 'name', 'department', 'specimenType', 'method', 'loincCode', 'price', 'isActive',
    ], [['t1', 'CBC', 'Complete Blood Count', 'Hematology', 'Whole Blood', 'Automated', '58410-2', '1200', 'true']]);

    this._addSheet(wb, 'TestParameters', [
      'testExternalId', 'parameterExternalId', 'displayOrder', 'isRequired', 'unitOverride',
    ], [['t1', 'p1', '1', 'true', '']]);

    this._addSheet(wb, 'Panels', [
      'externalId', 'userCode', 'name', 'loincCode', 'price', 'isActive',
    ], [['g1', 'BASIC', 'Basic Metabolic Panel', '51990-0', '2000', 'true']]);

    this._addSheet(wb, 'PanelTests', [
      'panelExternalId', 'testExternalId', 'displayOrder',
    ], [['g1', 't1', '1']]);

    const notes = wb.addWorksheet('Notes');
    notes.getCell('A1').value = 'IMPORT NOTES';
    notes.getCell('A1').font = { bold: true, size: 14 };
    const instructions = [
      ['Semantics', 'Description'],
      ['UPSERT_PATCH', 'If externalId matches an existing record → update only non-empty fields. Empty cells are ignored (no change). New records are created.'],
      ['CREATE_ONLY', 'Reject rows whose externalId already exists in the database. Only inserts new records.'],
      [CLEAR_TOKEN, `Put "${CLEAR_TOKEN}" in a cell to explicitly set that field to null/empty.`],
      ['validate=true', 'Dry-run mode: returns what WOULD happen without writing to the database.'],
      ['Sheet order', 'Import processes: Parameters → Tests → TestParameters → Panels → PanelTests in order.'],
      ['Mappings', 'TestParameters and PanelTests are upserted by composite key (testExternalId+parameterExternalId, panelExternalId+testExternalId).'],
    ];
    instructions.forEach((row, i) => {
      const r = notes.getRow(i + 3);
      row.forEach((val, j) => { r.getCell(j + 1).value = val; });
      if (i === 0) { r.getCell(1).font = { bold: true }; r.getCell(2).font = { bold: true }; }
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ─── Export Real Data ─────────────────────────────────────────────────────

  async generateExportWorkbook(tenantId: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    const [tests, parameters, panels, testParamMappings, panelTestMappings] = await Promise.all([
      this.prisma.catalogTest.findMany({ where: { tenantId }, orderBy: { externalId: 'asc' } }),
      this.prisma.parameter.findMany({ where: { tenantId }, orderBy: { externalId: 'asc' } }),
      this.prisma.catalogPanel.findMany({ where: { tenantId }, orderBy: { externalId: 'asc' } }),
      this.prisma.testParameterMapping.findMany({
        where: { tenantId },
        include: { test: { select: { externalId: true } }, parameter: { select: { externalId: true } } },
        orderBy: [{ test: { externalId: 'asc' } }, { displayOrder: 'asc' }],
      }),
      this.prisma.panelTestMapping.findMany({
        where: { tenantId },
        include: { panel: { select: { externalId: true } }, test: { select: { externalId: true } } },
        orderBy: [{ panel: { externalId: 'asc' } }, { displayOrder: 'asc' }],
      }),
    ]);

    this._addSheet(wb, 'Parameters',
      ['externalId', 'userCode', 'name', 'resultType', 'defaultUnit', 'decimals', 'allowedValues', 'loincCode', 'defaultValue', 'isActive'],
      parameters.map(p => [
        p.externalId ?? '', p.userCode ?? '', p.name,
        p.resultType ?? 'numeric', p.defaultUnit ?? '',
        p.decimals != null ? String(p.decimals) : '2',
        p.allowedValues ?? '', p.loincCode ?? '', p.defaultValue ?? '',
        p.isActive ? 'true' : 'false',
      ]),
    );

    this._addSheet(wb, 'Tests',
      ['externalId', 'userCode', 'name', 'department', 'specimenType', 'method', 'loincCode', 'price', 'isActive'],
      tests.map(t => [
        t.externalId ?? '', t.userCode ?? '', t.name,
        t.department ?? '', t.sampleType ?? '', t.method ?? '',
        t.loincCode ?? '', t.price != null ? String(t.price) : '', t.isActive ? 'true' : 'false',
      ]),
    );

    this._addSheet(wb, 'TestParameters',
      ['testExternalId', 'parameterExternalId', 'displayOrder', 'isRequired', 'unitOverride'],
      testParamMappings.map(m => [
        m.test?.externalId ?? '', m.parameter?.externalId ?? '',
        String(m.displayOrder ?? 0), m.isRequired ? 'true' : 'false', m.unitOverride ?? '',
      ]),
    );

    this._addSheet(wb, 'Panels',
      ['externalId', 'userCode', 'name', 'loincCode', 'price', 'isActive'],
      panels.map(p => [
        p.externalId ?? '', p.userCode ?? '', p.name,
        p.loincCode ?? '', p.price != null ? String(p.price) : '', p.isActive ? 'true' : 'false',
      ]),
    );

    this._addSheet(wb, 'PanelTests',
      ['panelExternalId', 'testExternalId', 'displayOrder'],
      panelTestMappings.map(m => [
        m.panel?.externalId ?? '', m.test?.externalId ?? '', String(m.displayOrder ?? 0),
      ]),
    );

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private _addSheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: string[][]) {
    const ws = wb.addWorksheet(name);
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => { cell.font = { bold: true }; });
    rows.forEach((r) => ws.addRow(r));
  }

  // ─── CSV Generation ───────────────────────────────────────────────────────

  generateParametersCsv(): string {
    return this._csv(
      ['externalId', 'userCode', 'name', 'resultType', 'defaultUnit', 'decimals', 'allowedValues', 'loincCode', 'defaultValue', 'isActive'],
      [['p1', 'GLU', 'Glucose', 'numeric', 'mg/dL', '2', '', '2339-0', '', 'true']],
    );
  }

  generateTestsCsv(): string {
    return this._csv(
      ['externalId', 'userCode', 'name', 'department', 'specimenType', 'method', 'loincCode', 'price', 'isActive'],
      [['t1', 'CBC', 'Complete Blood Count', 'Hematology', 'Whole Blood', 'Automated', '58410-2', '1200', 'true']],
    );
  }

  generateTestParametersCsv(): string {
    return this._csv(
      ['testExternalId', 'parameterExternalId', 'displayOrder', 'isRequired', 'unitOverride'],
      [['t1', 'p1', '1', 'true', '']],
    );
  }

  generatePanelsCsv(): string {
    return this._csv(
      ['externalId', 'userCode', 'name', 'loincCode', 'price', 'isActive'],
      [['g1', 'BASIC', 'Basic Metabolic Panel', '51990-0', '2000', 'true']],
    );
  }

  generatePanelTestsCsv(): string {
    return this._csv(
      ['panelExternalId', 'testExternalId', 'displayOrder'],
      [['g1', 't1', '1']],
    );
  }

  private _csv(headers: string[], rows: string[][]): string {
    const lines = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))];
    return lines.join('\n');
  }

  // ─── Workbook Import ──────────────────────────────────────────────────────

  async importFromWorkbook(
    tenantId: string,
    buffer: Buffer,
    opts: { mode: 'CREATE_ONLY' | 'UPSERT_PATCH'; validate: boolean },
    actorUserId: string,
    correlationId?: string,
  ): Promise<{ inserted: number; updated: number; skipped: number; errors: Array<{ sheet: string; row: number; message: string }> }> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const summary = { inserted: 0, updated: 0, skipped: 0, errors: [] as Array<{ sheet: string; row: number; message: string }> };

    const sheetOrder: Array<'parameters' | 'tests' | 'test-parameters' | 'panels' | 'panel-tests'> = [
      'parameters', 'tests', 'test-parameters', 'panels', 'panel-tests',
    ];
    const sheetNameMap: Record<string, string> = {
      'parameters': 'Parameters',
      'tests': 'Tests',
      'test-parameters': 'TestParameters',
      'panels': 'Panels',
      'panel-tests': 'PanelTests',
    };

    for (const sheet of sheetOrder) {
      const ws = wb.getWorksheet(sheetNameMap[sheet]);
      if (!ws) continue;
      const rows = this._extractRows(ws);
      const result = await this._importSheet(tenantId, sheet, rows, opts, actorUserId, correlationId);
      summary.inserted += result.inserted;
      summary.updated += result.updated;
      summary.skipped += result.skipped;
      result.errors.forEach((e) => summary.errors.push({ sheet: sheetNameMap[sheet], ...e }));
    }

    if (!opts.validate) {
      await this.audit.log({ tenantId, actorUserId, action: 'catalog.import', entityType: 'Catalog', entityId: tenantId, after: { mode: opts.mode, ...summary }, correlationId });
    }

    return summary;
  }

  // ─── CSV Sheet Import ─────────────────────────────────────────────────────

  async importFromCsvSheet(
    tenantId: string,
    buffer: Buffer,
    sheet: 'parameters' | 'tests' | 'test-parameters' | 'panels' | 'panel-tests',
    opts: { mode: 'CREATE_ONLY' | 'UPSERT_PATCH'; validate: boolean },
    actorUserId: string,
    correlationId?: string,
  ) {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return { inserted: 0, updated: 0, skipped: 0, errors: [] };
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows: Record<string, string>[] = lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    });
    return this._importSheet(tenantId, sheet, rows, opts, actorUserId, correlationId);
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  private _extractRows(ws: ExcelJS.Worksheet): Record<string, string>[] {
    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, col) => { headers[col - 1] = String(cell.value ?? ''); });
    const rows: Record<string, string>[] = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const obj: Record<string, string> = {};
      row.eachCell((cell, col) => {
        const h = headers[col - 1];
        if (h) obj[h] = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
      });
      if (Object.values(obj).some((v) => v !== '')) rows.push(obj);
    });
    return rows;
  }

  private _val(row: Record<string, string>, key: string): string | undefined {
    const v = row[key];
    if (v === undefined || v === '') return undefined;
    if (v === CLEAR_TOKEN) return null as any; // signals explicit null
    return v;
  }

  private _valOrNull(row: Record<string, string>, key: string): string | null | undefined {
    const v = row[key];
    if (v === undefined || v === '') return undefined;
    if (v === CLEAR_TOKEN) return null;
    return v;
  }

  private async _importSheet(
    tenantId: string,
    sheet: 'parameters' | 'tests' | 'test-parameters' | 'panels' | 'panel-tests',
    rows: Record<string, string>[],
    opts: { mode: 'CREATE_ONLY' | 'UPSERT_PATCH'; validate: boolean },
    _actorUserId: string,
    _correlationId?: string,
  ) {
    const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as Array<{ row: number; message: string }> };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header
      try {
        if (sheet === 'parameters') {
          await this._importParameter(tenantId, row, rowNum, opts, result);
        } else if (sheet === 'tests') {
          await this._importTest(tenantId, row, rowNum, opts, result);
        } else if (sheet === 'test-parameters') {
          await this._importTestParameter(tenantId, row, rowNum, opts, result);
        } else if (sheet === 'panels') {
          await this._importPanel(tenantId, row, rowNum, opts, result);
        } else if (sheet === 'panel-tests') {
          await this._importPanelTest(tenantId, row, rowNum, opts, result);
        }
      } catch (err: any) {
        result.errors.push({ row: rowNum, message: err.message ?? String(err) });
      }
    }

    return result;
  }

  private async _generateNextExternalId(tenantId: string, type: 'test' | 'parameter' | 'panel'): Promise<string> {
    const prefix = type === 'test' ? 't' : type === 'parameter' ? 'p' : 'g';
    let existingIds: string[];
    if (type === 'test') {
      const rows = await this.prisma.catalogTest.findMany({ where: { tenantId, externalId: { startsWith: prefix } }, select: { externalId: true } });
      existingIds = rows.map(r => r.externalId).filter(Boolean) as string[];
    } else if (type === 'parameter') {
      const rows = await this.prisma.parameter.findMany({ where: { tenantId, externalId: { startsWith: prefix } }, select: { externalId: true } });
      existingIds = rows.map(r => r.externalId).filter(Boolean) as string[];
    } else {
      const rows = await this.prisma.catalogPanel.findMany({ where: { tenantId, externalId: { startsWith: prefix } }, select: { externalId: true } });
      existingIds = rows.map(r => r.externalId).filter(Boolean) as string[];
    }
    const pattern = new RegExp(`^${prefix}(\\d+)$`);
    let max = 0;
    for (const id of existingIds) {
      const m = id.match(pattern);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `${prefix}${max + 1}`;
  }

  private async _importParameter(tenantId: string, row: Record<string, string>, rowNum: number, opts: { mode: string; validate: boolean }, result: any) {
    let externalId = this._val(row, 'externalId') ?? null;
    if (externalId) {
      if (!/^p\d+$/.test(externalId)) {
        result.errors.push({ row: rowNum, message: `externalId must match p<number> format, got '${externalId}'` });
        return;
      }
    }

    const existing = externalId
      ? await this.prisma.parameter.findFirst({ where: { tenantId, externalId } })
      : null;

    if (existing) {
      if (opts.mode === 'CREATE_ONLY') { result.skipped++; return; }
      if (!opts.validate) {
        const data: any = {};
        const name = this._val(row, 'name'); if (name !== undefined) data.name = name;
        const userCode = this._valOrNull(row, 'userCode'); if (userCode !== undefined) data.userCode = userCode;
        const loincCode = this._valOrNull(row, 'loincCode'); if (loincCode !== undefined) data.loincCode = loincCode;
        const resultType = this._val(row, 'resultType'); if (resultType !== undefined) data.resultType = resultType;
        const defaultUnit = this._valOrNull(row, 'defaultUnit'); if (defaultUnit !== undefined) data.defaultUnit = defaultUnit;
        const decimals = this._val(row, 'decimals'); if (decimals !== undefined) data.decimals = decimals ? parseInt(decimals, 10) : null;
        const allowedValues = this._valOrNull(row, 'allowedValues'); if (allowedValues !== undefined) data.allowedValues = allowedValues;
        const defaultValue = this._valOrNull(row, 'defaultValue'); if (defaultValue !== undefined) data.defaultValue = defaultValue;
        const isActive = this._val(row, 'isActive'); if (isActive !== undefined) data.isActive = isActive === 'true';
        await this.prisma.parameter.update({ where: { id: existing.id }, data });
      }
      result.updated++;
    } else {
      const name = this._val(row, 'name');
      if (!name) { result.errors.push({ row: rowNum, message: 'name is required' }); return; }
      if (!externalId) {
        externalId = await this._generateNextExternalId(tenantId, 'parameter');
      }
      if (!opts.validate) {
        await this.prisma.parameter.create({
          data: {
            tenantId, name,
            externalId,
            userCode: this._valOrNull(row, 'userCode') ?? undefined,
            loincCode: this._valOrNull(row, 'loincCode') ?? undefined,
            resultType: this._val(row, 'resultType') ?? 'numeric',
            defaultUnit: this._valOrNull(row, 'defaultUnit') ?? undefined,
            decimals: this._val(row, 'decimals') ? parseInt(this._val(row, 'decimals')!, 10) : 2,
            allowedValues: this._valOrNull(row, 'allowedValues') ?? undefined,
            defaultValue: this._valOrNull(row, 'defaultValue') ?? undefined,
            isActive: this._val(row, 'isActive') !== 'false',
          },
        });
      }
      result.inserted++;
    }
  }

  private async _importTest(tenantId: string, row: Record<string, string>, rowNum: number, opts: { mode: string; validate: boolean }, result: any) {
    let externalId = this._val(row, 'externalId') ?? null;
    if (externalId) {
      if (!/^t\d+$/.test(externalId)) {
        result.errors.push({ row: rowNum, message: `externalId must match t<number> format, got '${externalId}'` });
        return;
      }
    }
    const priceRaw = this._val(row, 'price');
    let price: number | undefined;
    if (priceRaw !== undefined) {
      const parsed = Number(priceRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        result.errors.push({ row: rowNum, message: 'price must be a number >= 0' });
        return;
      }
      price = parsed;
    }

    const existing = externalId
      ? await this.prisma.catalogTest.findFirst({ where: { tenantId, externalId } })
      : null;

    if (existing) {
      if (opts.mode === 'CREATE_ONLY') { result.skipped++; return; }
      if (!opts.validate) {
        const data: any = {};
        const name = this._val(row, 'name'); if (name !== undefined) data.name = name;
        const userCode = this._valOrNull(row, 'userCode'); if (userCode !== undefined) data.userCode = userCode;
        const loincCode = this._valOrNull(row, 'loincCode'); if (loincCode !== undefined) data.loincCode = loincCode;
        const department = this._valOrNull(row, 'department'); if (department !== undefined) data.department = department;
        const method = this._valOrNull(row, 'method'); if (method !== undefined) data.method = method;
        const specimenType = this._valOrNull(row, 'specimenType'); if (specimenType !== undefined) data.sampleType = specimenType;
        if (price !== undefined) data.price = price;
        const isActive = this._val(row, 'isActive'); if (isActive !== undefined) data.isActive = isActive === 'true';
        await this.prisma.catalogTest.update({ where: { id: existing.id }, data });
      }
      result.updated++;
    } else {
      const name = this._val(row, 'name');
      if (!name) { result.errors.push({ row: rowNum, message: 'name is required' }); return; }
      if (!externalId) {
        externalId = await this._generateNextExternalId(tenantId, 'test');
      }
      if (!opts.validate) {
        await this.prisma.catalogTest.create({
          data: {
            tenantId, name,
            externalId,
            userCode: this._valOrNull(row, 'userCode') ?? undefined,
            loincCode: this._valOrNull(row, 'loincCode') ?? undefined,
            department: this._valOrNull(row, 'department') ?? undefined,
            method: this._valOrNull(row, 'method') ?? undefined,
            sampleType: this._valOrNull(row, 'specimenType') ?? 'Blood',
            price: price ?? undefined,
            isActive: this._val(row, 'isActive') !== 'false',
          },
        });
      }
      result.inserted++;
    }
  }

  private async _importPanel(tenantId: string, row: Record<string, string>, rowNum: number, opts: { mode: string; validate: boolean }, result: any) {
    let externalId = this._val(row, 'externalId') ?? null;
    if (externalId) {
      if (!/^g\d+$/.test(externalId)) {
        result.errors.push({ row: rowNum, message: `externalId must match g<number> format, got '${externalId}'` });
        return;
      }
    }
    const priceRaw = this._val(row, 'price');
    let price: number | undefined;
    if (priceRaw !== undefined) {
      const parsed = Number(priceRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        result.errors.push({ row: rowNum, message: 'price must be a number >= 0' });
        return;
      }
      price = parsed;
    }

    const existing = externalId
      ? await this.prisma.catalogPanel.findFirst({ where: { tenantId, externalId } })
      : null;

    if (existing) {
      if (opts.mode === 'CREATE_ONLY') { result.skipped++; return; }
      if (!opts.validate) {
        const data: any = {};
        const name = this._val(row, 'name'); if (name !== undefined) data.name = name;
        const userCode = this._valOrNull(row, 'userCode'); if (userCode !== undefined) data.userCode = userCode;
        const loincCode = this._valOrNull(row, 'loincCode'); if (loincCode !== undefined) data.loincCode = loincCode;
        if (price !== undefined) data.price = price;
        const isActive = this._val(row, 'isActive'); if (isActive !== undefined) data.isActive = isActive === 'true';
        await this.prisma.catalogPanel.update({ where: { id: existing.id }, data });
      }
      result.updated++;
    } else {
      const name = this._val(row, 'name');
      if (!name) { result.errors.push({ row: rowNum, message: 'name is required' }); return; }
      if (!externalId) {
        externalId = await this._generateNextExternalId(tenantId, 'panel');
      }
      if (!opts.validate) {
        await this.prisma.catalogPanel.create({
          data: {
            tenantId, name,
            externalId,
            userCode: this._valOrNull(row, 'userCode') ?? undefined,
            loincCode: this._valOrNull(row, 'loincCode') ?? undefined,
            price: price ?? undefined,
            isActive: this._val(row, 'isActive') !== 'false',
          },
        });
      }
      result.inserted++;
    }
  }

  private async _importTestParameter(tenantId: string, row: Record<string, string>, rowNum: number, opts: { mode: string; validate: boolean }, result: any) {
    const testExtId = this._val(row, 'testExternalId');
    const paramExtId = this._val(row, 'parameterExternalId');
    if (!testExtId || !paramExtId) { result.errors.push({ row: rowNum, message: 'testExternalId and parameterExternalId are required' }); return; }

    const test = await this.prisma.catalogTest.findFirst({ where: { tenantId, externalId: testExtId } });
    if (!test) { result.errors.push({ row: rowNum, message: `Test externalId '${testExtId}' not found` }); return; }

    const param = await this.prisma.parameter.findFirst({ where: { tenantId, externalId: paramExtId } });
    if (!param) { result.errors.push({ row: rowNum, message: `Parameter externalId '${paramExtId}' not found` }); return; }

    const displayOrder = parseInt(this._val(row, 'displayOrder') ?? '0', 10);
    const isRequired = this._val(row, 'isRequired') !== 'false';
    const unitOverride = this._valOrNull(row, 'unitOverride') ?? null;

    const existing = await this.prisma.testParameterMapping.findUnique({
      where: { tenantId_testId_parameterId: { tenantId, testId: test.id, parameterId: param.id } },
    });

    if (existing) {
      if (opts.mode === 'CREATE_ONLY') { result.skipped++; return; }
      if (!opts.validate) {
        await this.prisma.testParameterMapping.update({
          where: { tenantId_testId_parameterId: { tenantId, testId: test.id, parameterId: param.id } },
          data: { displayOrder, ordering: displayOrder, isRequired, unitOverride },
        });
      }
      result.updated++;
    } else {
      if (!opts.validate) {
        await this.prisma.testParameterMapping.create({
          data: { tenantId, testId: test.id, parameterId: param.id, ordering: displayOrder, displayOrder, isRequired, unitOverride },
        });
      }
      result.inserted++;
    }
  }

  private async _importPanelTest(tenantId: string, row: Record<string, string>, rowNum: number, opts: { mode: string; validate: boolean }, result: any) {
    const panelExtId = this._val(row, 'panelExternalId');
    const testExtId = this._val(row, 'testExternalId');
    if (!panelExtId || !testExtId) { result.errors.push({ row: rowNum, message: 'panelExternalId and testExternalId are required' }); return; }

    const panel = await this.prisma.catalogPanel.findFirst({ where: { tenantId, externalId: panelExtId } });
    if (!panel) { result.errors.push({ row: rowNum, message: `Panel externalId '${panelExtId}' not found` }); return; }

    const test = await this.prisma.catalogTest.findFirst({ where: { tenantId, externalId: testExtId } });
    if (!test) { result.errors.push({ row: rowNum, message: `Test externalId '${testExtId}' not found` }); return; }

    const displayOrder = parseInt(this._val(row, 'displayOrder') ?? '0', 10);

    const existing = await this.prisma.panelTestMapping.findUnique({
      where: { tenantId_panelId_testId: { tenantId, panelId: panel.id, testId: test.id } },
    });

    if (existing) {
      if (opts.mode === 'CREATE_ONLY') { result.skipped++; return; }
      if (!opts.validate) {
        await this.prisma.panelTestMapping.update({
          where: { tenantId_panelId_testId: { tenantId, panelId: panel.id, testId: test.id } },
          data: { displayOrder, ordering: displayOrder },
        });
      }
      result.updated++;
    } else {
      if (!opts.validate) {
        await this.prisma.panelTestMapping.create({
          data: { tenantId, panelId: panel.id, testId: test.id, ordering: displayOrder, displayOrder },
        });
      }
      result.inserted++;
    }
  }
}
