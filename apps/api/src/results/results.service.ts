import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';

function allowedValues(value?: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed;
  } catch { /* legacy comma-separated values are handled below */ }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function computeFlag(value: string, range: any): string | null {
  if (!range || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (range.criticalLow != null && num < range.criticalLow) return 'critical';
  if (range.criticalHigh != null && num > range.criticalHigh) return 'critical';
  if (range.lowValue != null && num < range.lowValue) return 'low';
  if (range.highValue != null && num > range.highValue) return 'high';
  return range.lowValue != null || range.highValue != null ? 'normal' : null;
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

  private formatReferenceRange(row: any): string | null {
    if (!row) return null;
    if (row.referenceText) return row.referenceText;
    if (row.lowValue != null && row.highValue != null) return `${row.lowValue}-${row.highValue}`;
    if (row.lowValue != null) return `>${row.lowValue}`;
    if (row.highValue != null) return `<${row.highValue}`;
    return null;
  }

  private async resolveReferenceRange(
    tenantId: string,
    testId: string,
    parameterId: string,
    patientGender?: string | null,
    patientDob?: Date | null,
  ): Promise<any> {
    const res = await this.resolveReferenceRanges(
      tenantId,
      testId,
      [parameterId],
      patientGender,
      patientDob,
    );
    return res.get(parameterId) ?? { referenceRange: null, unit: null };
  }

  private async resolveReferenceRanges(
    tenantId: string,
    testId: string,
    parameterIds: string[],
    patientGender?: string | null,
    patientDob?: Date | null,
  ): Promise<Map<string, any>> {
    const ageYears = patientDob
      ? Math.floor((Date.now() - new Date(patientDob).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;

    const allCandidates = await this.prisma.referenceRange.findMany({
      where: {
        tenantId,
        parameterId: { in: parameterIds },
        OR: [{ testId }, { testId: null }],
      },
      orderBy: [{ testId: 'desc' }, { ageMinYears: 'desc' }, { createdAt: 'asc' }],
    });

    const results = new Map<string, any>();

    // Group candidates by parameterId
    const candidatesByParam = new Map<string, any[]>();
    for (const cand of allCandidates) {
      if (!candidatesByParam.has(cand.parameterId)) {
        candidatesByParam.set(cand.parameterId, []);
      }
      candidatesByParam.get(cand.parameterId)!.push(cand);
    }

    for (const parameterId of parameterIds) {
      const candidates = candidatesByParam.get(parameterId) ?? [];
      let found = false;
      for (const row of candidates) {
        if (row.gender && patientGender && row.gender !== patientGender) continue;
        if (row.gender && !patientGender) continue;
        if (ageYears != null) {
          if (row.ageMinYears != null && ageYears < row.ageMinYears) continue;
          if (row.ageMaxYears != null && ageYears > row.ageMaxYears) continue;
        }
        results.set(parameterId, {
          referenceRange: this.formatReferenceRange(row),
          unit: row.unit ?? null,
          lowValue: row.lowValue,
          highValue: row.highValue,
          criticalLow: row.criticalLow,
          criticalHigh: row.criticalHigh,
        });
        found = true;
        break;
      }
      if (!found) {
        results.set(parameterId, { referenceRange: null, unit: null });
      }
    }

    return results;
  }

  private validateValue(param: any, value: string, defaultConfirmed?: boolean) {
    const type = param?.resultType ?? param?.dataType ?? 'numeric';
    if (param?.defaultRequiresConfirmation && value === param.defaultValue && !defaultConfirmed) {
      throw new BadRequestException(`Confirm or change the pre-filled value for ${param.name}`);
    }
    if (type === 'numeric') {
      if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new BadRequestException(`${param.name} must be a number`);
      const places = value.includes('.') ? value.split('.')[1].length : 0;
      if (param.decimals != null && places > param.decimals) {
        throw new BadRequestException(`${param.name} allows at most ${param.decimals} decimal places`);
      }
      return;
    }
    if (type === 'boolean' && !['true', 'false'].includes(value.toLowerCase())) {
      throw new BadRequestException(`${param.name} must be Yes or No`);
    }
    if (type === 'enum') {
      const choices = allowedValues(param.allowedValues) ?? [];
      if (!choices.includes(value)) throw new BadRequestException(`${param.name} must use one of its configured choices`);
    }
    if (type === 'date' && Number.isNaN(Date.parse(value))) throw new BadRequestException(`${param.name} must be a date`);
  }

  private evaluateFormula(node: any, values: Map<string, string>): number | null {
    if (!node) return null;
    if (node.type === 'parameter') {
      const value = Number(values.get(node.parameterId));
      return Number.isFinite(value) ? value : null;
    }
    if (node.type === 'number') return Number.isFinite(Number(node.value)) ? Number(node.value) : null;
    if (node.type !== 'operator') return null;
    const left = this.evaluateFormula(node.left, values);
    const right = this.evaluateFormula(node.right, values);
    if (left == null || right == null) return null;
    if (node.operator === '+') return left + right;
    if (node.operator === '-') return left - right;
    if (node.operator === '*') return left * right;
    if (node.operator === '/' && right !== 0) return left / right;
    return null;
  }

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
      labOrderStatus: order.status,
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

    const parameterIds = (parameterMappings as any[]).map((m) => m.parameterId);
    const resolvedRanges = await this.resolveReferenceRanges(
      tenantId,
      order.testId,
      parameterIds,
      order.encounter?.patient?.gender ?? null,
      order.encounter?.patient?.dateOfBirth ?? null,
    );

    const parameters = (parameterMappings as any[]).map((m) => {
      const existing = (order.results as any[]).find((r) => r.parameterId === m.parameterId);
      const locked = !!existing?.verifiedAt || !!existing?.locked;
      const resolvedRange = resolvedRanges.get(m.parameterId) ?? {
        referenceRange: null,
        unit: null,
      };
      return {
        parameterId: m.parameterId,
        name: m.parameter.name,
        unit: existing?.unit ?? m.unitOverride ?? resolvedRange.unit ?? m.parameter.defaultUnit,
        dataType: m.parameter.resultType ?? m.parameter.dataType ?? 'numeric',
        allowedValues: allowedValues(m.parameter.allowedValues),
        decimals: m.parameter.decimals ?? null,
        defaultValue: m.parameter.defaultValue ?? null,
        defaultRequiresConfirmation: m.parameter.defaultRequiresConfirmation,
        isRequired: m.parameter.isRequired,
        allowComment: m.parameter.allowComment,
        commentRequired: m.parameter.commentRequired,
        printFlag: m.parameter.printFlag,
        formulaJson: m.parameter.formulaJson ?? null,
        referenceRange: existing?.referenceRange ?? resolvedRange.referenceRange,
        value: existing?.value ?? null,
        flag: existing?.flag ?? null,
        omitted: existing?.omitted ?? false,
        comment: existing?.comment ?? null,
        source: existing?.source ?? 'manual',
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
    values: Array<{ parameterId: string; value?: string; omitted?: boolean; comment?: string; defaultConfirmed?: boolean }>,
    correlationId?: string,
  ) {
    const order = await this.prisma.labOrder.findFirst({
      where: { id: orderedTestId, tenantId },
      include: { encounter: { include: { patient: true } } },
    });
    if (!order) throw new NotFoundException('Ordered test not found');
    if (!SPECIMEN_READY_STATUSES.includes(order.encounter.status)) {
      throw new ForbiddenException('Sample not collected');
    }

    const now = new Date();
    const allMappings = await this.prisma.testParameterMapping.findMany({
      where: { tenantId, testId: order.testId }, include: { parameter: true }, orderBy: { displayOrder: 'asc' },
    });
    const supplied = new Map(values.map((value) => [value.parameterId, value]));
    for (const id of supplied.keys()) {
      if (!allMappings.some((mapping) => mapping.parameterId === id)) {
        throw new BadRequestException('A submitted parameter does not belong to this test');
      }
    }
    const parameterIds = allMappings.map((mapping) => mapping.parameterId);

    const [existingResults, params, mappings, resolvedRanges] = await Promise.all([
      this.prisma.labResult.findMany({
        where: { labOrderId: orderedTestId, parameterId: { in: parameterIds } },
      }),
      this.prisma.parameter.findMany({
        where: { id: { in: parameterIds }, tenantId },
      }),
      Promise.resolve(allMappings),
      this.resolveReferenceRanges(
        tenantId,
        order.testId,
        parameterIds,
        order.encounter?.patient?.gender ?? null,
        order.encounter?.patient?.dateOfBirth ?? null,
      ),
    ]);

    const existingMap = new Map(existingResults.map((r) => [r.parameterId, r]));
    const paramMap = new Map(params.map((p) => [p.id, p]));
    const mappingMap = new Map(mappings.map((m) => [m.parameterId, m]));

    const upserts: Array<{ existingId?: string; data: any }> = [];

    for (const mapping of allMappings as any[]) {
      const parameterId = mapping.parameterId;
      const submitted = supplied.get(parameterId);
      const existing = existingMap.get(parameterId);
      if (existing?.locked) continue;

      const param = paramMap.get(parameterId);
      const mapped = mappingMap.get(parameterId);
      const value = submitted?.value ?? '';
      const omitted = submitted?.omitted === true || value.trim() === '' || value.trim() === '*';

      if (param?.resultType === 'formula' || param?.resultType === 'heading') continue;
      if (!omitted) this.validateValue(param, value, submitted?.defaultConfirmed);

      const effectiveUnit =
        (mapped as any)?.unitOverride ?? param?.defaultUnit ?? (param as any)?.unit ?? null;
      const resolvedRange = resolvedRanges.get(parameterId) ?? {
        referenceRange: null,
        unit: null,
      };

      const referenceRange = existing?.referenceRange ?? resolvedRange.referenceRange;
      const unit = effectiveUnit ?? resolvedRange.unit;
      const flag = omitted ? null : computeFlag(value, resolvedRange);

      const data = {
        tenantId,
        labOrderId: orderedTestId,
        parameterId,
        parameterNameSnapshot: param?.name ?? null,
        value: omitted ? '' : value,
        unit,
        referenceRange,
        flag,
        omitted,
        omittedAt: omitted ? now : null,
        omittedById: omitted ? actorId : null,
        source: 'manual',
        comment: submitted?.comment?.trim() || null,
        enteredAt: now,
        enteredById: actorId,
      };

      if (existing) {
        upserts.push({ existingId: (existing as any).id, data });
      } else {
        upserts.push({ data });
      }
    }

    // Formula Parameters are never accepted from the browser. They are computed
    // from this test's manual values and saved with a traceable input snapshot.
    const formulaInputs = new Map<string, string>();
    for (const mapping of allMappings as any[]) {
      const submitted = supplied.get(mapping.parameterId);
      const existing = existingMap.get(mapping.parameterId);
      const value = submitted?.value ?? existing?.value ?? '';
      const omitted = submitted ? (submitted.omitted === true || !value || value === '*') : existing?.omitted;
      if (value && value !== '*' && !omitted) formulaInputs.set(mapping.parameterId, value);
    }
    for (const mapping of allMappings as any[]) {
      const param: any = mapping.parameter;
      if (param.resultType !== 'formula') continue;
      const existing = existingMap.get(mapping.parameterId);
      let definition: any = null;
      try { definition = param.formulaJson ? JSON.parse(param.formulaJson) : null; } catch { /* invalid definitions are omitted safely */ }
      const calculated = this.evaluateFormula(definition?.expression, formulaInputs);
      const omitted = calculated == null;
      const value = omitted ? '' : (param.decimals != null ? calculated.toFixed(param.decimals) : String(calculated));
      const range = resolvedRanges.get(mapping.parameterId) ?? {};
      const data = {
        tenantId, labOrderId: orderedTestId, parameterId: mapping.parameterId,
        parameterNameSnapshot: param.name, value, unit: mapping.unitOverride ?? param.defaultUnit ?? range.unit ?? null,
        referenceRange: range.referenceRange ?? null, flag: omitted ? null : computeFlag(value, range),
        omitted, omittedAt: omitted ? now : null, omittedById: omitted ? actorId : null,
        source: 'formula', sourcePayloadJson: JSON.stringify({ version: param.formulaVersion, definition, inputs: Object.fromEntries(formulaInputs) }),
        enteredAt: now, enteredById: actorId,
      };
      if (existing) upserts.push({ existingId: (existing as any).id, data });
      else upserts.push({ data });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const upsert of upserts) {
        if (upsert.existingId) await tx.labResult.update({ where: { id: upsert.existingId }, data: upsert.data });
        else await tx.labResult.create({ data: upsert.data });
      }
      await this.audit.logInTransaction(tx, {
        tenantId,
        actorUserId: actorId,
        action: 'TEST_RESULTS_SAVE',
        entityType: 'LabOrder',
        entityId: orderedTestId,
        after: { parameterCount: allMappings.length },
        correlationId,
      });
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

    const [mappings, savedResults] = await Promise.all([
      this.prisma.testParameterMapping.findMany({ where: { tenantId, testId: order.testId }, include: { parameter: true } }),
      this.prisma.labResult.findMany({ where: { tenantId, labOrderId: orderedTestId } }),
    ]);
    const savedByParameter = new Map(savedResults.map((result) => [result.parameterId, result]));
    for (const mapping of mappings as any[]) {
      if (!savedByParameter.get(mapping.parameterId) && mapping.parameter.isRequired) {
        throw new ConflictException('Save results before submitting this test');
      }
    }
    if (!savedResults.some((result) => !result.omitted && result.value.trim() !== '')) {
      throw new ConflictException('A test with every parameter omitted cannot be submitted');
    }

    // Idempotent
    if (order.resultStatus === 'SUBMITTED') {
      return this.getOrderedTestDetail(tenantId, orderedTestId);
    }

    const now = new Date();
    const newEncounterStatus = await this.prisma.$transaction(async (tx) => {
      await tx.labOrder.update({
        where: { id: orderedTestId },
        data: { resultStatus: 'SUBMITTED', submittedAt: now, submittedById: actorId },
      });
      await tx.labResult.updateMany({
        where: { labOrderId: orderedTestId, value: { not: '' }, omitted: false },
        data: { locked: true },
      });
      const allOrders = await tx.labOrder.findMany({
        where: { encounterId: order.encounterId, tenantId },
        select: { id: true, resultStatus: true, status: true },
      });
      const activeOrders = allOrders.filter((o) => o.status !== 'cancelled');
      const status = activeOrders.every((o) => o.id === orderedTestId || o.resultStatus === 'SUBMITTED')
        ? 'resulted'
        : 'partial_resulted';
      await tx.encounter.update({ where: { id: order.encounterId }, data: { status } });
      await this.audit.logInTransaction(tx, {
        tenantId,
        actorUserId: actorId,
        action: 'TEST_RESULTS_SUBMIT',
        entityType: 'LabOrder',
        entityId: orderedTestId,
        after: { resultStatus: 'SUBMITTED', encounterStatus: status },
        correlationId,
      });
      return status;
    });

    return this.getOrderedTestDetail(tenantId, orderedTestId);
  }
}
