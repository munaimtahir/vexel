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
  // Verification workflow flags
  { key: 'lims.verification.enabled', description: 'Enable verification step for LIMS results' },
  { key: 'lims.operator.verificationPages.enabled', description: 'Show verification pages in Operator UI' },
  { key: 'lims.operator.sample.receiveSeparate.enabled', description: 'Separate specimen receive step in sample collection' },
];

// Variant flags have a JSON payload instead of a simple boolean
export const VARIANT_FLAG_DEFAULTS: Record<string, unknown> = {
  'lims.verification.mode': { mode: 'separate' }, // 'separate' | 'inline' | 'disabled'
};

// Boolean flag defaults (true = enabled by default)
export const FLAG_DEFAULTS: Record<string, boolean> = {
  'lims.verification.enabled': true,
  'lims.operator.verificationPages.enabled': true,
  'lims.operator.sample.receiveSeparate.enabled': false,
};

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

  /** Returns merged flags: DB overrides + defaults. Includes variant flags. */
  async getResolvedFlags(tenantId: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.tenantFeature.findMany({ where: { tenantId } });
    const result: Record<string, unknown> = {};

    // Apply boolean defaults
    for (const [key, def] of Object.entries(FLAG_DEFAULTS)) {
      result[key] = def;
    }
    // Apply variant defaults
    for (const [key, def] of Object.entries(VARIANT_FLAG_DEFAULTS)) {
      result[key] = def;
    }
    // Apply DB overrides
    for (const row of rows) {
      if (row.variantJson) {
        try { result[row.key] = JSON.parse(row.variantJson); } catch { /* ignore bad json */ }
      } else {
        result[row.key] = row.enabled;
      }
    }
    return result;
  }

  /** Get single boolean flag with default fallback */
  async isEnabled(tenantId: string, key: string): Promise<boolean> {
    const row = await this.prisma.tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (row) return row.enabled;
    return FLAG_DEFAULTS[key] ?? false;
  }

  /** Get single variant flag with default fallback */
  async getVariant<T = unknown>(tenantId: string, key: string): Promise<T> {
    const row = await this.prisma.tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (row?.variantJson) {
      try { return JSON.parse(row.variantJson) as T; } catch { /* fall through */ }
    }
    return (VARIANT_FLAG_DEFAULTS[key] ?? {}) as T;
  }

  async setVariantForTenant(
    tenantId: string,
    key: string,
    variantValue: unknown,
    actorUserId: string,
    correlationId?: string,
  ) {
    const before = await this.prisma.tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    const variantJson = JSON.stringify(variantValue);
    const flag = await this.prisma.tenantFeature.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { variantJson, updatedBy: actorUserId },
      create: { tenantId, key, enabled: true, variantJson, updatedBy: actorUserId,
        description: MODULE_KILL_SWITCHES.find((k) => k.key === key)?.description },
    });
    await this.audit.log({
      tenantId, actorUserId, action: 'feature_flag.set_variant',
      entityType: 'TenantFeature', entityId: flag.id,
      before: { key, variantJson: before?.variantJson },
      after: { key, variantJson },
      correlationId,
    });
    return flag;
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
