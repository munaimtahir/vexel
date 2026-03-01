import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { TenantService } from '../tenant/tenant.service';
import { AuditService } from '../audit/audit.service';
import { CatalogImportExportService } from '../catalog/catalog-import-export.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

const BASE_CATALOG_DIR = path.join(__dirname, '..', '..', 'resources', 'catalog');
const BASE_CATALOG_XLSX = path.join(BASE_CATALOG_DIR, 'base_catalog_v1.xlsx');
const BASE_CATALOG_META = path.join(BASE_CATALOG_DIR, 'base_catalog_v1.json');

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly audit: AuditService,
    private readonly catalogImport: CatalogImportExportService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
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

  async enableLims(
    tenantId: string,
    opts: { seedCatalog?: boolean; seedMode?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    // 1. Enable module.lims feature flag
    await this.featureFlags.setForTenant(
      tenantId,
      [{ key: 'module.lims', enabled: true }],
      actorUserId,
      correlationId,
    );

    const seedMode = opts.seedMode ?? 'BASE_ON_ENABLE';
    const shouldSeed = opts.seedCatalog !== false && seedMode !== 'EMPTY';

    // 2. Idempotency guard — skip if already seeded
    if (shouldSeed && tenant.catalogSeededAt) {
      const updatedTenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      return {
        limsEnabled: true,
        catalogSeeded: false,
        catalogAlreadySeeded: true,
        seedSummary: null,
        tenant: updatedTenant,
      };
    }

    let seedSummary: any = null;

    if (shouldSeed && seedMode !== 'CUSTOM_UPLOAD') {
      // 3. Load base catalog artifact
      if (!fs.existsSync(BASE_CATALOG_XLSX)) {
        throw new Error(`Base catalog artifact not found: ${BASE_CATALOG_XLSX}`);
      }
      const buffer = fs.readFileSync(BASE_CATALOG_XLSX);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const meta = JSON.parse(fs.readFileSync(BASE_CATALOG_META, 'utf8'));

      // 4. Import with UPSERT_PATCH (validate=false)
      const result = await this.catalogImport.importFromWorkbook(
        tenantId,
        buffer,
        { mode: 'UPSERT_PATCH', validate: false },
        actorUserId,
        correlationId,
      );

      seedSummary = { ...result, baseVersion: meta.baseVersion, hash };

      // 5. Mark tenant as seeded
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          catalogSeedMode: seedMode,
          catalogSeededAt: new Date(),
          catalogSeedBaseVersion: meta.baseVersion,
          catalogSeedHash: hash,
        },
      });

      // 6. Audit event
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'catalog.seed_from_base',
        entityType: 'Tenant',
        entityId: tenantId,
        after: {
          baseVersion: meta.baseVersion,
          hash,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
        },
        correlationId,
      });
    }

    // 7. Audit LIMS enable
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'tenant.lims.enable',
      entityType: 'Tenant',
      entityId: tenantId,
      after: { seedMode, catalogSeeded: shouldSeed },
      correlationId,
    });

    const finalTenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return {
      limsEnabled: true,
      catalogSeeded: shouldSeed && seedMode !== 'CUSTOM_UPLOAD',
      catalogAlreadySeeded: false,
      seedSummary,
      tenant: finalTenant,
    };
  }
}
