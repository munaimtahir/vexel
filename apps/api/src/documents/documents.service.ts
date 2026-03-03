import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { LabReportPayload } from './canonical';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { payloadHash, canonicalJson } from './canonical';

const DOCUMENT_RENDER_QUEUE = 'document-render';

function getRedisConnection() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new IORedis(url, { maxRetriesPerRequest: null });
}

@Injectable()
export class DocumentsService {
  private readonly renderQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {
    this.renderQueue = new Queue(DOCUMENT_RENDER_QUEUE, {
      connection: getRedisConnection() as any,
    });
  }

  private computeAgeAt(dateOfBirth: Date | null | undefined, anchor: Date): string | undefined {
    if (!dateOfBirth) return undefined;
    let years = anchor.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const beforeBirthday =
      anchor.getUTCMonth() < dateOfBirth.getUTCMonth() ||
      (anchor.getUTCMonth() === dateOfBirth.getUTCMonth() &&
        anchor.getUTCDate() < dateOfBirth.getUTCDate());
    if (beforeBirthday) years -= 1;
    return `${Math.max(0, years)}Y`;
  }

  private computeAgeDisplay(
    dateOfBirth: Date | null | undefined,
    ageYears: number | null | undefined,
    anchor: Date,
  ): string {
    const computed = this.computeAgeAt(dateOfBirth, anchor);
    if (computed) return computed;
    if (typeof ageYears === 'number' && Number.isFinite(ageYears)) return `${Math.max(0, ageYears)}Y`;
    return '';
  }

  private buildPatientDisplayName(firstName?: string | null, lastName?: string | null): string {
    const first = (firstName ?? '').trim();
    const last = (lastName ?? '').trim();
    if (first && last && first.toLowerCase() === last.toLowerCase()) {
      return first;
    }
    return [first, last].filter(Boolean).join(' ').trim();
  }

  private async normalizeDeterministicFields(
    type: 'RECEIPT' | 'LAB_REPORT' | 'OPD_INVOICE_RECEIPT',
    payload: Record<string, unknown>,
    tenantId: string,
    sourceType?: string,
    sourceRef?: string,
  ): Promise<Record<string, unknown>> {
    const normalized: Record<string, unknown> = { ...payload };

    if (type === 'LAB_REPORT') {
      delete normalized.printedAt;
    }

    const normalizedSourceType = (sourceType ?? '').trim().toUpperCase();
    if (normalizedSourceType !== 'ENCOUNTER' || !sourceRef) {
      return normalized;
    }

    const encounter = await this.prisma.encounter.findFirst({
      where: { id: sourceRef, tenantId },
      include: {
        patient: true,
        labOrders: {
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        },
      },
    });
    if (!encounter) {
      return normalized;
    }

    if (type === 'RECEIPT') {
      normalized.issuedAt = encounter.createdAt.toISOString();
      const displayName =
        this.buildPatientDisplayName(encounter.patient.firstName, encounter.patient.lastName) || 'N/A';
      const ageDisplay = this.computeAgeDisplay(
        encounter.patient.dateOfBirth,
        encounter.patient.ageYears,
        encounter.createdAt,
      );
      const gender = (encounter.patient.gender ?? '').trim();
      const mrn = (encounter.patient.mrn ?? '').trim();
      const mobile = (encounter.patient.mobile ?? '').trim();
      const labOrderCode =
        (normalized.labOrderCode as string | undefined) ??
        (normalized.primaryOrderCode as string | undefined) ??
        encounter.labOrders?.[0]?.id;
      normalized.patientDemographics = {
        displayName,
        ageDisplay,
        gender: gender || undefined,
        mrn: mrn || undefined,
        mobile: mobile || undefined,
      };
      // Backward-compatible keys for existing PDF templates.
      normalized.patientName = displayName;
      normalized.patientMrn = mrn || undefined;
      normalized.patientAge = ageDisplay || undefined;
      normalized.patientGender = gender || undefined;
      normalized.encounterCode =
        (normalized.encounterCode as string | undefined) ?? encounter.encounterCode ?? undefined;
      normalized.labOrderCode = labOrderCode ?? undefined;
      return normalized;
    }

    if (type === 'LAB_REPORT') {
      const verifyAudit = await this.prisma.auditEvent.findFirst({
        where: {
          tenantId,
          entityId: sourceRef,
          OR: [{ action: 'encounter.verify' }, { action: 'ENCOUNTER_VERIFIED' }],
        },
        orderBy: { createdAt: 'desc' },
      });
      const issuedAtAnchor = verifyAudit?.createdAt ?? encounter.createdAt;
      normalized.issuedAt = issuedAtAnchor.toISOString();
      const patientAge = this.computeAgeAt(encounter.patient.dateOfBirth, encounter.createdAt);
      if (patientAge) {
        normalized.patientAge = patientAge;
      }
    }

    return normalized;
  }

  async generateDocument(
    tenantId: string,
    type: 'RECEIPT' | 'LAB_REPORT' | 'OPD_INVOICE_RECEIPT',
    payload: Record<string, unknown>,
    sourceRef: string | undefined,
    sourceType: string | undefined,
    actorUserId: string,
    correlationId: string,
  ): Promise<{ document: any; created: boolean }> {
    const moduleKey = type === 'OPD_INVOICE_RECEIPT' ? 'module.opd' : 'module.lims';
    const moduleFlag = await this.prisma.tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key: moduleKey } },
    });
    if (!moduleFlag?.enabled) {
      throw new BadRequestException(`${moduleKey} feature flag is not enabled for this tenant`);
    }

    // Fetch active DocumentTemplate for tenant + type
    const template =
      (await this.prisma.documentTemplate.findFirst({
        where: { tenantId, type, isActive: true },
        orderBy: { version: 'desc' },
      })) ??
      (await this.prisma.documentTemplate.findFirst({
        where: { tenantId: 'system', type, isActive: true },
        orderBy: { version: 'desc' },
      }));
    if (!template) {
      throw new NotFoundException(`No active DocumentTemplate found for type ${type}`);
    }

    // Inject branding from TenantConfig
    const tenantConfig = await this.prisma.tenantConfig.findUnique({ where: { tenantId } });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const enrichedPayload = {
      ...payload,
      tenantName: tenantConfig?.brandName ?? tenant?.name ?? tenantId,
      tenantLogoUrl: tenantConfig?.logoUrl ?? undefined,
      reportHeader: tenantConfig?.reportHeader ?? undefined,
      reportFooter: tenantConfig?.reportFooter ?? undefined,
    };
    const normalizedPayload = await this.normalizeDeterministicFields(
      type,
      enrichedPayload,
      tenantId,
      sourceType,
      sourceRef,
    );

    // Compute hash using canonical serialiser
    const jsonPayload = JSON.parse(JSON.stringify(normalizedPayload));
    const hash = payloadHash(jsonPayload);

    // Check idempotency
    const existing = await this.prisma.document.findUnique({
      where: {
        tenantId_type_templateId_payloadHash: {
          tenantId,
          type,
          templateId: template.id,
          payloadHash: hash,
        },
      },
    });
    if (existing && existing.status !== 'FAILED') {
      return { document: existing, created: false };
    }

    const doc =
      existing && existing.status === 'FAILED'
        ? await this.prisma.document.update({
            where: { id: existing.id },
            data: {
              templateId: template.id,
              payloadJson: jsonPayload,
              status: 'RENDERING',
              sourceRef,
              sourceType,
              errorMessage: null,
              pdfHash: null,
              storageKey: null,
              publishedAt: null,
            },
          })
        : await this.prisma.document.create({
            data: {
              tenantId,
              type,
              templateId: template.id,
              payloadJson: jsonPayload,
              payloadHash: hash,
              status: 'RENDERING',
              sourceRef,
              sourceType,
              createdBy: actorUserId,
            },
          });

    // Enqueue BullMQ job (status already RENDERING — no race with worker)
    await this.renderQueue.add(
      'render',
      { documentId: doc.id, tenantId, correlationId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    // Write AuditEvent
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'document.generate',
      entityType: 'Document',
      entityId: doc.id,
      correlationId,
      after: { type, status: 'RENDERING', payloadHash: hash, templateId: template.id },
    });

    return { document: doc, created: true };
  }

  async publishDocument(
    tenantId: string,
    id: string,
    actorUserId: string,
    correlationId: string,
  ) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.tenantId !== tenantId) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    // Idempotent: already published
    if (doc.status === 'PUBLISHED') {
      return doc;
    }

    if (doc.status !== 'RENDERED') {
      throw new ConflictException(
        `Document ${id} cannot be published — current status: ${doc.status}`,
      );
    }

    const published = await this.prisma.document.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'document.publish',
      entityType: 'Document',
      entityId: id,
      correlationId,
      after: { status: 'PUBLISHED' },
    });

    return published;
  }

  async getDocument(tenantId: string, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.tenantId !== tenantId) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return doc;
  }

  async downloadDocument(tenantId: string, id: string): Promise<Buffer> {
    const doc = await this.getDocument(tenantId, id);
    if (!(doc as any).storageKey) throw new NotFoundException('PDF not yet generated for this document');
    return this.storage.download((doc as any).storageKey);
  }

  /**
   * Re-renders a document on-the-fly with an optional format override
   * (e.g. format='thermal' overrides the tenant's default receiptLayout).
   * Returns raw PDF bytes.
   */
  async renderWithFormatOverride(tenantId: string, id: string, format?: string): Promise<Buffer> {
    const doc = await this.getDocument(tenantId, id);
    if (!(doc as any).payloadJson) throw new NotFoundException('Document has no stored payload');

    const tenantConfig = await this.prisma.tenantConfig.findUnique({ where: { tenantId } });
    const branding: Record<string, unknown> = { ...(tenantConfig ?? {}) };
    if (format && doc.type === 'RECEIPT') {
      branding['receiptLayout'] = format;
    }

    const template = await this.prisma.documentTemplate.findUnique({
      where: { id: (doc as any).templateId },
    });

    const renderBody = JSON.stringify({
      templateKey: template?.templateKey ?? 'receipt_v1',
      payloadJson: (doc as any).payloadJson,
      brandingConfig: branding,
    });

    const pdfServiceUrl = process.env.PDF_SERVICE_URL ?? 'http://pdf:8080';
    const response = await fetch(`${pdfServiceUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: renderBody,
    });
    if (!response.ok) {
      throw new Error(`PDF service error: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async listDocuments(tenantId: string, filters: { status?: string; limit?: number; sourceRef?: string; sourceType?: string; encounterId?: string; docType?: string; fromDate?: string; toDate?: string }) {
    const { status, sourceType, encounterId, docType, fromDate, toDate } = filters;
    const limit = filters.limit !== undefined ? Number(filters.limit) : 50;
    const where: any = { tenantId };
    if (status) where.status = status;
    // Support encounterId as shorthand for sourceRef=encounterId + sourceType=ENCOUNTER
    const sourceRef = filters.sourceRef ?? (encounterId ? encounterId : undefined);
    if (sourceRef) where.sourceRef = sourceRef;
    if (encounterId && !filters.sourceType) where.sourceType = 'ENCOUNTER';
    else if (sourceType) where.sourceType = sourceType;
    if (docType) where.type = docType;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }
    return this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async generateFromEncounter(
    tenantId: string,
    encounterId: string,
    actorUserId: string,
    correlationId: string,
  ) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
      include: {
        patient: true,
        labOrders: {
          include: {
            test: { include: { parameterMappings: true } },
            results: { orderBy: { enteredAt: 'asc' } },
            specimen: true,
          },
        },
      },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');
    if (!['verified', 'published'].includes(encounter.status)) {
      throw new ConflictException('Encounter must be verified before generating report');
    }

    const tenantConfig = await this.prisma.tenantConfig.findUnique({ where: { tenantId } });

    // Compute patient age
    const patientAge = this.computeAgeAt(encounter.patient.dateOfBirth, encounter.createdAt);

    // Get verifiedBy name — look for most recent verifier from audit
    let verifiedByName: string | undefined;
    let verifiedAt: string | undefined;
    const verifyAudit = await this.prisma.auditEvent.findFirst({
        where: { tenantId, entityId: encounterId, action: 'encounter.verify' },
        orderBy: { createdAt: 'desc' },
      });
    if (verifyAudit?.actorUserId) {
      const verifier = await this.prisma.user.findFirst({
        where: { id: verifyAudit.actorUserId, tenantId },
      });
      if (verifier) verifiedByName = `${verifier.firstName} ${verifier.lastName}`;
      verifiedAt = verifyAudit.createdAt.toISOString();
    }

    // Get sampleReceivedAt from first specimen collection
    const firstSpecimen = await this.prisma.specimenItem.findFirst({
      where: { tenantId, encounterId },
      orderBy: { createdAt: 'asc' },
    });

    const issuedAt = (verifyAudit?.createdAt ?? encounter.createdAt).toISOString();
    const payload: LabReportPayload = {
      reportNumber: `RPT-${encounterId.slice(0, 8).toUpperCase()}`,
      issuedAt,
      patientName: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
      patientMrn: encounter.patient.mrn,
      patientAge,
      patientDob: encounter.patient.dateOfBirth?.toISOString().split('T')[0],
      patientGender: encounter.patient.gender ?? undefined,
      encounterId,
      encounterCode: (encounter as any).encounterCode ?? undefined,
      orderedBy: undefined,
      sampleReceivedAt: (firstSpecimen as any)?.collectedAt?.toISOString() ?? firstSpecimen?.createdAt?.toISOString(),
      reportStatus: encounter.status === 'verified' ? 'Verified' : encounter.status === 'published' ? 'Verified' : 'Provisional',
      reportHeaderLayout: (tenantConfig as any)?.reportHeaderLayout ?? 'default',
      tests: [...encounter.labOrders]
        // Deterministic test ordering: by test name (stable)
        .sort((a, b) => {
          const an = (a as any).test?.name ?? '';
          const bn = (b as any).test?.name ?? '';
          return an.localeCompare(bn);
        })
        .map((order) => {
          const testMeta = (order as any).test;
          // Build lookup for displayOrder from TestParameterMapping
          const mappings: any[] = testMeta?.parameterMappings ?? [];
          const getMappingOrder = (parameterId: string | null): number => {
            if (!parameterId) return 999;
            const m = mappings.find((m: any) => m.parameterId === parameterId);
            return m?.displayOrder ?? m?.ordering ?? 999;
          };
          // Sort results deterministically: by displayOrder, then parameterNameSnapshot
          const sortedResults = [...((order as any).results ?? [])].sort((a, b) => {
            const aOrd = getMappingOrder(a.parameterId);
            const bOrd = getMappingOrder(b.parameterId);
            if (aOrd !== bOrd) return aOrd - bOrd;
            return (a.parameterNameSnapshot ?? '').localeCompare(b.parameterNameSnapshot ?? '');
          });
          const parameters = sortedResults.map((r: any) => ({
            parameterCode: r.parameterId ?? 'result',
            parameterName: r.parameterNameSnapshot ?? 'Result',
            value: r.value,
            unit: r.unit ?? undefined,
            referenceRange: r.referenceRange ?? undefined,
            flag: r.flag ?? undefined,
          }));
          return {
            testCode: testMeta?.userCode ?? testMeta?.externalId ?? order.id,
            testName: testMeta?.name ?? 'Unknown',
            department: testMeta?.department ?? undefined,
            printAlone: testMeta?.printAlone ?? false,
            parameters,
          };
        }),
      verifiedBy: verifiedByName,
      verifiedAt,
      tenantName: tenantConfig?.brandName ?? tenantId,
      tenantLogoUrl: tenantConfig?.logoUrl ?? undefined,
      reportHeader: tenantConfig?.reportHeader ?? undefined,
      reportFooter: tenantConfig?.reportFooter ?? undefined,
      reportFooterImageUrl: (tenantConfig as any)?.reportFooterImageUrl ?? undefined,
    };

    return this.generateDocument(
      tenantId,
      'LAB_REPORT',
      payload as unknown as Record<string, unknown>,
      encounterId,
      'ENCOUNTER',
      actorUserId,
      correlationId,
    );
  }
}
