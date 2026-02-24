import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDomain(domain: string) {
    const record = await this.prisma.tenantDomain.findUnique({
      where: { domain },
      include: { tenant: true },
    });
    return record?.tenant ?? null;
  }

  async findById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: { domains: true, config: true },
    });
  }

  async list(page = 1, limit = 20) {
    page = Number(page);
    limit = Number(limit);
    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        include: { domains: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count(),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(body: { name: string; domains: string[]; status?: string }) {
    return this.prisma.tenant.create({
      data: {
        name: body.name,
        status: body.status ?? 'trial',
        domains: { create: body.domains.map((d) => ({ domain: d })) },
      },
      include: { domains: true },
    });
  }

  async update(id: string, body: { name?: string; status?: string }) {
    return this.prisma.tenant.update({
      where: { id },
      data: body,
      include: { domains: true },
    });
  }

  async getConfig(tenantId: string) {
    return this.prisma.tenantConfig.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  async updateConfig(tenantId: string, body: any) {
    return this.prisma.tenantConfig.upsert({
      where: { tenantId },
      update: body,
      create: { tenantId, ...body },
    });
  }
}
