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
    type: 'RECEIPT' | 'LAB_REPORT',
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
    const template = await this.prisma.documentTemplate.findFirst({
      where: { tenantId, type, isActive: true },
      orderBy: { version: 'desc' },
    });
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

  async downloadDocument(tenantId: string, id: string): Promise<Buffer> {
    const doc = await this.getDocument(tenantId, id);
    if (!(doc as any).storageKey) throw new NotFoundException('PDF not yet generated for this document');
    return this.storage.download((doc as any).storageKey);
  }

  async listDocuments(tenantId: string, filters: { status?: string; limit?: number; sourceRef?: string; sourceType?: string; encounterId?: string; docType?: string }) {
    const { status, sourceType, encounterId, docType } = filters;
    const limit = filters.limit !== undefined ? Number(filters.limit) : 20;
    const where: any = { tenantId };
    if (status) where.status = status;
    // Support encounterId as shorthand for sourceRef=encounterId + sourceType=ENCOUNTER
    const sourceRef = filters.sourceRef ?? (encounterId ? encounterId : undefined);
    if (sourceRef) where.sourceRef = sourceRef;
    if (encounterId && !filters.sourceType) where.sourceType = 'ENCOUNTER';
    else if (sourceType) where.sourceType = sourceType;
    if (docType) where.type = docType;
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
            results: true,
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

    // Use encounter's updatedAt as deterministic issuedAt
    const issuedAt = encounter.updatedAt.toISOString();
    const payload: LabReportPayload = {
      reportNumber: `RPT-${encounterId.slice(0, 8).toUpperCase()}`,
      issuedAt,
      patientName: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
      patientMrn: encounter.patient.mrn,
      patientDob: encounter.patient.dateOfBirth?.toISOString().split('T')[0],
      patientGender: encounter.patient.gender ?? undefined,
      encounterId,
      tests: encounter.labOrders.map((order) => ({
        testCode: (order as any).test?.code ?? order.id,
        testName: (order as any).test?.name ?? 'Unknown',
        parameters: (order as any).results?.[0] ? [{
          parameterCode: 'result',
          parameterName: 'Result',
          value: (order as any).results[0].value,
          unit: (order as any).results[0].unit ?? undefined,
          referenceRange: (order as any).results[0].referenceRange ?? undefined,
          flag: (order as any).results[0].flag ?? undefined,
        }] : [],
      })),
      tenantName: tenantConfig?.brandName ?? tenantId,
      tenantLogoUrl: tenantConfig?.logoUrl ?? undefined,
      reportHeader: tenantConfig?.reportHeader ?? undefined,
      reportFooter: tenantConfig?.reportFooter ?? undefined,
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
