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

  async listTests(tenantId: string, opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = opts;
    const where = { tenantId };
    const [data, total] = await Promise.all([
      this.prisma.catalogTest.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.catalogTest.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createTest(tenantId: string, body: { code: string; name: string; description?: string; sampleType?: string; turnaroundHours?: number }, actorUserId: string, correlationId?: string) {
    const existing = await this.prisma.catalogTest.findUnique({ where: { tenantId_code: { tenantId, code: body.code } } });
    if (existing) throw new ConflictException(`Test code '${body.code}' already exists in tenant`);
    const test = await this.prisma.catalogTest.create({ data: { tenantId, ...body } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.test.create', entityType: 'CatalogTest', entityId: test.id, after: body, correlationId });
    return test;
  }

  async getTest(tenantId: string, id: string) {
    const test = await this.prisma.catalogTest.findFirst({ where: { id, tenantId } });
    if (!test) throw new NotFoundException('Catalog test not found');
    return test;
  }

  async updateTest(tenantId: string, id: string, body: { name?: string; description?: string; sampleType?: string; turnaroundHours?: number; isActive?: boolean }, actorUserId: string, correlationId?: string) {
    const test = await this.prisma.catalogTest.findFirst({ where: { id, tenantId } });
    if (!test) throw new NotFoundException('Catalog test not found');
    const updated = await this.prisma.catalogTest.update({ where: { id }, data: body });
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

  async listPanels(tenantId: string, opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = opts;
    const where = { tenantId };
    const [data, total] = await Promise.all([
      this.prisma.catalogPanel.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.catalogPanel.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createPanel(tenantId: string, body: { code: string; name: string; description?: string; testIds?: string[] }, actorUserId: string, correlationId?: string) {
    const existing = await this.prisma.catalogPanel.findUnique({ where: { tenantId_code: { tenantId, code: body.code } } });
    if (existing) throw new ConflictException(`Panel code '${body.code}' already exists in tenant`);
    const panel = await this.prisma.catalogPanel.create({ data: { tenantId, ...body } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.panel.create', entityType: 'CatalogPanel', entityId: panel.id, after: body, correlationId });
    return panel;
  }

  // ─── Parameters ───────────────────────────────────────────────────────────

  async listParameters(tenantId: string, opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = opts;
    const where = { tenantId };
    const [data, total] = await Promise.all([
      this.prisma.parameter.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.parameter.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createParameter(tenantId: string, body: { code: string; name: string; unit?: string; dataType?: string }, actorUserId: string, correlationId?: string) {
    const existing = await this.prisma.parameter.findUnique({ where: { tenantId_code: { tenantId, code: body.code } } });
    if (existing) throw new ConflictException(`Parameter code '${body.code}' already exists in tenant`);
    const param = await this.prisma.parameter.create({ data: { tenantId, ...body } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.parameter.create', entityType: 'Parameter', entityId: param.id, after: body, correlationId });
    return param;
  }

  async getParameter(tenantId: string, id: string) {
    const param = await this.prisma.parameter.findFirst({ where: { id, tenantId } });
    if (!param) throw new NotFoundException('Parameter not found');
    return param;
  }

  async updateParameter(tenantId: string, id: string, body: { name?: string; unit?: string; dataType?: string; isActive?: boolean }, actorUserId: string, correlationId?: string) {
    const param = await this.prisma.parameter.findFirst({ where: { id, tenantId } });
    if (!param) throw new NotFoundException('Parameter not found');
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
      orderBy: { ordering: 'asc' },
    });
  }

  async addTestParameterMapping(tenantId: string, testId: string, parameterId: string, ordering: number, actorUserId: string, correlationId?: string) {
    await this.getTest(tenantId, testId);
    await this.getParameter(tenantId, parameterId);
    const existing = await this.prisma.testParameterMapping.findUnique({
      where: { tenantId_testId_parameterId: { tenantId, testId, parameterId } },
    });
    if (existing) throw new ConflictException('Mapping already exists');
    const mapping = await this.prisma.testParameterMapping.create({ data: { tenantId, testId, parameterId, ordering } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.test_parameter.add', entityType: 'TestParameterMapping', entityId: mapping.id, after: { testId, parameterId, ordering }, correlationId });
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
      orderBy: { ordering: 'asc' },
    });
  }

  async addPanelTestMapping(tenantId: string, panelId: string, testId: string, ordering: number, actorUserId: string, correlationId?: string) {
    const panel = await this.prisma.catalogPanel.findFirst({ where: { id: panelId, tenantId } });
    if (!panel) throw new NotFoundException('Panel not found');
    await this.getTest(tenantId, testId);
    const existing = await this.prisma.panelTestMapping.findUnique({
      where: { tenantId_panelId_testId: { tenantId, panelId, testId } },
    });
    if (existing) throw new ConflictException('Panel-test mapping already exists');
    const mapping = await this.prisma.panelTestMapping.create({ data: { tenantId, panelId, testId, ordering } });
    await this.audit.log({ tenantId, actorUserId, action: 'catalog.panel_test.add', entityType: 'PanelTestMapping', entityId: mapping.id, after: { panelId, testId, ordering }, correlationId });
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

  // ─── Reference Ranges ─────────────────────────────────────────────────────

  async listReferenceRanges(tenantId: string, parameterId?: string, opts: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = opts;
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
