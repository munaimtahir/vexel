import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface WorklistFilters {
  status?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SampleCollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getWorklist(tenantId: string, filters: WorklistFilters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const status = filters.status ?? 'PENDING';

    const fromDate = filters.fromDate
      ? new Date(filters.fromDate)
      : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const toDate = filters.toDate ? new Date(filters.toDate) : undefined;

    // Build encounter where clause
    const encounterWhere: any = {
      tenantId,
      createdAt: { gte: fromDate },
      specimenItems: { some: { tenantId, status } },
    };
    if (toDate) encounterWhere.createdAt.lte = toDate;

    if (filters.search) {
      const s = filters.search;
      encounterWhere.OR = [
        { encounterCode: { contains: s, mode: 'insensitive' } },
        { patient: { mrn: { contains: s, mode: 'insensitive' } } },
        { patient: { firstName: { contains: s, mode: 'insensitive' } } },
        { patient: { lastName: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [encounters, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where: encounterWhere,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
              mobile: true,
              ageYears: true,
              gender: true,
            },
          },
          specimenItems: { where: { tenantId } },
          labOrders: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.encounter.count({ where: encounterWhere }),
    ]);

    const data = encounters.map((enc) => ({
      ...enc,
      pendingCount: enc.specimenItems.filter((s) => s.status === 'PENDING').length,
      totalCount: enc.specimenItems.length,
      testCount: enc.labOrders.length,
    }));

    return { data, total, page, limit };
  }

  async collectSpecimens(
    tenantId: string,
    actorId: string,
    encounterId: string,
    specimenItemIds: string[],
    correlationId?: string,
  ) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
      include: { specimenItems: { where: { tenantId } } },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');

    const targetIds =
      specimenItemIds.length > 0
        ? specimenItemIds
        : encounter.specimenItems.filter((s) => s.status === 'PENDING').map((s) => s.id);

    const now = new Date();
    await this.prisma.specimenItem.updateMany({
      where: { id: { in: targetIds }, tenantId, encounterId },
      data: { status: 'COLLECTED', collectedAt: now, collectedById: actorId },
    });

    // Advance encounter status if all items are no longer PENDING
    const remaining = await this.prisma.specimenItem.count({
      where: { encounterId, tenantId, status: 'PENDING' },
    });
    if (remaining === 0) {
      await this.prisma.encounter.update({
        where: { id: encounterId },
        data: { status: 'specimen_collected' },
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId: actorId,
      action: 'SPECIMEN_COLLECTED',
      entityType: 'SpecimenItem',
      entityId: encounterId,
      after: { specimenItemIds: targetIds },
      correlationId,
    });

    return this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
      include: { specimenItems: { where: { tenantId } } },
    });
  }

  async postponeSpecimen(
    tenantId: string,
    actorId: string,
    encounterId: string,
    specimenItemId: string,
    reason: string,
    correlationId?: string,
  ) {
    if (!reason || reason.length < 3) {
      throw new BadRequestException('Postpone reason must be at least 3 characters');
    }

    const item = await this.prisma.specimenItem.findFirst({
      where: { id: specimenItemId, encounterId, tenantId },
    });
    if (!item) throw new NotFoundException('SpecimenItem not found');

    const updated = await this.prisma.specimenItem.update({
      where: { id: specimenItemId },
      data: {
        status: 'POSTPONED',
        postponedAt: new Date(),
        postponedById: actorId,
        postponeReason: reason,
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId: actorId,
      action: 'SPECIMEN_POSTPONED',
      entityType: 'SpecimenItem',
      entityId: specimenItemId,
      after: { status: 'POSTPONED', reason },
      correlationId,
    });

    return updated;
  }

  async receiveSpecimens(
    tenantId: string,
    actorId: string,
    encounterId: string,
    specimenItemIds: string[],
    correlationId?: string,
  ) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
      include: { specimenItems: { where: { tenantId } } },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');

    const targetIds =
      specimenItemIds.length > 0
        ? specimenItemIds
        : encounter.specimenItems.filter((s) => s.status === 'COLLECTED').map((s) => s.id);

    const now = new Date();
    await this.prisma.specimenItem.updateMany({
      where: { id: { in: targetIds }, tenantId, encounterId },
      data: { status: 'RECEIVED', receivedAt: now, receivedById: actorId },
    });

    await this.audit.log({
      tenantId,
      actorUserId: actorId,
      action: 'SPECIMEN_RECEIVED',
      entityType: 'SpecimenItem',
      entityId: encounterId,
      after: { specimenItemIds: targetIds },
      correlationId,
    });

    return this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
      include: { specimenItems: { where: { tenantId } } },
    });
  }
}
