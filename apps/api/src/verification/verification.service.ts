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

  async getVerificationQueue(
    tenantId: string,
    filters: { search?: string; page?: number; limit?: number } = {},
  ): Promise<{ data: VerificationEncounterSummary[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const baseWhere: any = {
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
            where: { resultStatus: 'SUBMITTED', status: { not: 'verified' } },
            orderBy: { submittedAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.encounter.count({ where: baseWhere }),
    ]);

    const data: VerificationEncounterSummary[] = encounters.map((enc) => {
      const submittedOrders = enc.labOrders;
      const oldestSubmittedAt =
        submittedOrders.length > 0 ? (submittedOrders[0].submittedAt ?? null) : null;
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
          data: { verifiedAt: now, verifiedBy: actorId },
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

    await this.audit.log({
      tenantId,
      actorUserId: actorId,
      action: 'ENCOUNTER_VERIFIED',
      entityType: 'Encounter',
      entityId: encounterId,
      correlationId,
      after: { status: newEncounterStatus, verifiedBy: actorId },
    });

    return { encounterId, status: newEncounterStatus, documentJobId };
  }
}
