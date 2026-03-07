import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { validateFamilySchemaCompatibility, TEMPLATE_FAMILIES, RESULT_SCHEMA_TYPES } from './templates-validation';
import { randomUUID } from 'crypto';

type CreateTemplateOptions = {
  source: 'blueprint' | 'clone' | 'shell';
  sourceBlueprintId?: string;
  sourceTemplateId?: string;
  templateFamily?: string;
  schemaType?: string;
  name?: string;
  code?: string;
};

type ListTemplatesOptions = {
  page?: number;
  limit?: number;
  status?: string;
  schemaType?: string;
  templateFamily?: string;
};

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Blueprints ────────────────────────────────────────────────────────────

  async listBlueprints() {
    const data = await (this.prisma as any).templateBlueprint.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return { data };
  }

  async provisionDefaults(
    tenantId: string,
    actorUserId: string,
    correlationId: string,
    opts: { blueprintCodes?: string[]; overwriteExisting?: boolean } = {},
  ) {
    const where: any = { isActive: true };
    if (opts.blueprintCodes?.length) {
      where.code = { in: opts.blueprintCodes };
    }
    const blueprints = await (this.prisma as any).templateBlueprint.findMany({ where, orderBy: { sortOrder: 'asc' } });

    let provisioned = 0;
    let skipped = 0;
    const templates: any[] = [];

    for (const bp of blueprints) {
      const existing = await (this.prisma as any).printTemplate.findFirst({
        where: { tenantId, sourceBlueprintId: bp.id, status: { not: 'ARCHIVED' } },
      });
      if (existing && !opts.overwriteExisting) {
        skipped++;
        continue;
      }

      const code = await this.generateUniqueCode(tenantId, bp.code);
      const tpl = await (this.prisma as any).printTemplate.create({
        data: {
          tenantId,
          sourceBlueprintId: bp.id,
          code,
          name: bp.name,
          schemaType: bp.schemaType,
          templateFamily: bp.templateFamily,
          templateVersion: 1,
          status: 'ACTIVE',
          configJson: bp.defaultConfigJson,
          isSystemProvisioned: true,
          createdByUserId: actorUserId,
        },
      });
      templates.push(tpl);
      provisioned++;

      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'template.provision',
        entityType: 'PrintTemplate',
        entityId: tpl.id,
        correlationId,
        after: { code, name: bp.name, sourceBlueprintId: bp.id, status: 'ACTIVE' },
      });
    }

    return { provisioned, skipped, templates };
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  async listTemplates(tenantId: string, opts: ListTemplatesOptions = {}) {
    const page = Number(opts.page ?? 1);
    const limit = Number(opts.limit ?? 20);
    const where: any = { tenantId };
    if (opts.status) where.status = opts.status;
    if (opts.schemaType) where.schemaType = opts.schemaType;
    if (opts.templateFamily) where.templateFamily = opts.templateFamily;

    const [data, total] = await Promise.all([
      (this.prisma as any).printTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ status: 'asc' }, { code: 'asc' }, { templateVersion: 'desc' }],
      }),
      (this.prisma as any).printTemplate.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getTemplate(tenantId: string, id: string) {
    const tpl = await (this.prisma as any).printTemplate.findUnique({ where: { id } });
    if (!tpl || tpl.tenantId !== tenantId) {
      throw new NotFoundException(`PrintTemplate ${id} not found`);
    }
    return tpl;
  }

  async createTemplate(
    tenantId: string,
    actorUserId: string,
    correlationId: string,
    opts: CreateTemplateOptions,
  ) {
    if (opts.source === 'blueprint') {
      if (!opts.sourceBlueprintId) throw new BadRequestException('sourceBlueprintId required for blueprint source');
      const bp = await (this.prisma as any).templateBlueprint.findUnique({ where: { id: opts.sourceBlueprintId } });
      if (!bp || !bp.isActive) throw new NotFoundException(`Blueprint ${opts.sourceBlueprintId} not found`);

      const code = opts.code ?? await this.generateUniqueCode(tenantId, bp.code);
      await this.assertCodeVersionAvailable(tenantId, code, 1);

      const tpl = await (this.prisma as any).printTemplate.create({
        data: {
          tenantId,
          sourceBlueprintId: bp.id,
          code,
          name: opts.name ?? bp.name,
          schemaType: bp.schemaType,
          templateFamily: bp.templateFamily,
          templateVersion: 1,
          status: 'DRAFT',
          configJson: bp.defaultConfigJson,
          isSystemProvisioned: false,
          createdByUserId: actorUserId,
        },
      });
      await this.audit.log({ tenantId, actorUserId, action: 'template.create', entityType: 'PrintTemplate', entityId: tpl.id, correlationId, after: { source: 'blueprint', blueprintId: bp.id, code, status: 'DRAFT' } });
      return tpl;
    }

    if (opts.source === 'clone') {
      if (!opts.sourceTemplateId) throw new BadRequestException('sourceTemplateId required for clone source');
      const source = await this.getTemplate(tenantId, opts.sourceTemplateId);

      const code = opts.code ?? await this.generateUniqueCode(tenantId, source.code + '_copy');
      await this.assertCodeVersionAvailable(tenantId, code, 1);

      const tpl = await (this.prisma as any).printTemplate.create({
        data: {
          tenantId,
          sourceBlueprintId: source.sourceBlueprintId,
          code,
          name: opts.name ?? `${source.name} (Copy)`,
          schemaType: source.schemaType,
          templateFamily: source.templateFamily,
          templateVersion: 1,
          status: 'DRAFT',
          configJson: source.configJson,
          isSystemProvisioned: false,
          createdByUserId: actorUserId,
        },
      });
      await this.audit.log({ tenantId, actorUserId, action: 'template.clone', entityType: 'PrintTemplate', entityId: tpl.id, correlationId, after: { source: 'clone', sourceTemplateId: source.id, code, status: 'DRAFT' } });
      return tpl;
    }

    if (opts.source === 'shell') {
      if (!opts.templateFamily) throw new BadRequestException('templateFamily required for shell source');
      if (!opts.schemaType) throw new BadRequestException('schemaType required for shell source');
      const compat = validateFamilySchemaCompatibility(opts.templateFamily, opts.schemaType);
      if (!compat.valid) throw new BadRequestException(compat.message);

      const code = opts.code ?? await this.generateUniqueCode(tenantId, `${opts.templateFamily.toLowerCase()}_v1`);
      await this.assertCodeVersionAvailable(tenantId, code, 1);

      const tpl = await (this.prisma as any).printTemplate.create({
        data: {
          tenantId,
          code,
          name: opts.name ?? `New ${opts.templateFamily} Template`,
          schemaType: opts.schemaType,
          templateFamily: opts.templateFamily,
          templateVersion: 1,
          status: 'DRAFT',
          configJson: null,
          isSystemProvisioned: false,
          createdByUserId: actorUserId,
        },
      });
      await this.audit.log({ tenantId, actorUserId, action: 'template.create', entityType: 'PrintTemplate', entityId: tpl.id, correlationId, after: { source: 'shell', family: opts.templateFamily, schemaType: opts.schemaType, code, status: 'DRAFT' } });
      return tpl;
    }

    throw new BadRequestException(`Invalid source: ${(opts as any).source}`);
  }

  async updateTemplate(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId: string,
    body: { name?: string; configJson?: Record<string, unknown> | null },
  ) {
    const tpl = await this.getTemplate(tenantId, id);

    if (tpl.status === 'ARCHIVED') {
      throw new ConflictException('Cannot edit an archived template');
    }

    if (tpl.status === 'ACTIVE') {
      // Create new draft version instead of editing in-place
      const newVersion = tpl.templateVersion + 1;
      await this.assertCodeVersionAvailable(tenantId, tpl.code, newVersion);

      const newTpl = await (this.prisma as any).printTemplate.create({
        data: {
          tenantId,
          sourceBlueprintId: tpl.sourceBlueprintId,
          code: tpl.code,
          name: body.name ?? tpl.name,
          schemaType: tpl.schemaType,
          templateFamily: tpl.templateFamily,
          templateVersion: newVersion,
          status: 'DRAFT',
          configJson: body.configJson !== undefined ? body.configJson : tpl.configJson,
          isSystemProvisioned: false,
          createdByUserId: actorUserId,
          supersedesTemplateId: id,
        },
      });
      await this.audit.log({ tenantId, actorUserId, action: 'template.new_draft_version', entityType: 'PrintTemplate', entityId: newTpl.id, correlationId, before: { id, version: tpl.templateVersion, status: tpl.status }, after: { newVersion, status: 'DRAFT' } });
      return newTpl;
    }

    // DRAFT — update in place
    const before = { name: tpl.name, configJson: tpl.configJson };
    const updated = await (this.prisma as any).printTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.configJson !== undefined ? { configJson: body.configJson } : {}),
      },
    });
    await this.audit.log({ tenantId, actorUserId, action: 'template.update', entityType: 'PrintTemplate', entityId: id, correlationId, before, after: { name: updated.name, configJson: updated.configJson } });
    return updated;
  }

  async cloneTemplate(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId: string,
    body: { name?: string; code?: string } = {},
  ) {
    return this.createTemplate(tenantId, actorUserId, correlationId, {
      source: 'clone',
      sourceTemplateId: id,
      name: body.name,
      code: body.code,
    });
  }

  async createNewVersion(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId: string,
  ) {
    const tpl = await this.getTemplate(tenantId, id);
    if (tpl.status !== 'ACTIVE') {
      throw new ConflictException(`Cannot create new version — template must be ACTIVE (current: ${tpl.status})`);
    }
    return this.updateTemplate(tenantId, id, actorUserId, correlationId, {});
  }

  async activateTemplate(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId: string,
  ) {
    const tpl = await this.getTemplate(tenantId, id);
    if (tpl.status !== 'DRAFT') {
      throw new ConflictException(`Cannot activate — template is ${tpl.status} (must be DRAFT)`);
    }

    // Archive any other active template with same code
    await (this.prisma as any).printTemplate.updateMany({
      where: { tenantId, code: tpl.code, status: 'ACTIVE', id: { not: id } },
      data: { status: 'ARCHIVED' },
    });

    const activated = await (this.prisma as any).printTemplate.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.audit.log({ tenantId, actorUserId, action: 'template.activate', entityType: 'PrintTemplate', entityId: id, correlationId, before: { status: 'DRAFT' }, after: { status: 'ACTIVE' } });
    return activated;
  }

  async archiveTemplate(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId: string,
  ) {
    const tpl = await this.getTemplate(tenantId, id);

    // Check: don't archive if it's the sole default for any test
    const defaultMappings = await (this.prisma as any).testTemplateMap.findMany({
      where: { tenantId, templateId: id, isDefault: true, isEnabled: true },
    });
    if (defaultMappings.length > 0) {
      throw new ConflictException(
        `Cannot archive: this template is the default for ${defaultMappings.length} test(s). Reassign defaults first.`,
      );
    }

    const archived = await (this.prisma as any).printTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await this.audit.log({ tenantId, actorUserId, action: 'template.archive', entityType: 'PrintTemplate', entityId: id, correlationId, before: { status: tpl.status }, after: { status: 'ARCHIVED' } });
    return archived;
  }

  async previewTemplate(
    tenantId: string,
    id: string,
    _actorUserId: string,
    _correlationId: string,
    samplePayload?: Record<string, unknown>,
  ): Promise<Buffer> {
    const tpl = await this.getTemplate(tenantId, id);
    const tenantConfig = await this.prisma.tenantConfig.findUnique({ where: { tenantId } });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    // Build sample payload if not provided
    const payload = samplePayload ?? this.buildSamplePayload(tpl, tenantConfig, tenant);

    const templateKey = this.resolveTemplateKey(tpl.templateFamily);
    const branding: Record<string, unknown> = { ...(tenantConfig ?? {}) };

    const renderBody = JSON.stringify({
      templateKey,
      payloadJson: payload,
      brandingConfig: branding,
      configJson: tpl.configJson,
    });

    const pdfServiceUrl = process.env.PDF_SERVICE_URL ?? 'http://pdf:8080';
    const response = await fetch(`${pdfServiceUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: renderBody,
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`PDF service error ${response.status}: ${errText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ─── Test Template Mappings ────────────────────────────────────────────────

  async getTestMappings(tenantId: string, testId: string) {
    const test = await this.prisma.catalogTest.findFirst({ where: { id: testId, tenantId } });
    if (!test) throw new NotFoundException(`Test ${testId} not found`);

    const mappings = await (this.prisma as any).testTemplateMap.findMany({
      where: { tenantId, testId },
      include: { template: true },
      orderBy: { sortOrder: 'asc' },
    });

    const defaultMapping = mappings.find((m: any) => m.isDefault && m.isEnabled);
    return {
      data: mappings,
      testSchemaType: (test as any).resultSchemaType,
      allowTemplateOverride: (test as any).allowTemplateOverride,
      defaultTemplateId: defaultMapping?.templateId ?? null,
    };
  }

  async setTestMappings(
    tenantId: string,
    testId: string,
    actorUserId: string,
    correlationId: string,
    body: {
      mappings: Array<{ templateId: string; isDefault: boolean; sortOrder?: number; isEnabled?: boolean }>;
      allowTemplateOverride?: boolean;
    },
  ) {
    const test = await this.prisma.catalogTest.findFirst({ where: { id: testId, tenantId } });
    if (!test) throw new NotFoundException(`Test ${testId} not found`);

    const testSchemaType = (test as any).resultSchemaType ?? 'TABULAR';

    // Validate all mappings
    const defaultMappings = body.mappings.filter((m) => m.isDefault);
    if (defaultMappings.length > 1) {
      throw new BadRequestException('Only one mapping may be set as default');
    }

    for (const m of body.mappings) {
      const tpl = await (this.prisma as any).printTemplate.findUnique({ where: { id: m.templateId } });
      if (!tpl || tpl.tenantId !== tenantId) {
        throw new BadRequestException(`Template ${m.templateId} not found in this tenant`);
      }
      if (tpl.status === 'ARCHIVED') {
        throw new BadRequestException(`Template ${m.templateId} is archived and cannot be mapped`);
      }
      if (tpl.schemaType !== testSchemaType) {
        throw new BadRequestException(
          `Template ${m.templateId} schemaType (${tpl.schemaType}) does not match test schemaType (${testSchemaType})`,
        );
      }
    }

    // Replace all mappings in a transaction
    const before = await (this.prisma as any).testTemplateMap.findMany({ where: { tenantId, testId } });

    await this.prisma.$transaction(async (tx: any) => {
      await tx.testTemplateMap.deleteMany({ where: { tenantId, testId } });
      for (const m of body.mappings) {
        await tx.testTemplateMap.create({
          data: {
            tenantId,
            testId,
            templateId: m.templateId,
            isDefault: m.isDefault,
            sortOrder: m.sortOrder ?? 0,
            isEnabled: m.isEnabled ?? true,
          },
        });
      }
      if (body.allowTemplateOverride !== undefined) {
        await tx.catalogTest.update({
          where: { id: testId },
          data: { allowTemplateOverride: body.allowTemplateOverride },
        });
      }
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'template.mapping.set',
      entityType: 'TestTemplateMap',
      entityId: testId,
      correlationId,
      before: { mappingCount: before.length },
      after: { mappingCount: body.mappings.length, allowTemplateOverride: body.allowTemplateOverride },
    });

    return this.getTestMappings(tenantId, testId);
  }

  // ─── Document Integration ─────────────────────────────────────────────────

  /**
   * Resolves the effective PrintTemplate for a given tenant's LAB_REPORT generation.
   * Returns the default template if no test-specific mapping exists.
   * Returns null if no template is configured (falls back to legacy behavior).
   */
  async resolveReportTemplate(tenantId: string, testId?: string): Promise<{ templateCode: string; templateVersion: number; templateFamily: string } | null> {
    // Try test-specific default mapping first
    if (testId) {
      const mapping = await (this.prisma as any).testTemplateMap.findFirst({
        where: { tenantId, testId, isDefault: true, isEnabled: true },
        include: { template: true },
      });
      if (mapping?.template && mapping.template.status !== 'ARCHIVED') {
        return {
          templateCode: mapping.template.code,
          templateVersion: mapping.template.templateVersion,
          templateFamily: mapping.template.templateFamily,
        };
      }
    }

    // Fall back to any active GENERAL_TABLE template for this tenant
    const defaultTpl = await (this.prisma as any).printTemplate.findFirst({
      where: { tenantId, templateFamily: 'GENERAL_TABLE', status: 'ACTIVE' },
      orderBy: { templateVersion: 'desc' },
    });
    if (defaultTpl) {
      return {
        templateCode: defaultTpl.code,
        templateVersion: defaultTpl.templateVersion,
        templateFamily: defaultTpl.templateFamily,
      };
    }

    return null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateUniqueCode(tenantId: string, baseCode: string): Promise<string> {
    const sanitized = baseCode.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    let candidate = sanitized;
    let attempt = 1;
    while (true) {
      const existing = await (this.prisma as any).printTemplate.findFirst({
        where: { tenantId, code: candidate },
      });
      if (!existing) return candidate;
      attempt++;
      candidate = `${sanitized}_${attempt}`;
    }
  }

  private async assertCodeVersionAvailable(tenantId: string, code: string, version: number) {
    const existing = await (this.prisma as any).printTemplate.findFirst({
      where: { tenantId, code, templateVersion: version },
    });
    if (existing) {
      throw new ConflictException(`Template code '${code}' version ${version} already exists for this tenant`);
    }
  }

  resolveTemplateKey(templateFamily: string): string {
    // Renderer registry: maps TemplateFamily to PDF service template key
    const registry: Record<string, string> = {
      GENERAL_TABLE: 'lab_report_v2',
      TWO_COLUMN_TABLE: 'lab_report_v2', // shares renderer for now; config drives column layout
      PERIPHERAL_FILM_REPORT: 'lab_report_v2', // stub — uses general until specialized renderer added
      HISTOPATH_NARRATIVE: 'lab_report_v2',    // stub
      GRAPHICAL_SCALE_REPORT: 'lab_report_v2', // stub
      IMAGE_REPORT: 'lab_report_v2',           // stub
    };
    return registry[templateFamily] ?? 'lab_report_v2';
  }

  private buildSamplePayload(tpl: any, tenantConfig: any, tenant: any): Record<string, unknown> {
    return {
      reportNumber: 'PREVIEW-001',
      issuedAt: new Date().toISOString(),
      patientName: 'Sample Patient',
      patientMrn: 'MRN-001',
      patientAge: '35Y',
      patientDob: '1989-01-01',
      patientGender: 'Male',
      encounterId: 'preview-encounter',
      encounterCode: 'VXL-PREVIEW',
      reportStatus: 'Verified',
      reportHeaderLayout: tenantConfig?.reportHeaderLayout ?? 'default',
      templateCode: tpl.code,
      templateVersion: tpl.templateVersion,
      templateFamily: tpl.templateFamily,
      tests: [
        {
          testCode: 'GLU',
          testName: 'Glucose',
          department: 'Chemistry',
          parameters: [
            { parameterCode: 'GLU', parameterName: 'Glucose', value: '95', unit: 'mg/dL', referenceRange: '70-110', flag: 'N' },
          ],
        },
        {
          testCode: 'CBC',
          testName: 'Complete Blood Count',
          department: 'Hematology',
          parameters: [
            { parameterCode: 'WBC', parameterName: 'WBC', value: '7.5', unit: '10^9/L', referenceRange: '4-11', flag: 'N' },
            { parameterCode: 'RBC', parameterName: 'RBC', value: '4.5', unit: '10^12/L', referenceRange: '3.8-5.2', flag: 'N' },
            { parameterCode: 'HGB', parameterName: 'Hemoglobin', value: '13.5', unit: 'g/dL', referenceRange: '11.5-16', flag: 'N' },
          ],
        },
      ],
      verifiedBy: 'Dr. Sample',
      verifiedAt: new Date().toISOString(),
      tenantName: tenantConfig?.brandName ?? tenant?.name ?? 'Preview Lab',
    };
  }
}
