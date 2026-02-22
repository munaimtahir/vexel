import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Tests ────────────────────────────────────────────────────────────────

  async listTests(tenantId: string, opts: { page?: number; limit?: number; search?: string } = {}) {
    const { search } = opts;
    const page = Number(opts.page ?? 1);
    const limit = Number(opts.limit ?? 20);
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { userCode: { contains: search, mode: 'insensitive' } },
        { externalId: { contains: search, mode: 'insensitive' } },
        { loincCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.catalogTest.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.catalogTest.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createTest(
    tenantId: string,
    body: {
      code: string; name: string; description?: string; sampleType?: string;
      turnaroundHours?: number; externalId?: string; userCode?: string;
      loincCode?: string; department?: string; method?: string; specimenType?: string;
    },
    actorUserId: string,
    correlationId?: string,
  ) {
    const existing = await this.prisma.catalogTest.findUnique({ where: { tenantId_code: { tenantId, code: body.code } } });
    if (existing) throw new ConflictException(`Test code '${body.code}' already exists in tenant`);
    if (body.externalId) {
      const dup = await this.prisma.catalogTest.findFirst({ where: { tenantId, externalId: body.externalId } });
      if (dup) throw new ConflictException(`Test externalId '${body.externalId}' already exists in tenant`);
    }
    if (body.userCode) {
      const dup = await this.prisma.catalogTest.findFirst({ where: { tenantId, userCode: body.userCode } });
      if (dup) throw new ConflictException(`Test userCode '${body.userCode}' already exists in tenant`);
    }
    const { specimenType, ...rest } = body;
    const createData: any = { tenantId, ...rest };
    if (specimenType !== undefined) createData.sampleType = specimenType;
    const test = await this.prisma.catalogTest.create({ data: createData });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.test.create', entityType: 'CatalogTest', entityId: test.id, after: body, correlationId });
    return test;
  }

  async getTest(tenantId: string, id: string) {
    const test = await this.prisma.catalogTest.findFirst({ where: { id, tenantId } });
    if (!test) throw new NotFoundException('Catalog test not found');
    return test;
  }

  async updateTest(
    tenantId: string,
    id: string,
    body: {
      name?: string; description?: string; sampleType?: string; turnaroundHours?: number;
      isActive?: boolean; externalId?: string; userCode?: string; loincCode?: string;
      department?: string; method?: string; specimenType?: string;
    },
    actorUserId: string,
    correlationId?: string,
  ) {
    const test = await this.prisma.catalogTest.findFirst({ where: { id, tenantId } });
    if (!test) throw new NotFoundException('Catalog test not found');
    if (body.externalId && body.externalId !== test.externalId) {
      const dup = await this.prisma.catalogTest.findFirst({ where: { tenantId, externalId: body.externalId, NOT: { id } } });
      if (dup) throw new ConflictException(`Test externalId '${body.externalId}' already exists in tenant`);
    }
    if (body.userCode && body.userCode !== test.userCode) {
      const dup = await this.prisma.catalogTest.findFirst({ where: { tenantId, userCode: body.userCode, NOT: { id } } });
      if (dup) throw new ConflictException(`Test userCode '${body.userCode}' already exists in tenant`);
    }
    const { specimenType, ...rest } = body;
    const updateData: any = { ...rest };
    if (specimenType !== undefined) updateData.sampleType = specimenType;
    const updated = await this.prisma.catalogTest.update({ where: { id }, data: updateData });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.test.update', entityType: 'CatalogTest', entityId: id, before: test, after: body, correlationId });
    return updated;
  }

  async deleteTest(tenantId: string, id: string, actorUserId: string, correlationId?: string) {
    const test = await this.prisma.catalogTest.findFirst({ where: { id, tenantId } });
    if (!test) throw new NotFoundException('Catalog test not found');
    await this.prisma.catalogTest.update({ where: { id }, data: { isActive: false } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.test.delete', entityType: 'CatalogTest', entityId: id, correlationId });
  }

  // ─── Panels ───────────────────────────────────────────────────────────────

  async listPanels(tenantId: string, opts: { page?: number; limit?: number; search?: string } = {}) {
    const { search } = opts;
    const page = Number(opts.page ?? 1);
    const limit = Number(opts.limit ?? 20);
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { userCode: { contains: search, mode: 'insensitive' } },
        { externalId: { contains: search, mode: 'insensitive' } },
        { loincCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.catalogPanel.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.catalogPanel.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createPanel(
    tenantId: string,
    body: { code: string; name: string; description?: string; externalId?: string; userCode?: string; loincCode?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    const existing = await this.prisma.catalogPanel.findUnique({ where: { tenantId_code: { tenantId, code: body.code } } });
    if (existing) throw new ConflictException(`Panel code '${body.code}' already exists in tenant`);
    if (body.externalId) {
      const dup = await this.prisma.catalogPanel.findFirst({ where: { tenantId, externalId: body.externalId } });
      if (dup) throw new ConflictException(`Panel externalId '${body.externalId}' already exists in tenant`);
    }
    if (body.userCode) {
      const dup = await this.prisma.catalogPanel.findFirst({ where: { tenantId, userCode: body.userCode } });
      if (dup) throw new ConflictException(`Panel userCode '${body.userCode}' already exists in tenant`);
    }
    const { ...createData } = body as any;
    delete createData.testIds; // removed from schema
    const panel = await this.prisma.catalogPanel.create({ data: { tenantId, ...createData } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.panel.create', entityType: 'CatalogPanel', entityId: panel.id, after: body, correlationId });
    return panel;
  }

  async updatePanel(
    tenantId: string,
    id: string,
    body: { name?: string; description?: string; isActive?: boolean; externalId?: string; userCode?: string; loincCode?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    const panel = await this.prisma.catalogPanel.findFirst({ where: { id, tenantId } });
    if (!panel) throw new NotFoundException('Panel not found');
    if (body.externalId && body.externalId !== panel.externalId) {
      const dup = await this.prisma.catalogPanel.findFirst({ where: { tenantId, externalId: body.externalId, NOT: { id } } });
      if (dup) throw new ConflictException(`Panel externalId '${body.externalId}' already exists in tenant`);
    }
    if (body.userCode && body.userCode !== panel.userCode) {
      const dup = await this.prisma.catalogPanel.findFirst({ where: { tenantId, userCode: body.userCode, NOT: { id } } });
      if (dup) throw new ConflictException(`Panel userCode '${body.userCode}' already exists in tenant`);
    }
    const updated = await this.prisma.catalogPanel.update({ where: { id }, data: body });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.panel.update', entityType: 'CatalogPanel', entityId: id, before: panel, after: body, correlationId });
    return updated;
  }

  // ─── Parameters ───────────────────────────────────────────────────────────

  async listParameters(tenantId: string, opts: { page?: number; limit?: number; search?: string } = {}) {
    const { search } = opts;
    const page = Number(opts.page ?? 1);
    const limit = Number(opts.limit ?? 20);
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { userCode: { contains: search, mode: 'insensitive' } },
        { externalId: { contains: search, mode: 'insensitive' } },
        { loincCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.parameter.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.parameter.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createParameter(
    tenantId: string,
    body: {
      code: string; name: string; unit?: string; dataType?: string;
      externalId?: string; userCode?: string; loincCode?: string;
      resultType?: string; defaultUnit?: string; decimals?: number; allowedValues?: string;
    },
    actorUserId: string,
    correlationId?: string,
  ) {
    const existing = await this.prisma.parameter.findUnique({ where: { tenantId_code: { tenantId, code: body.code } } });
    if (existing) throw new ConflictException(`Parameter code '${body.code}' already exists in tenant`);
    if (body.externalId) {
      const dup = await this.prisma.parameter.findFirst({ where: { tenantId, externalId: body.externalId } });
      if (dup) throw new ConflictException(`Parameter externalId '${body.externalId}' already exists in tenant`);
    }
    if (body.userCode) {
      const dup = await this.prisma.parameter.findFirst({ where: { tenantId, userCode: body.userCode } });
      if (dup) throw new ConflictException(`Parameter userCode '${body.userCode}' already exists in tenant`);
    }
    const param = await this.prisma.parameter.create({ data: { tenantId, ...body } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.parameter.create', entityType: 'Parameter', entityId: param.id, after: body, correlationId });
    return param;
  }

  async getParameter(tenantId: string, id: string) {
    const param = await this.prisma.parameter.findFirst({ where: { id, tenantId } });
    if (!param) throw new NotFoundException('Parameter not found');
    return param;
  }

  async updateParameter(
    tenantId: string,
    id: string,
    body: {
      name?: string; unit?: string; dataType?: string; isActive?: boolean;
      externalId?: string; userCode?: string; loincCode?: string;
      resultType?: string; defaultUnit?: string; decimals?: number; allowedValues?: string;
    },
    actorUserId: string,
    correlationId?: string,
  ) {
    const param = await this.prisma.parameter.findFirst({ where: { id, tenantId } });
    if (!param) throw new NotFoundException('Parameter not found');
    if (body.externalId && body.externalId !== param.externalId) {
      const dup = await this.prisma.parameter.findFirst({ where: { tenantId, externalId: body.externalId, NOT: { id } } });
      if (dup) throw new ConflictException(`Parameter externalId '${body.externalId}' already exists in tenant`);
    }
    if (body.userCode && body.userCode !== param.userCode) {
      const dup = await this.prisma.parameter.findFirst({ where: { tenantId, userCode: body.userCode, NOT: { id } } });
      if (dup) throw new ConflictException(`Parameter userCode '${body.userCode}' already exists in tenant`);
    }
    const updated = await this.prisma.parameter.update({ where: { id }, data: body });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.parameter.update', entityType: 'Parameter', entityId: id, before: param, after: body, correlationId });
    return updated;
  }

  // ─── Test-Parameter Mappings ──────────────────────────────────────────────

  async listTestParameters(tenantId: string, testId: string) {
    await this.getTest(tenantId, testId);
    return this.prisma.testParameterMapping.findMany({
      where: { tenantId, testId },
      include: { parameter: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addTestParameterMapping(
    tenantId: string,
    testId: string,
    parameterId: string,
    ordering: number,
    actorUserId: string,
    correlationId?: string,
    opts?: { displayOrder?: number; isRequired?: boolean; unitOverride?: string | null },
  ) {
    await this.getTest(tenantId, testId);
    await this.getParameter(tenantId, parameterId);
    const existing = await this.prisma.testParameterMapping.findUnique({
      where: { tenantId_testId_parameterId: { tenantId, testId, parameterId } },
    });
    if (existing) throw new ConflictException('Mapping already exists');
    const displayOrder = opts?.displayOrder ?? ordering;
    const mapping = await this.prisma.testParameterMapping.create({
      data: {
        tenantId, testId, parameterId, ordering,
        displayOrder,
        isRequired: opts?.isRequired ?? true,
        unitOverride: opts?.unitOverride ?? null,
      },
    });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.test_parameter.add', entityType: 'TestParameterMapping', entityId: mapping.id, after: { testId, parameterId, ordering, displayOrder }, correlationId });
    return mapping;
  }

  async removeTestParameterMapping(tenantId: string, testId: string, parameterId: string, actorUserId: string, correlationId?: string) {
    const mapping = await this.prisma.testParameterMapping.findUnique({
      where: { tenantId_testId_parameterId: { tenantId, testId, parameterId } },
    });
    if (!mapping) throw new NotFoundException('Mapping not found');
    await this.prisma.testParameterMapping.delete({ where: { tenantId_testId_parameterId: { tenantId, testId, parameterId } } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.test_parameter.remove', entityType: 'TestParameterMapping', entityId: mapping.id, correlationId });
  }

  // ─── Panel-Test Mappings ──────────────────────────────────────────────────

  async listPanelTests(tenantId: string, panelId: string) {
    const panel = await this.prisma.catalogPanel.findFirst({ where: { id: panelId, tenantId } });
    if (!panel) throw new NotFoundException('Panel not found');
    return this.prisma.panelTestMapping.findMany({
      where: { tenantId, panelId },
      include: { test: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addPanelTestMapping(tenantId: string, panelId: string, testId: string, ordering: number, actorUserId: string, correlationId?: string, displayOrder?: number) {
    const panel = await this.prisma.catalogPanel.findFirst({ where: { id: panelId, tenantId } });
    if (!panel) throw new NotFoundException('Panel not found');
    await this.getTest(tenantId, testId);
    const existing = await this.prisma.panelTestMapping.findUnique({
      where: { tenantId_panelId_testId: { tenantId, panelId, testId } },
    });
    if (existing) throw new ConflictException('Panel-test mapping already exists');
    const effectiveDisplayOrder = displayOrder ?? ordering;
    const mapping = await this.prisma.panelTestMapping.create({ data: { tenantId, panelId, testId, ordering, displayOrder: effectiveDisplayOrder } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.panel_test.add', entityType: 'PanelTestMapping', entityId: mapping.id, after: { panelId, testId, ordering, displayOrder: effectiveDisplayOrder }, correlationId });
    return mapping;
  }

  async removePanelTestMapping(tenantId: string, panelId: string, testId: string, actorUserId: string, correlationId?: string) {
    const mapping = await this.prisma.panelTestMapping.findUnique({
      where: { tenantId_panelId_testId: { tenantId, panelId, testId } },
    });
    if (!mapping) throw new NotFoundException('Panel-test mapping not found');
    await this.prisma.panelTestMapping.delete({ where: { tenantId_panelId_testId: { tenantId, panelId, testId } } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.panel_test.remove', entityType: 'PanelTestMapping', entityId: mapping.id, correlationId });
  }

  // ─── Test Definition ──────────────────────────────────────────────────────

  async getTestDefinition(tenantId: string, testId: string) {
    const test = await this.prisma.catalogTest.findFirst({
      where: { id: testId, tenantId },
      include: {
        parameterMappings: {
          include: { parameter: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    if (!test) throw new NotFoundException('Catalog test not found');
    const { parameterMappings, ...testFields } = test as any;
    return {
      ...testFields,
      specimenType: testFields.sampleType,
      parameters: parameterMappings.map((m: any) => ({
        parameterId: m.parameterId,
        name: m.parameter.name,
        userCode: m.parameter.userCode,
        loincCode: m.parameter.loincCode,
        resultType: m.parameter.resultType,
        effectiveUnit: m.unitOverride ?? m.parameter.defaultUnit,
        decimals: m.parameter.decimals,
        allowedValues: m.parameter.allowedValues,
        displayOrder: m.displayOrder,
        isRequired: m.isRequired,
      })),
    };
  }

  // ─── Panel Definition ─────────────────────────────────────────────────────

  async getPanelDefinition(tenantId: string, panelId: string) {
    const panel = await this.prisma.catalogPanel.findFirst({
      where: { id: panelId, tenantId },
      include: {
        testMappings: {
          include: {
            test: {
              include: {
                parameterMappings: {
                  include: { parameter: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    if (!panel) throw new NotFoundException('Panel not found');
    const { testMappings, ...panelFields } = panel as any;
    return {
      ...panelFields,
      tests: testMappings.map((tm: any) => ({
        testId: tm.testId,
        name: tm.test.name,
        userCode: tm.test.userCode,
        loincCode: tm.test.loincCode,
        displayOrder: tm.displayOrder,
        parameters: tm.test.parameterMappings.map((m: any) => ({
          parameterId: m.parameterId,
          name: m.parameter.name,
          userCode: m.parameter.userCode,
          loincCode: m.parameter.loincCode,
          resultType: m.parameter.resultType,
          effectiveUnit: m.unitOverride ?? m.parameter.defaultUnit,
          decimals: m.parameter.decimals,
          allowedValues: m.parameter.allowedValues,
          displayOrder: m.displayOrder,
          isRequired: m.isRequired,
        })),
      })),
    };
  }

  // ─── Bulk Update Test Parameters ──────────────────────────────────────────

  async bulkUpdateTestParameters(
    tenantId: string,
    testId: string,
    body: {
      mode: 'MERGE_UPSERT' | 'REPLACE';
      items: Array<{
        parameterId?: string;
        parameterExternalId?: string;
        parameterUserCode?: string;
        displayOrder: number;
        isRequired?: boolean;
        unitOverride?: string | null;
      }>;
    },
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.getTest(tenantId, testId);

    // Resolve parameterId for each item
    const resolved = await Promise.all(body.items.map(async (item) => {
      let pid = item.parameterId;
      if (!pid && item.parameterExternalId) {
        const p = await this.prisma.parameter.findFirst({ where: { tenantId, externalId: item.parameterExternalId } });
        if (!p) throw new NotFoundException(`Parameter externalId '${item.parameterExternalId}' not found`);
        pid = p.id;
      }
      if (!pid && item.parameterUserCode) {
        const p = await this.prisma.parameter.findFirst({ where: { tenantId, userCode: item.parameterUserCode } });
        if (!p) throw new NotFoundException(`Parameter userCode '${item.parameterUserCode}' not found`);
        pid = p.id;
      }
      if (!pid) throw new NotFoundException('Each item must provide parameterId, parameterExternalId, or parameterUserCode');
      return { ...item, parameterId: pid };
    }));

    if (body.mode === 'REPLACE') {
      await this.prisma.testParameterMapping.deleteMany({ where: { tenantId, testId } });
      await this.prisma.testParameterMapping.createMany({
        data: resolved.map((item) => ({
          tenantId, testId,
          parameterId: item.parameterId!,
          ordering: item.displayOrder,
          displayOrder: item.displayOrder,
          isRequired: item.isRequired ?? true,
          unitOverride: item.unitOverride ?? null,
        })),
      });
    } else {
      for (const item of resolved) {
        await this.prisma.testParameterMapping.upsert({
          where: { tenantId_testId_parameterId: { tenantId, testId, parameterId: item.parameterId! } },
          create: {
            tenantId, testId, parameterId: item.parameterId!,
            ordering: item.displayOrder, displayOrder: item.displayOrder,
            isRequired: item.isRequired ?? true, unitOverride: item.unitOverride ?? null,
          },
          update: {
            displayOrder: item.displayOrder, ordering: item.displayOrder,
            isRequired: item.isRequired ?? true, unitOverride: item.unitOverride ?? null,
          },
        });
      }
    }

    await this.audit.log({ tenantId, actorUserId, action: 'catalog.test_parameters.bulk_update', entityType: 'CatalogTest', entityId: testId, after: { mode: body.mode, count: resolved.length }, correlationId });
    return this.listTestParameters(tenantId, testId);
  }

  // ─── Bulk Update Panel Tests ──────────────────────────────────────────────

  async bulkUpdatePanelTests(
    tenantId: string,
    panelId: string,
    body: {
      mode: 'MERGE_UPSERT' | 'REPLACE';
      items: Array<{
        testId?: string;
        testExternalId?: string;
        testUserCode?: string;
        displayOrder: number;
      }>;
    },
    actorUserId: string,
    correlationId?: string,
  ) {
    const panel = await this.prisma.catalogPanel.findFirst({ where: { id: panelId, tenantId } });
    if (!panel) throw new NotFoundException('Panel not found');

    const resolved = await Promise.all(body.items.map(async (item) => {
      let tid = item.testId;
      if (!tid && item.testExternalId) {
        const t = await this.prisma.catalogTest.findFirst({ where: { tenantId, externalId: item.testExternalId } });
        if (!t) throw new NotFoundException(`Test externalId '${item.testExternalId}' not found`);
        tid = t.id;
      }
      if (!tid && item.testUserCode) {
        const t = await this.prisma.catalogTest.findFirst({ where: { tenantId, userCode: item.testUserCode } });
        if (!t) throw new NotFoundException(`Test userCode '${item.testUserCode}' not found`);
        tid = t.id;
      }
      if (!tid) throw new NotFoundException('Each item must provide testId, testExternalId, or testUserCode');
      return { ...item, testId: tid };
    }));

    if (body.mode === 'REPLACE') {
      await this.prisma.panelTestMapping.deleteMany({ where: { tenantId, panelId } });
      await this.prisma.panelTestMapping.createMany({
        data: resolved.map((item) => ({
          tenantId, panelId, testId: item.testId!,
          ordering: item.displayOrder, displayOrder: item.displayOrder,
        })),
      });
    } else {
      for (const item of resolved) {
        await this.prisma.panelTestMapping.upsert({
          where: { tenantId_panelId_testId: { tenantId, panelId, testId: item.testId! } },
          create: { tenantId, panelId, testId: item.testId!, ordering: item.displayOrder, displayOrder: item.displayOrder },
          update: { displayOrder: item.displayOrder, ordering: item.displayOrder },
        });
      }
    }

    await this.audit.log({ tenantId, actorUserId, action: 'catalog.panel_tests.bulk_update', entityType: 'CatalogPanel', entityId: panelId, after: { mode: body.mode, count: resolved.length }, correlationId });
    return this.listPanelTests(tenantId, panelId);
  }

  // ─── Reference Ranges ─────────────────────────────────────────────────────

  async listReferenceRanges(tenantId: string, parameterId?: string, opts: { page?: number; limit?: number } = {}) {
    const page = Number(opts.page ?? 1);
    const limit = Number(opts.limit ?? 20);
    const where: any = { tenantId };
    if (parameterId) where.parameterId = parameterId;
    const [data, total] = await Promise.all([
      this.prisma.referenceRange.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.referenceRange.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createReferenceRange(tenantId: string, body: { parameterId: string; testId?: string; gender?: string; ageMinYears?: number; ageMaxYears?: number; lowValue?: number; highValue?: number; criticalLow?: number; criticalHigh?: number; unit?: string }, actorUserId: string, correlationId?: string) {
    await this.getParameter(tenantId, body.parameterId);
    const range = await this.prisma.referenceRange.create({ data: { tenantId, ...body } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.reference_range.create', entityType: 'ReferenceRange', entityId: range.id, after: body, correlationId });
    return range;
  }

  async updateReferenceRange(tenantId: string, id: string, body: any, actorUserId: string, correlationId?: string) {
    const range = await this.prisma.referenceRange.findFirst({ where: { id, tenantId } });
    if (!range) throw new NotFoundException('Reference range not found');
    const updated = await this.prisma.referenceRange.update({ where: { id }, data: body });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.reference_range.update', entityType: 'ReferenceRange', entityId: id, before: range, after: body, correlationId });
    return updated;
  }

  async deleteReferenceRange(tenantId: string, id: string, actorUserId: string, correlationId?: string) {
    const range = await this.prisma.referenceRange.findFirst({ where: { id, tenantId } });
    if (!range) throw new NotFoundException('Reference range not found');
    await this.prisma.referenceRange.delete({ where: { id } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.reference_range.delete', entityType: 'ReferenceRange', entityId: id, correlationId });
  }
}
