import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';

export interface VerificationEncounterSummary {
  encounterId: string;
  encounterCode: string | null;
  submittedTestsCount: number;
  oldestSubmittedAt: Date | null;
  createdAt: Date;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    ageYears: number | null;
    gender: string | null;
  };
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
  ) {}

  /** Derive the encounter roll-up from its active ordered tests inside a transaction. */
  private async refreshEncounterStatus(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    tenantId: string,
    encounterId: string,
  ): Promise<string> {
    const orders = await tx.labOrder.findMany({
      where: { tenantId, encounterId },
      select: { status: true, resultStatus: true },
    });
    const active = orders.filter((order) => order.status !== 'cancelled');
    let status = 'lab_ordered';

    if (active.length === 0) status = 'cancelled';
    else if (active.every((order) => order.status === 'verified')) status = 'verified';
    else if (active.some((order) => order.resultStatus === 'SUBMITTED')) {
      status = active.every((order) => order.resultStatus === 'SUBMITTED' || order.status === 'verified')
        ? 'resulted'
        : 'partial_resulted';
    } else if (active.some((order) => order.status === 'processing')) status = 'specimen_received';
    else if (active.some((order) => order.status === 'specimen_collected')) status = 'specimen_collected';

    await tx.encounter.update({ where: { id: encounterId }, data: { status } });
    return status;
  }

  async getVerificationQueue(
    tenantId: string,
    filters: { search?: string; page?: number; limit?: number; view?: 'pending' | 'verified_today' } = {},
  ): Promise<{ data: VerificationEncounterSummary[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const view = filters.view ?? 'pending';
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const baseWhere: any =
      view === 'verified_today'
        ? {
            tenantId,
            status: { in: ['verified', 'published'] },
            labOrders: {
              some: {
                status: 'verified',
                results: {
                  some: {
                    verifiedAt: { gte: todayStart, lt: tomorrowStart },
                  },
                },
              },
            },
          }
        : {
            tenantId,
            status: { not: 'cancelled' },
            labOrders: {
              some: {
                resultStatus: 'SUBMITTED',
                status: { not: 'verified' },
              },
            },
          };

    if (filters.search) {
      baseWhere.OR = [
        { encounterCode: { contains: filters.search, mode: 'insensitive' } },
        { patient: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [encounters, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where: baseWhere,
        include: {
          patient: true,
          labOrders: {
            where:
              view === 'verified_today'
                ? {
                    status: 'verified',
                    results: {
                      some: {
                        verifiedAt: { gte: todayStart, lt: tomorrowStart },
                      },
                    },
                  }
                : { resultStatus: 'SUBMITTED', status: { not: 'verified' } },
            include:
              view === 'verified_today'
                ? {
                    results: {
                      where: { verifiedAt: { gte: todayStart, lt: tomorrowStart } },
                      select: { verifiedAt: true },
                    },
                  }
                : undefined,
            orderBy: view === 'verified_today' ? { updatedAt: 'desc' } : { submittedAt: 'asc' },
          },
        },
        orderBy: view === 'verified_today' ? { updatedAt: 'desc' } : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.encounter.count({ where: baseWhere }),
    ]);

    const data: VerificationEncounterSummary[] = encounters.map((enc) => {
      const submittedOrders = enc.labOrders;
      const oldestSubmittedAt = view === 'verified_today'
        ? (() => {
            const verifiedTimes = submittedOrders
              .flatMap((order: any) => (order.results ?? []).map((r: any) => r.verifiedAt))
              .filter((d: Date | null | undefined): d is Date => !!d)
              .sort((a, b) => a.getTime() - b.getTime());
            return verifiedTimes[0] ?? null;
          })()
        : (submittedOrders.length > 0 ? (submittedOrders[0].submittedAt ?? null) : null);
      return {
        encounterId: enc.id,
        encounterCode: enc.encounterCode,
        submittedTestsCount: submittedOrders.length,
        oldestSubmittedAt,
        createdAt: enc.createdAt,
        patient: {
          id: enc.patient.id,
          mrn: enc.patient.mrn,
          firstName: enc.patient.firstName,
          lastName: enc.patient.lastName,
          ageYears: enc.patient.ageYears,
          gender: enc.patient.gender,
        },
      };
    });

    return { data, total, page, limit };
  }

  async getEncounterVerificationDetail(tenantId: string, encounterId: string) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
      include: { patient: true },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');

    const submittedOrders = await this.prisma.labOrder.findMany({
      where: { encounterId, tenantId, resultStatus: 'SUBMITTED' },
      include: {
        test: true,
        results: {
          where: { value: { not: '' } },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    const pendingVerificationCount = submittedOrders.filter(
      (o) => o.status !== 'verified',
    ).length;

    const testCards = submittedOrders.map((order) => ({
      labOrderId: order.id,
      testName: order.testNameSnapshot ?? (order as any).test?.name ?? 'Unknown',
      resultStatus: order.resultStatus,
      submittedAt: order.submittedAt,
      filledParameters: order.results.map((r) => ({
        parameterId: r.parameterId,
        name: r.parameterNameSnapshot ?? 'Result',
        value: r.value,
        unit: r.unit,
        referenceRange: r.referenceRange,
        flag: r.flag,
      })),
    }));

    return {
      encounter: {
        id: encounter.id,
        encounterCode: encounter.encounterCode,
        status: encounter.status,
        createdAt: encounter.createdAt,
      },
      patient: {
        id: encounter.patient.id,
        mrn: encounter.patient.mrn,
        firstName: encounter.patient.firstName,
        lastName: encounter.patient.lastName,
        ageYears: encounter.patient.ageYears,
        gender: encounter.patient.gender,
      },
      submittedTestsCount: submittedOrders.length,
      pendingVerificationCount,
      testCards,
    };
  }

  async verifyEncounter(
    tenantId: string,
    actorId: string,
    encounterId: string,
    correlationId?: string,
  ): Promise<{ encounterId: string; status: string; documentJobId: string | null }> {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');

    const pendingOrders = await this.prisma.labOrder.findMany({
      where: {
        encounterId,
        tenantId,
        resultStatus: 'SUBMITTED',
        status: { not: 'verified' },
      },
    });

    if (pendingOrders.length === 0) {
      throw new ConflictException('No submitted tests to verify');
    }

    const now = new Date();

    // Determine final encounter status: only 'verified' if no tests remain PENDING
    const stillPendingCount = await this.prisma.labOrder.count({
      where: { encounterId, tenantId, resultStatus: 'PENDING' },
    });
    const newEncounterStatus = stillPendingCount === 0 ? 'verified' : 'resulted';

    await this.prisma.$transaction(async (tx) => {
      for (const order of pendingOrders) {
        await tx.labResult.updateMany({
          where: { labOrderId: order.id, value: { not: '' } },
          data: { verifiedAt: now, verifiedBy: actorId, locked: true },
        });
        await tx.labOrder.update({
          where: { id: order.id },
          data: { status: 'verified' },
        });
      }
      await tx.encounter.update({
        where: { id: encounterId },
        data: { status: newEncounterStatus },
      });
      await this.audit.logInTransaction(tx, {
        tenantId,
        actorUserId: actorId,
        action: 'ENCOUNTER_VERIFIED',
        entityType: 'Encounter',
        entityId: encounterId,
        correlationId,
        after: { status: newEncounterStatus, verifiedBy: actorId },
      });
    });

    let documentJobId: string | null = null;
    try {
      const result = await this.documents.generateFromEncounter(
        tenantId,
        encounterId,
        actorId,
        correlationId ?? '',
      );
      documentJobId = (result as any).document?.id ?? null;
    } catch (err) {
      console.error(
        '[verification] Failed to enqueue document generation:',
        (err as Error).message,
      );
    }

    return { encounterId, status: newEncounterStatus, documentJobId };
  }

  /** Verify precisely one submitted test; other tests remain independently actionable. */
  async verifyOrderedTest(
    tenantId: string,
    actorId: string,
    orderedTestId: string,
    correlationId?: string,
  ): Promise<{ orderedTestId: string; encounterId: string; encounterStatus: string }> {
    const order = await this.prisma.labOrder.findFirst({
      where: { id: orderedTestId, tenantId },
      select: { id: true, encounterId: true, resultStatus: true, status: true },
    });
    if (!order) throw new NotFoundException('Ordered test not found');
    if (order.status === 'verified') throw new ConflictException('Test is already verified');
    if (order.status === 'cancelled') throw new ConflictException('Cancelled tests cannot be verified');
    if (order.resultStatus !== 'SUBMITTED') throw new ConflictException('Test results must be submitted before verification');

    const encounterStatus = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.labOrder.updateMany({
        where: { id: orderedTestId, tenantId, resultStatus: 'SUBMITTED', status: { notIn: ['verified', 'cancelled'] } },
        data: { status: 'verified' },
      });
      if (updated.count !== 1) throw new ConflictException('Test is no longer available for verification');
      await tx.labResult.updateMany({
        where: { tenantId, labOrderId: orderedTestId, value: { not: '' } },
        data: { verifiedAt: now, verifiedBy: actorId, locked: true },
      });
      const status = await this.refreshEncounterStatus(tx, tenantId, order.encounterId);
      await this.audit.logInTransaction(tx, {
        tenantId,
        actorUserId: actorId,
        action: 'TEST_VERIFIED',
        entityType: 'LabOrder',
        entityId: orderedTestId,
        correlationId,
        after: { status: 'verified', encounterStatus: status },
      });
      return status;
    });

    return { orderedTestId, encounterId: order.encounterId, encounterStatus };
  }

  /** Return precisely one submitted test to result entry without unlocking siblings. */
  async returnOrderedTestForCorrection(
    tenantId: string,
    actorId: string,
    orderedTestId: string,
    reason: string | undefined,
    correlationId?: string,
  ): Promise<{ orderedTestId: string; encounterId: string; encounterStatus: string }> {
    const order = await this.prisma.labOrder.findFirst({
      where: { id: orderedTestId, tenantId },
      select: { id: true, encounterId: true, resultStatus: true, status: true },
    });
    if (!order) throw new NotFoundException('Ordered test not found');
    if (order.status === 'verified') throw new ConflictException('Verified tests cannot be returned for correction');
    if (order.status === 'cancelled') throw new ConflictException('Cancelled tests cannot be returned for correction');
    if (order.resultStatus !== 'SUBMITTED') throw new ConflictException('Only submitted tests can be returned for correction');

    const encounterStatus = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.labOrder.updateMany({
        where: { id: orderedTestId, tenantId, resultStatus: 'SUBMITTED', status: { notIn: ['verified', 'cancelled'] } },
        data: { resultStatus: 'PENDING', submittedAt: null, submittedById: null, status: 'processing' },
      });
      if (updated.count !== 1) throw new ConflictException('Test is no longer available for correction');
      await tx.labResult.updateMany({
        where: { tenantId, labOrderId: orderedTestId, verifiedAt: null },
        data: { locked: false },
      });
      const status = await this.refreshEncounterStatus(tx, tenantId, order.encounterId);
      await this.audit.logInTransaction(tx, {
        tenantId,
        actorUserId: actorId,
        action: 'TEST_RETURNED_FOR_CORRECTION',
        entityType: 'LabOrder',
        entityId: orderedTestId,
        correlationId,
        after: { resultStatus: 'PENDING', encounterStatus: status, reason: reason?.trim() || null },
      });
      return status;
    });

    return { orderedTestId, encounterId: order.encounterId, encounterStatus };
  }

  async returnForCorrection(
    tenantId: string,
    actorId: string,
    encounterId: string,
    reason: string | undefined,
    correlationId?: string,
  ): Promise<{ encounterId: string; status: string; correctedTestsCount: number }> {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');

    const submittedOrders = await this.prisma.labOrder.findMany({
      where: {
        encounterId,
        tenantId,
        resultStatus: 'SUBMITTED',
        status: { not: 'verified' },
      },
      select: { id: true },
    });

    if (submittedOrders.length === 0) {
      throw new ConflictException('No submitted tests available for correction');
    }

    const submittedIds = submittedOrders.map((o) => o.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.labOrder.updateMany({
        where: { id: { in: submittedIds }, tenantId },
        data: {
          resultStatus: 'PENDING',
          submittedAt: null,
          submittedById: null,
        },
      });

      await tx.labResult.updateMany({
        where: { labOrderId: { in: submittedIds }, tenantId, verifiedAt: null },
        data: { locked: false },
      });

      await tx.encounter.update({
        where: { id: encounterId },
        data: { status: 'specimen_received' },
      });
      await this.audit.logInTransaction(tx, {
        tenantId,
        actorUserId: actorId,
        action: 'ENCOUNTER_RETURNED_FOR_CORRECTION',
        entityType: 'Encounter',
        entityId: encounterId,
        correlationId,
        after: {
          status: 'specimen_received',
          correctedTestsCount: submittedOrders.length,
          reason: reason?.trim() || null,
        },
      });
    });

    return {
      encounterId,
      status: 'specimen_received',
      correctedTestsCount: submittedOrders.length,
    };
  }
}
