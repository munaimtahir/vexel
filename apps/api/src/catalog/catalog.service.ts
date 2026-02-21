import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
}
