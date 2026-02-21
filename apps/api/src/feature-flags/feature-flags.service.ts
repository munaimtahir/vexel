import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const MODULE_KILL_SWITCHES = [
  { key: 'module.lims', description: 'LIMS core module' },
  { key: 'module.printing', description: 'Printing module' },
  { key: 'module.rad', description: 'Radiology (RAD) scaffold' },
  { key: 'module.opd', description: 'OPD scaffold' },
  { key: 'module.ipd', description: 'IPD scaffold' },
  { key: 'lims.auto_verify', description: 'Auto-verify LIMS results' },
  { key: 'lims.print_results', description: 'Allow printing from LIMS' },
];

@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listGlobal() {
    return MODULE_KILL_SWITCHES.map((f) => ({ ...f, enabled: false }));
  }

  async listForTenant(tenantId: string) {
    const flags = await this.prisma.tenantFeature.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' },
    });
    return flags;
  }

  async setForTenant(
    tenantId: string,
    updates: Array<{ key: string; enabled: boolean }>,
    actorUserId: string,
    correlationId?: string,
  ) {
    const results: any[] = [];
    for (const update of updates) {
      const before = await this.prisma.tenantFeature.findUnique({
        where: { tenantId_key: { tenantId, key: update.key } },
      });

      const flag = await this.prisma.tenantFeature.upsert({
        where: { tenantId_key: { tenantId, key: update.key } },
        update: { enabled: update.enabled, updatedBy: actorUserId },
        create: {
          tenantId, key: update.key, enabled: update.enabled,
          updatedBy: actorUserId,
          description: MODULE_KILL_SWITCHES.find((k) => k.key === update.key)?.description,
        },
      });

      await this.audit.log({
        tenantId, actorUserId, action: 'feature_flag.set',
        entityType: 'TenantFeature', entityId: flag.id,
        before: { key: update.key, enabled: before?.enabled },
        after: { key: update.key, enabled: update.enabled },
        correlationId,
      });

      results.push(flag);
    }
    return results;
  }

  async setGlobal(key: string, enabled: boolean, actorUserId: string, correlationId?: string) {
    await this.audit.log({
      tenantId: 'system', actorUserId, action: 'feature_flag.set_global',
      entityType: 'FeatureFlag', entityId: key,
      before: { key }, after: { key, enabled }, correlationId,
    });
    return { key, enabled, description: MODULE_KILL_SWITCHES.find((k) => k.key === key)?.description };
  }
}
