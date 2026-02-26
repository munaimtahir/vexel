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

  async generateDocument(
    tenantId: string,
    type: 'RECEIPT' | 'LAB_REPORT' | 'OPD_INVOICE_RECEIPT',
    payload: Record<string, unknown>,
    sourceRef: string | undefined,
    sourceType: string | undefined,
    actorUserId: string,
    correlationId: string,
  ): Promise<{ document: any; created: boolean }> {
    // Check feature flag module.lims
    const limsFlag = await this.prisma.tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key: 'module.lims' } },
    });
    if (!limsFlag?.enabled) {
      throw new BadRequestException('module.lims feature flag is not enabled for this tenant');
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

    // Compute hash using canonical serialiser
    const hash = payloadHash(enrichedPayload);

    // Check idempotency
    const existing = await this.prisma.document.findUnique({
      where: { tenantId_type_payloadHash: { tenantId, type, payloadHash: hash } },
    });
    if (existing && existing.status !== 'FAILED') {
      return { document: existing, created: false };
    }

    // Create Document (status=DRAFT)
    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        type,
        templateId: template.id,
        payloadJson: enrichedPayload,
        payloadHash: hash,
        status: 'DRAFT',
        sourceRef,
        sourceType,
        createdBy: actorUserId,
      },
    });

    // Enqueue BullMQ job
    await this.renderQueue.add('render', {
      documentId: doc.id,
      tenantId,
      correlationId,
    });

    // Update status to RENDERING
    const updated = await this.prisma.document.update({
      where: { id: doc.id },
      data: { status: 'RENDERING' },
    });

    // Write AuditEvent
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'document.generate',
      entityType: 'Document',
      entityId: doc.id,
      correlationId,
      after: { type, status: 'RENDERING', payloadHash: hash },
    });

    return { document: updated, created: true };
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

  async downloadDocument(tenantId: string, id: string): Promise<{ url: string }> {
    const doc = await this.getDocument(tenantId, id);
    if (!(doc as any).storageKey) throw new NotFoundException('PDF not yet generated for this document');
    const url = await this.storage.getSignedDownloadUrl((doc as any).storageKey, 3600);
    return { url };
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
            test: true,
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

    // Idempotency: return existing non-failed document for this encounter
    const existingDoc = await this.prisma.document.findFirst({
      where: { tenantId, sourceRef: encounterId, sourceType: 'ENCOUNTER', type: 'LAB_REPORT', status: { not: 'FAILED' } },
      orderBy: { createdAt: 'desc' },
    });
    if (existingDoc) return { document: existingDoc, created: false };

    const tenantConfig = await this.prisma.tenantConfig.findUnique({ where: { tenantId } });

    // Compute patient age
    let patientAge: string | undefined;
    if (encounter.patient.dateOfBirth) {
      const years = Math.floor((Date.now() - encounter.patient.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000));
      patientAge = `${years}Y`;
    }

    // Get verifiedBy name — look for most recent verifier from audit
    let verifiedByName: string | undefined;
    let verifiedAt: string | undefined;
    const verifyAudit = await this.prisma.auditEvent.findFirst({
      where: { tenantId, entityId: encounterId, action: 'encounter.verify' },
      orderBy: { createdAt: 'desc' },
    });
    if (verifyAudit?.actorUserId) {
      const verifier = await this.prisma.user.findUnique({ where: { id: verifyAudit.actorUserId } });
      if (verifier) verifiedByName = `${verifier.firstName} ${verifier.lastName}`;
      verifiedAt = verifyAudit.createdAt.toISOString();
    }

    // Get sampleReceivedAt from first specimen collection
    const firstSpecimen = await this.prisma.specimenItem.findFirst({
      where: { tenantId, encounterId },
      orderBy: { createdAt: 'asc' },
    });

    // Use encounter's updatedAt as deterministic issuedAt
    const issuedAt = encounter.updatedAt.toISOString();
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
      printedAt: new Date().toISOString(),
      reportStatus: encounter.status === 'verified' ? 'Verified' : encounter.status === 'published' ? 'Verified' : 'Provisional',
      reportHeaderLayout: tenantConfig?.reportHeaderLayout ?? 'default',
      tests: encounter.labOrders.map((order) => {
        const testMeta = (order as any).test;
        // Build parameters from all LabResult rows for this order
        const allResults: any[] = (order as any).results ?? [];
        const parameters = allResults.length > 0
          ? allResults.map((r: any) => ({
              parameterCode: r.parameterId ?? 'result',
              parameterName: r.parameterNameSnapshot ?? 'Result',
              value: r.value,
              unit: r.unit ?? undefined,
              referenceRange: r.referenceRange ?? undefined,
              flag: r.flag ?? undefined,
            }))
          : [];
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
