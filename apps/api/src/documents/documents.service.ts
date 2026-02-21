import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
  ) {
    this.renderQueue = new Queue(DOCUMENT_RENDER_QUEUE, {
      connection: getRedisConnection(),
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

  async downloadDocument(tenantId: string, id: string) {
    const doc = await this.getDocument(tenantId, id);
    // Full signed URL is Phase 6 — return placeholder
    return {
      documentId: doc.id,
      pdfHash: doc.pdfHash,
      message: 'download not yet implemented — coming in Phase 6',
    };
  }

  async listDocuments(tenantId: string, filters: { status?: string; limit?: number }) {
    const { status, limit = 20 } = filters;
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
