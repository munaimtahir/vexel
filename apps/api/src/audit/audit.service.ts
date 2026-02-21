import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEventInput {
  tenantId: string;
  actorUserId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditListFilters {
  tenantId?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  correlationId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(event: AuditEventInput): Promise<void> {
    try {
      await this.prisma.auditEvent.create({ data: event });
    } catch (err) {
      // Never let audit failure crash the main flow
      console.error('[AuditService] Failed to write audit event:', err);
    }
  }

  async list(filters: AuditListFilters) {
    const {
      tenantId, actorUserId, entityType, entityId,
      action, correlationId, from, to,
      page = 1, limit = 20,
    } = filters;

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (actorUserId) where.actorUserId = actorUserId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (correlationId) where.correlationId = correlationId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
