import { Injectable } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly audit: AuditService,
  ) {}

  async list(q: any) { return this.tenantService.list(q.page, q.limit); }

  async create(body: any, actorUserId: string, correlationId?: string) {
    const tenant = await this.tenantService.create(body);
    await this.audit.log({
      tenantId: tenant.id, actorUserId, action: 'tenant.create',
      entityType: 'Tenant', entityId: tenant.id,
      after: { name: tenant.name, status: tenant.status }, correlationId,
    });
    return tenant;
  }

  async getById(id: string) { return this.tenantService.findById(id); }

  async update(id: string, body: any, actorUserId: string, correlationId?: string) {
    const before = await this.tenantService.findById(id);
    const updated = await this.tenantService.update(id, body);
    await this.audit.log({
      tenantId: id, actorUserId, action: 'tenant.update',
      entityType: 'Tenant', entityId: id,
      before: { name: before?.name, status: before?.status },
      after: body, correlationId,
    });
    return updated;
  }

  async getConfig(id: string) { return this.tenantService.getConfig(id); }

  async updateConfig(id: string, body: any, actorUserId: string, correlationId?: string) {
    const updated = await this.tenantService.updateConfig(id, body);
    await this.audit.log({
      tenantId: id, actorUserId, action: 'tenant.config.update',
      entityType: 'TenantConfig', entityId: id, after: body, correlationId,
    });
    return updated;
  }
}
