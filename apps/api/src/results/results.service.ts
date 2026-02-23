import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';

function computeFlag(value: string, referenceRange: string | null): string | null {
  if (!referenceRange || !value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  const rangeMatch = referenceRange.match(/^([\d.]+)-([\d.]+)$/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (num < low) return 'low';
    if (num > high) return 'high';
    return 'normal';
  }
  const gtMatch = referenceRange.match(/^>([\d.]+)$/);
  if (gtMatch && num <= parseFloat(gtMatch[1])) return 'low';
  const ltMatch = referenceRange.match(/^<([\d.]+)$/);
  if (ltMatch && num >= parseFloat(ltMatch[1])) return 'high';
  return 'normal';
}

const SPECIMEN_READY_STATUSES = [
  'specimen_collected',
  'specimen_received',
  'resulted',
  'partial_resulted',
  'verified',
];

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
  ) {}

  async getPendingTests(
    tenantId: string,
    filters: { search?: string; page?: number; limit?: number },
  ) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);
    const where: any = {
      tenantId,
      resultStatus: 'PENDING',
      encounter: { status: { in: ['specimen_collected', 'specimen_received', 'lab_ordered'] } },
    };
    if (filters.search) {
      const s = filters.search;
      where.OR = [
        { encounter: { patient: { mrn: { contains: s, mode: 'insensitive' } } } },
        { encounter: { patient: { firstName: { contains: s, mode: 'insensitive' } } } },
        { encounter: { patient: { lastName: { contains: s, mode: 'insensitive' } } } },
        { encounter: { encounterCode: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [orders, total] = await Promise.all([
      this.prisma.labOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          encounter: { include: { patient: true } },
          test: true,
          results: { select: { id: true, value: true } },
        },
      }),
      this.prisma.labOrder.count({ where }),
    ]);

    const data = await Promise.all(orders.map((o) => this.toOrderedTestSummary(o, tenantId)));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getSubmittedTests(
    tenantId: string,
    filters: { search?: string; fromDate?: string; page?: number; limit?: number },
  ) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);
    const where: any = { tenantId, resultStatus: 'SUBMITTED' };
    if (filters.fromDate) {
      where.submittedAt = { gte: new Date(filters.fromDate) };
    }
    if (filters.search) {
      const s = filters.search;
      where.OR = [
        { encounter: { patient: { mrn: { contains: s, mode: 'insensitive' } } } },
        { encounter: { patient: { firstName: { contains: s, mode: 'insensitive' } } } },
        { encounter: { patient: { lastName: { contains: s, mode: 'insensitive' } } } },
        { encounter: { encounterCode: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [orders, total] = await Promise.all([
      this.prisma.labOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          encounter: { include: { patient: true } },
          test: true,
          results: { select: { id: true, value: true } },
        },
      }),
      this.prisma.labOrder.count({ where }),
    ]);

    const data = await Promise.all(orders.map((o) => this.toOrderedTestSummary(o, tenantId)));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async toOrderedTestSummary(order: any, tenantId: string) {
    const totalCount = await this.prisma.testParameterMapping.count({
      where: { tenantId, testId: order.testId },
    });
    const filledCount = (order.results as any[]).filter(
      (r) => r.value && r.value.trim() !== '',
    ).length;
    return {
      id: order.id,
      encounterId: order.encounterId,
      encounterCode: order.encounter.encounterCode,
      testId: order.testId,
      testName: order.test?.name ?? order.testNameSnapshot,
      resultStatus: order.resultStatus,
      submittedAt: order.submittedAt,
      filledCount,
      totalCount,
      specimenStatus: order.encounter.status,
      createdAt: order.createdAt,
      patient: {
        id: order.encounter.patient.id,
        mrn: order.encounter.patient.mrn,
        firstName: order.encounter.patient.firstName,
        lastName: order.encounter.patient.lastName,
        dateOfBirth: order.encounter.patient.dateOfBirth,
        gender: order.encounter.patient.gender,
      },
    };
  }

  async getOrderedTestDetail(tenantId: string, orderedTestId: string) {
    const order = await this.prisma.labOrder.findFirst({
      where: { id: orderedTestId, tenantId },
      include: {
        encounter: { include: { patient: true } },
        test: true,
        results: true,
      },
    });
    if (!order) throw new NotFoundException('Ordered test not found');

    const parameterMappings = await this.prisma.testParameterMapping.findMany({
      where: { tenantId, testId: order.testId },
      include: { parameter: true },
      orderBy: { displayOrder: 'asc' },
    });

    const specimenReady = SPECIMEN_READY_STATUSES.includes(order.encounter.status);

    const parameters = (parameterMappings as any[]).map((m) => {
      const existing = (order.results as any[]).find((r) => r.parameterId === m.parameterId);
      const locked =
        order.resultStatus === 'SUBMITTED' && !!existing && existing.value !== '';
      return {
        parameterId: m.parameterId,
        name: m.parameter.name,
        unit: m.unitOverride ?? m.parameter.defaultUnit,
        dataType: m.parameter.resultType ?? m.parameter.dataType,
        allowedValues: m.parameter.allowedValues,
        referenceRange: existing?.referenceRange ?? null,
        value: existing?.value ?? null,
        flag: existing?.flag ?? null,
        locked,
        enteredAt: existing?.enteredAt ?? null,
        verifiedAt: existing?.verifiedAt ?? null,
      };
    });

    return {
      id: order.id,
      encounterId: order.encounterId,
      encounterCode: order.encounter.encounterCode,
      testId: order.testId,
      testName: order.test?.name ?? order.testNameSnapshot,
      resultStatus: order.resultStatus,
      submittedAt: order.submittedAt,
      specimenStatus: order.encounter.status,
      specimenReady,
      createdAt: order.createdAt,
      patient: {
        id: order.encounter.patient.id,
        mrn: order.encounter.patient.mrn,
        firstName: order.encounter.patient.firstName,
        lastName: order.encounter.patient.lastName,
        dateOfBirth: order.encounter.patient.dateOfBirth,
        gender: order.encounter.patient.gender,
      },
      parameters,
    };
  }

  async saveResults(
    tenantId: string,
    actorId: string,
    orderedTestId: string,
    values: Array<{ parameterId: string; value: string }>,
    correlationId?: string,
  ) {
    const order = await this.prisma.labOrder.findFirst({
      where: { id: orderedTestId, tenantId },
      include: { encounter: true },
    });
    if (!order) throw new NotFoundException('Ordered test not found');
    if (!SPECIMEN_READY_STATUSES.includes(order.encounter.status)) {
      throw new ForbiddenException('Sample not collected');
    }

    const now = new Date();
    for (const { parameterId, value } of values) {
      const existing = await this.prisma.labResult.findFirst({
        where: { labOrderId: orderedTestId, parameterId },
      });
      if (existing?.locked) continue;

      const param = await this.prisma.parameter.findFirst({
        where: { id: parameterId, tenantId },
      });
      const mapping = param
        ? await this.prisma.testParameterMapping.findUnique({
            where: {
              tenantId_testId_parameterId: {
                tenantId,
                testId: order.testId,
                parameterId,
              },
            },
          })
        : null;

      const effectiveUnit =
        (mapping as any)?.unitOverride ?? param?.defaultUnit ?? (param as any)?.unit ?? null;
      const referenceRange = existing?.referenceRange ?? null;
      const flag = computeFlag(value, referenceRange);

      const data = {
        tenantId,
        labOrderId: orderedTestId,
        parameterId,
        parameterNameSnapshot: param?.name ?? null,
        value,
        unit: effectiveUnit,
        referenceRange,
        flag,
        enteredAt: now,
        enteredById: actorId,
      };

      if (existing) {
        await this.prisma.labResult.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.labResult.create({ data });
      }
    }

    await this.audit.log({
      tenantId,
      actorUserId: actorId,
      action: 'TEST_RESULTS_SAVE',
      entityType: 'LabOrder',
      entityId: orderedTestId,
      after: { parameterCount: values.length },
      correlationId,
    });

    return this.getOrderedTestDetail(tenantId, orderedTestId);
  }

  async submitResults(
    tenantId: string,
    actorId: string,
    orderedTestId: string,
    correlationId?: string,
  ) {
    const order = await this.prisma.labOrder.findFirst({
      where: { id: orderedTestId, tenantId },
      include: { encounter: true },
    });
    if (!order) throw new NotFoundException('Ordered test not found');
    if (!SPECIMEN_READY_STATUSES.includes(order.encounter.status)) {
      throw new ForbiddenException('Sample not collected');
    }

    // Idempotent
    if (order.resultStatus === 'SUBMITTED') {
      return this.getOrderedTestDetail(tenantId, orderedTestId);
    }

    const now = new Date();
    await this.prisma.labOrder.update({
      where: { id: orderedTestId },
      data: { resultStatus: 'SUBMITTED', submittedAt: now, submittedById: actorId },
    });

    await this.prisma.labResult.updateMany({
      where: { labOrderId: orderedTestId, value: { not: '' } },
      data: { locked: true },
    });

    // Advance encounter status based on whether all orders are submitted
    const allOrders = await this.prisma.labOrder.findMany({
      where: { encounterId: order.encounterId, tenantId },
      select: { id: true, resultStatus: true },
    });
    const allSubmitted = allOrders.every(
      (o) => o.id === orderedTestId || o.resultStatus === 'SUBMITTED',
    );
    const newEncounterStatus = allSubmitted ? 'resulted' : 'partial_resulted';
    await this.prisma.encounter.update({
      where: { id: order.encounterId },
      data: { status: newEncounterStatus },
    });

    await this.audit.log({
      tenantId,
      actorUserId: actorId,
      action: 'TEST_RESULTS_SUBMIT',
      entityType: 'LabOrder',
      entityId: orderedTestId,
      after: { resultStatus: 'SUBMITTED', encounterStatus: newEncounterStatus },
      correlationId,
    });

    return this.getOrderedTestDetail(tenantId, orderedTestId);
  }

  async submitAndVerify(
    tenantId: string,
    actorId: string,
    orderedTestId: string,
    correlationId?: string,
  ) {
    const order = await this.prisma.labOrder.findFirst({
      where: { id: orderedTestId, tenantId },
      include: { encounter: true },
    });
    if (!order) throw new NotFoundException('Ordered test not found');
    if (!SPECIMEN_READY_STATUSES.includes(order.encounter.status)) {
      throw new ForbiddenException('Sample not collected');
    }

    const now = new Date();

    // Submit if not already submitted
    if (order.resultStatus !== 'SUBMITTED') {
      await this.prisma.labOrder.update({
        where: { id: orderedTestId },
        data: { resultStatus: 'SUBMITTED', submittedAt: now, submittedById: actorId },
      });
      await this.prisma.labResult.updateMany({
        where: { labOrderId: orderedTestId, value: { not: '' } },
        data: { locked: true },
      });
      await this.audit.log({
        tenantId,
        actorUserId: actorId,
        action: 'TEST_RESULTS_SUBMIT',
        entityType: 'LabOrder',
        entityId: orderedTestId,
        after: { resultStatus: 'SUBMITTED' },
        correlationId,
      });
    }

    // Mark results as verified
    await this.prisma.labResult.updateMany({
      where: { labOrderId: orderedTestId, value: { not: '' } },
      data: { verifiedAt: now, verifiedBy: actorId },
    });

    // Set encounter to verified
    await this.prisma.encounter.update({
      where: { id: order.encounterId },
      data: { status: 'verified' },
    });

    await this.audit.log({
      tenantId,
      actorUserId: actorId,
      action: 'TEST_RESULTS_VERIFY',
      entityType: 'LabOrder',
      entityId: orderedTestId,
      after: { verifiedBy: actorId, encounterId: order.encounterId },
      correlationId,
    });

    // Enqueue document generation (best-effort)
    let documentJobId: string | null = null;
    try {
      const result = await this.documents.generateFromEncounter(
        tenantId,
        order.encounterId,
        actorId,
        correlationId ?? '',
      );
      documentJobId = (result as any).document?.id ?? null;
    } catch (err) {
      console.error('[ResultsService] Failed to enqueue document generation:', err);
    }

    const orderedTest = await this.getOrderedTestDetail(tenantId, orderedTestId);
    return { orderedTest, documentJobId };
  }
}
