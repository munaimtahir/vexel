import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { assertOpdTransition } from './opd-workflow';

function parseBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new ConflictException(`Invalid time format '${value}', expected HH:mm`);
  }
  return h * 60 + m;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function buildCode(prefix: string, seq: number): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${prefix}-${yy}${mm}${dd}-${String(seq).padStart(3, '0')}`;
}

const APPOINTMENT_TERMINAL = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
const VISIT_TERMINAL = ['COMPLETED', 'CANCELLED'];

@Injectable()
export class OpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
  ) {}

  private async assertOpdEnabled(tenantId: string) {
    const flag = await (this.prisma as any).tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key: 'module.opd' } },
    });
    if (!flag?.enabled) {
      throw new ForbiddenException('module.opd feature is disabled for this tenant');
    }
  }

  private mapInvoice(inv: any) {
    return {
      id: inv.id,
      tenantId: inv.tenantId,
      patientId: inv.patientId,
      encounterId: inv.encounterId ?? null,
      visitId: null,
      appointmentId: null,
      invoiceCode: inv.invoiceCode ?? null,
      status: inv.status,
      currency: inv.currency,
      subtotalAmount: Number(inv.subtotalAmount),
      discountAmount: Number(inv.discountAmount),
      grandTotal: Number(inv.totalAmount),
      amountPaid: Number(inv.amountPaid),
      balanceDue: Number(inv.amountDue),
      issuedAt: inv.issuedAt ?? null,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      lines: (inv.lines ?? []).map((l: any) => ({
        id: l.id,
        sortOrder: l.sortOrder,
        lineType: l.lineType,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountAmount: Number(l.discountAmount),
        lineTotal: Number(l.lineTotal),
      })),
    };
  }

  private mapPayment(p: any) {
    return {
      id: p.id,
      tenantId: p.tenantId,
      invoiceId: p.invoiceId,
      paymentCode: p.paymentCode ?? null,
      status: p.status,
      method: p.method,
      amount: Number(p.amount),
      receivedAt: p.receivedAt,
      receivedById: p.receivedById ?? null,
      referenceNo: p.referenceNo ?? null,
      notes: p.notes ?? null,
    };
  }

  private async assertOpdFeatureEnabled(tenantId: string, key: string) {
    const flag = await (this.prisma as any).tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!flag?.enabled) {
      throw new ForbiddenException(`${key} feature is disabled for this tenant`);
    }
  }

  private mapKmvpDoctor(d: any) {
    return {
      id: d.id,
      tenantId: d.tenantId,
      userId: d.userId ?? null,
      code: d.code,
      displayName: d.displayName,
      specialtyName: d.specialtyName,
      consultationFee: Number(d.consultationFee),
      currency: d.currency,
      isActive: d.isActive,
      sortOrder: d.sortOrder,
      designation: d.designation ?? null,
      degrees: d.degrees ?? null,
      pmdcNumber: d.pmdcNumber ?? null,
      phcNumber: d.phcNumber ?? null,
      clinicName: d.clinicName ?? null,
      clinicAddress: d.clinicAddress ?? null,
      clinicPhone: d.clinicPhone ?? null,
      signatureLabel: d.signatureLabel ?? null,
      signatureUrl: d.signatureUrl ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  private mapKmvpEncounter(e: any) {
    return {
      id: e.id,
      tenantId: e.tenantId,
      patientId: e.patientId,
      encounterId: e.encounterId,
      doctorId: e.doctorId,
      status: e.status,
      visitCode: e.visitCode,
      chiefComplaint: e.chiefComplaint ?? null,
      diagnosis: e.diagnosis ?? null,
      advice: e.advice ?? null,
      followUp: e.followUp ?? null,
      investigations: e.investigations ?? null,
      remarks: e.remarks ?? null,
      paymentStatus: e.paymentStatus ?? null,
      cancelledAt: e.cancelledAt ?? null,
      cancelledReason: e.cancelledReason ?? null,
      completedAt: e.completedAt ?? null,
      createdAt: e.createdAt,
      publishedAt: e.publishedAt ?? null,
      updatedAt: e.updatedAt,
    };
  }

  private async withCommandIdempotency<T>(
    tenantId: string,
    commandName: string,
    idempotencyKey: string | undefined,
    requestJson: Record<string, unknown>,
    executor: () => Promise<T>,
  ): Promise<T> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      return executor();
    }
    const key = idempotencyKey.trim();
    // Serialize replays for the same tenant/command/key before executing the
    // side effect. A unique constraint alone is insufficient: two requests
    // can both perform the clinical write before the second insert loses.
    return (this.prisma as any).$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${commandName}:${key}`}, 0))`;
      const existing = await tx.opdCommandLog.findFirst({
        where: { tenantId, commandName, idempotencyKey: key },
      });
      if (existing?.responseJson != null) {
        return existing.responseJson as T;
      }
      const result = await executor();
      try {
        await tx.opdCommandLog.create({
          data: {
            tenantId,
            commandName,
            idempotencyKey: key,
            requestJson,
            responseJson: result as any,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const deduped = await tx.opdCommandLog.findFirst({
          where: { tenantId, commandName, idempotencyKey: key },
          });
          if (deduped?.responseJson != null) return deduped.responseJson as T;
        }
        throw err;
      }
      return result;
    });
  }

  /**
   * Allocates a tenant-local number without the count()+1 race. The update
   * is atomic in PostgreSQL; the first allocated value is 1.
   */
  private async nextTenantSequence(tenantId: string, key: string, client: any = this.prisma): Promise<number> {
    const row = await client.tenantSequence.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, nextValue: 2 },
      update: { nextValue: { increment: 1 } },
    });
    return row.nextValue - 1;
  }

  // ─── Billing / Invoices ───────────────────────────────────────────────────

  async listInvoices(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const search = typeof q?.search === 'string' ? q.search.trim() : '';
    const where: any = { tenantId };
    if (q?.status) where.status = q.status;
    if (q?.patientId) where.patientId = q.patientId;
    if (search) {
      where.OR = [{ invoiceCode: { contains: search, mode: 'insensitive' } }];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      }),
      (this.prisma as any).invoice.count({ where }),
    ]);
    return {
      data: data.map((inv: any) => this.mapInvoice(inv)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createInvoice(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!Array.isArray(body?.lines) || body.lines.length === 0) {
      throw new BadRequestException('At least one invoice line is required');
    }
    const patient = await (this.prisma as any).patient.findFirst({
      where: { id: body.patientId, tenantId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    if (body.encounterId) {
      const encounter = await (this.prisma as any).encounter.findFirst({
        where: { id: body.encounterId, tenantId, patientId: body.patientId, moduleType: 'OPD' },
      });
      if (!encounter) throw new NotFoundException('OPD encounter not found');
    }

    const lines: any[] = body.lines.map((l: any, idx: number) => ({
      tenantId,
      sortOrder: idx + 1,
      lineType: l.lineType ?? 'SERVICE',
      description: l.description,
      quantity: Number(l.quantity ?? 1),
      unitPrice: Number(l.unitPrice),
      discountAmount: Number(l.discountAmount ?? 0),
      lineTotal: Number(l.quantity ?? 1) * Number(l.unitPrice) - Number(l.discountAmount ?? 0),
    }));

    for (const line of lines) {
      if (!line.description?.trim() || !Number.isFinite(line.quantity) || line.quantity <= 0) {
        throw new BadRequestException('Invoice line description and positive quantity are required');
      }
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0 || !Number.isFinite(line.discountAmount) || line.discountAmount < 0) {
        throw new BadRequestException('Invoice line amounts must be valid non-negative numbers');
      }
      if (line.lineTotal < 0) throw new BadRequestException('Invoice line discount cannot exceed its gross amount');
    }

    const subtotalAmount = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
    const discountAmount = lines.reduce((acc, l) => acc + Number(l.discountAmount), 0);
    const totalAmount = subtotalAmount - discountAmount;
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      throw new BadRequestException('Invoice total cannot be negative');
    }

    const seq = await this.nextTenantSequence(tenantId, 'OPD_INVOICE');
    const invoiceCode = buildCode('INV', seq);

    const invoice = await (this.prisma as any).invoice.create({
      data: {
        tenantId,
        patientId: body.patientId,
        encounterId: body.encounterId ?? null,
        invoiceCode,
        status: 'DRAFT',
        currency: body.currency ?? 'PKR',
        subtotalAmount,
        discountAmount,
        totalAmount,
        amountPaid: 0,
        amountDue: totalAmount,
        createdById: actorUserId,
        lines: { create: lines },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.invoice.create',
      entityType: 'Invoice',
      entityId: invoice.id,
      after: body,
      correlationId,
    });
    return this.mapInvoice(invoice);
  }

  async getInvoice(tenantId: string, invoiceId: string) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return this.mapInvoice(inv);
  }

  async listInvoicePayments(tenantId: string, invoiceId: string) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    const data = await (this.prisma as any).payment.findMany({
      where: { invoiceId, tenantId },
      orderBy: { receivedAt: 'desc' },
    });
    return { data: data.map((p: any) => this.mapPayment(p)) };
  }

  async issueInvoice(
    tenantId: string,
    invoiceId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status !== 'DRAFT') {
      throw new ConflictException(`Invoice cannot be issued from status ${inv.status}`);
    }
    const updated = await (this.prisma as any).invoice.update({
      where: { id: invoiceId },
      data: { status: 'ISSUED', issuedAt: new Date() },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.invoice.issue',
      entityType: 'Invoice',
      entityId: invoiceId,
      correlationId,
    });
    return this.mapInvoice(updated);
  }

  async voidInvoice(
    tenantId: string,
    invoiceId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const { invoice } = await (this.prisma as any).$transaction(async (tx: any) => {
      const locked = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId } });
      if (!locked) throw new NotFoundException('Invoice not found');
      await tx.$queryRaw`SELECT id FROM "invoices" WHERE id = ${invoiceId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      if (locked.status === 'VOID') {
        throw new ConflictException('Invoice is already void');
      }
      if (Number(locked.amountPaid) > 0) {
        throw new ConflictException('Cannot void an invoice that has payments recorded. Issue a refund instead.');
      }
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'VOID',
          amountDue: 0,
          voidedAt: new Date(),
          voidReason: body?.reason ?? null,
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } }
      });
      return { invoice: updated };
    });

    await this.audit.log({
      tenantId, actorUserId, action: 'opd.invoice.void', entityType: 'Invoice', entityId: invoiceId,
      after: { id: invoiceId, status: 'VOID', reason: body?.reason ?? null }, correlationId
    });
    return this.mapInvoice(invoice);
  }

  async recordPayment(
    tenantId: string,
    invoiceId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new ConflictException('Payment amount must be positive');
    const { invoice, payment } = await (this.prisma as any).$transaction(async (tx: any) => {
      // Lock the invoice row so concurrent cash-desk payments cannot both
      // calculate a balance from the same stale amountPaid value.
      const locked = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId } });
      if (!locked) throw new NotFoundException('Invoice not found');
      await tx.$queryRaw`SELECT id FROM "invoices" WHERE id = ${invoiceId} AND "tenantId" = ${tenantId} FOR UPDATE`;
      if (!['ISSUED', 'PARTIALLY_PAID'].includes(locked.status)) {
        throw new ConflictException(`Cannot record payment for invoice in status ${locked.status}`);
      }
      const newAmountPaid = Number(locked.amountPaid) + amount;
      const newAmountDue = Number(locked.totalAmount) - newAmountPaid;
      if (newAmountDue < 0) throw new ConflictException('Payment exceeds invoice balance');
      const seq = await this.nextTenantSequence(tenantId, 'OPD_PAYMENT', tx);
      const createdPayment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId,
          paymentCode: buildCode('PAY', seq),
          status: 'POSTED',
          method: body.method,
          amount,
          receivedAt: new Date(),
          receivedById: actorUserId,
          referenceNo: body.referenceNo ?? null,
          note: body.notes ?? null,
          correlationId: correlationId ?? null,
        },
      });
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newAmountDue === 0 ? 'PAID' : 'PARTIALLY_PAID',
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
      return { invoice: updatedInvoice, payment: createdPayment };
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.payment.record',
      entityType: 'Payment',
      entityId: payment.id,
      after: body,
      correlationId,
    });
    return { invoice: this.mapInvoice(invoice), payment: this.mapPayment(payment) };
  }

  async generateReceipt(
    tenantId: string,
    invoiceId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (!['ISSUED', 'PARTIALLY_PAID', 'PAID'].includes(inv.status)) {
      throw new ConflictException('Invoice must be issued or paid before receipt generation');
    }
    const encounter = await (this.prisma as any).opdEncounter.findFirst({
      where: { tenantId, encounterId: inv.encounterId },
    });
    if (!encounter) throw new NotFoundException('OPD encounter for invoice not found');
    const generated = await this.generateEncounterReceipt(
      tenantId,
      // Document identity is payload-based. Do not pin command idempotency to
      // the invoice forever: a later valid payment must produce a new receipt
      // payload/hash while same-payload retries still deduplicate.
      { opdEncounterId: encounter.id },
      actorUserId,
      correlationId,
    );
    const invoice = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    const document = await this.documents.getDocument(tenantId, generated.documentId);
    return { invoice: this.mapInvoice(invoice), document };
  }

  async getSettings(tenantId: string) {
    await this.assertOpdEnabled(tenantId);
    let settings = await (this.prisma as any).opdSettings.findUnique({ where: { tenantId } });
    if (!settings) {
      settings = await (this.prisma as any).opdSettings.create({
        data: { tenantId, refundMaxLimitPct: 100, queueRule: 'CHECK_IN_TIME', retentionYears: 3 }
      });
    }
    return settings;
  }

  async updateSettings(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    let settings = await (this.prisma as any).opdSettings.findUnique({ where: { tenantId } });
    if (!settings) {
      settings = await (this.prisma as any).opdSettings.create({
        data: { tenantId, refundMaxLimitPct: 100, queueRule: 'CHECK_IN_TIME', retentionYears: 3 }
      });
    }
    const refundMaxLimitPct = body.refundMaxLimitPct !== undefined ? Number(body.refundMaxLimitPct) : settings.refundMaxLimitPct;
    const queueRule = body.queueRule !== undefined ? String(body.queueRule) : settings.queueRule;
    const retentionYears = body.retentionYears !== undefined ? Number(body.retentionYears) : settings.retentionYears;
    
    if (refundMaxLimitPct < 0 || refundMaxLimitPct > 100) {
      throw new BadRequestException('refundMaxLimitPct must be between 0 and 100');
    }
    if (retentionYears < 3) {
      throw new BadRequestException('retentionYears must be at least 3 years');
    }

    const updated = await (this.prisma as any).opdSettings.update({
      where: { tenantId },
      data: { refundMaxLimitPct, queueRule, retentionYears }
    });

    await this.audit.log({
      tenantId, actorUserId, action: 'opd.settings.updated', entityType: 'OpdSettings', entityId: settings.id,
      before: settings, after: updated, correlationId
    });
    return updated;
  }

  async refundInvoice(tenantId: string, invoiceId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    const refundAmount = Number(body.amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }

    const settings = await this.getSettings(tenantId);

    const { invoice, payment } = await (this.prisma as any).$transaction(async (tx: any) => {
      const locked = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId } });
      if (!locked) throw new NotFoundException('Invoice not found');
      await tx.$queryRaw`SELECT id FROM "invoices" WHERE id = ${invoiceId} AND "tenantId" = ${tenantId} FOR UPDATE`;

      if (locked.status === 'VOID') {
        throw new ConflictException('Cannot refund a void invoice');
      }

      const maxAllowed = (Number(locked.totalAmount) * settings.refundMaxLimitPct) / 100;
      const existingRefunds = await tx.payment.findMany({
        where: { tenantId, invoiceId, status: 'REFUNDED' }
      });
      const totalRefundedSoFar = existingRefunds.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      
      if (totalRefundedSoFar + refundAmount > maxAllowed) {
        throw new ConflictException(`Total refund exceeds maximum allowed limit of ${settings.refundMaxLimitPct}% (${maxAllowed})`);
      }

      if (totalRefundedSoFar + refundAmount > Number(locked.amountPaid)) {
        throw new ConflictException('Cannot refund more than the total amount paid');
      }

      const seq = await this.nextTenantSequence(tenantId, 'OPD_PAYMENT', tx);
      const createdPayment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId,
          paymentCode: buildCode('REF', seq),
          status: 'REFUNDED',
          method: body.method ?? 'CASH',
          amount: refundAmount,
          receivedAt: new Date(),
          receivedById: actorUserId,
          referenceNo: body.referenceNo ?? null,
          note: body.notes ?? 'Refund issued',
          correlationId: correlationId ?? null,
        }
      });

      const newAmountPaid = Number(locked.amountPaid) - refundAmount;
      const newAmountDue = Number(locked.totalAmount) - newAmountPaid;

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newAmountPaid === 0 ? 'ISSUED' : 'PARTIALLY_PAID',
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } }
      });

      return { invoice: updatedInvoice, payment: createdPayment };
    });

    await this.audit.log({
      tenantId, actorUserId, action: 'opd.invoice.refund', entityType: 'Payment', entityId: payment.id,
      after: body, correlationId
    });

    return { invoice: this.mapInvoice(invoice), payment: this.mapPayment(payment) };
  }

  // ─── OPD KMVP Doctor Master ───────────────────────────────────────────────

  private mapCanonicalSchedule(schedule: any) {
    return {
      id: schedule.id,
      tenantId: schedule.tenantId,
      doctorId: schedule.doctorId,
      weekday: schedule.weekday,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      slotMinutes: schedule.slotMinutes,
      timezone: schedule.timezone,
      effectiveFrom: schedule.effectiveFrom,
      effectiveTo: schedule.effectiveTo,
      isActive: schedule.isActive,
    };
  }

  private mapCanonicalAppointment(appointment: any) {
    return {
      id: appointment.id,
      tenantId: appointment.tenantId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentCode: appointment.appointmentCode,
      scheduledAt: appointment.scheduledAt,
      timezone: appointment.timezone,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
      reason: appointment.reason,
      checkedInAt: appointment.checkedInAt,
      consultationStartedAt: appointment.consultationStartedAt,
      completedAt: appointment.completedAt,
      cancelledAt: appointment.cancelledAt,
      cancelledReason: appointment.cancelledReason,
      noShowMarkedAt: appointment.noShowMarkedAt,
    };
  }

  async listCanonicalSchedules(tenantId: string, doctorId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const doctor = await (this.prisma as any).opdDoctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!doctor) throw new NotFoundException('OPD doctor not found');
    const where: any = { tenantId, doctorId };
    const active = parseBool(q?.isActive);
    if (active !== undefined) where.isActive = active;
    const schedules = await (this.prisma as any).opdSchedule.findMany({
      where, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    return { data: schedules.map((schedule: any) => this.mapCanonicalSchedule(schedule)) };
  }

  async createCanonicalSchedule(tenantId: string, doctorId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    const doctor = await (this.prisma as any).opdDoctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!doctor) throw new NotFoundException('OPD doctor not found');
    const weekday = Number(body?.weekday);
    const slotMinutes = Number(body?.slotMinutes ?? 15);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new BadRequestException('weekday must be 0-6');
    if (!Number.isInteger(slotMinutes) || slotMinutes <= 0 || slotMinutes > 1440) throw new BadRequestException('slotMinutes is invalid');
    const start = timeToMinutes(String(body?.startTime ?? ''));
    const end = timeToMinutes(String(body?.endTime ?? ''));
    if (start >= end) throw new BadRequestException('Schedule endTime must be after startTime');
    const existing = await (this.prisma as any).opdSchedule.findMany({ where: { tenantId, doctorId, weekday, isActive: true } });
    if (existing.some((s: any) => overlaps(start, end, timeToMinutes(s.startTime), timeToMinutes(s.endTime)))) {
      throw new ConflictException('Overlapping canonical doctor schedule');
    }
    try {
      const schedule = await (this.prisma as any).opdSchedule.create({
        data: { tenantId, doctorId, weekday, startTime: body.startTime, endTime: body.endTime, slotMinutes, timezone: body.timezone ?? 'Asia/Karachi', isActive: body.isActive ?? true },
      });
      await this.audit.log({ tenantId, actorUserId, action: 'opd.schedule.created', entityType: 'OpdSchedule', entityId: schedule.id, after: this.mapCanonicalSchedule(schedule), correlationId });
      return this.mapCanonicalSchedule(schedule);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Canonical schedule already exists');
      throw err;
    }
  }

  async getDoctorSlots(tenantId: string, doctorId: string, dateStr: string) {
    await this.assertOpdEnabled(tenantId);
    const doctor = await (this.prisma as any).opdDoctor.findFirst({ where: { id: doctorId, tenantId, isActive: true } });
    if (!doctor) throw new NotFoundException('OPD doctor not found');

    const getWeekdayInTz = (dStr: string, timeZone: string): number => {
      const d = new Date(`${dStr}T12:00:00Z`);
      const formatterShort = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
      const dayName = formatterShort.format(d);
      const mapping: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
      };
      return mapping[dayName];
    };

    const getUtcDateInTz = (dStr: string, timeStr: string, timeZone: string): Date => {
      const tempStr = `${dStr}T${timeStr}:00Z`;
      const date = new Date(tempStr);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const map: Record<string, string> = {};
      for (const p of parts) map[p.type] = p.value;
      const localizedUtc = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
        Number(map.second)
      );
      const diffMs = localizedUtc - date.getTime();
      return new Date(date.getTime() - diffMs);
    };

    const allSchedules = await (this.prisma as any).opdSchedule.findMany({
      where: { tenantId, doctorId, isActive: true }
    });

    const schedules = allSchedules.filter((s: any) => {
      const tz = s.timezone ?? 'Asia/Karachi';
      return s.weekday === getWeekdayInTz(dateStr, tz);
    });

    const slots: { startTime: string; endTime: string; isBooked: boolean }[] = [];

    for (const s of schedules) {
      const tz = s.timezone ?? 'Asia/Karachi';
      const dayStart = getUtcDateInTz(dateStr, '00:00', tz);
      const dayEnd = getUtcDateInTz(dateStr, '23:59', tz);
      
      const bookedAppts = await (this.prisma as any).opdAppointment.findMany({
        where: {
          tenantId,
          doctorId,
          status: { in: ['BOOKED', 'CHECKED_IN', 'IN_CONSULTATION'] },
          scheduledAt: { gte: dayStart, lte: dayEnd }
        }
      });

      let current = getUtcDateInTz(dateStr, s.startTime, tz);
      const limit = getUtcDateInTz(dateStr, s.endTime, tz);

      while (current.getTime() + s.slotMinutes * 60000 <= limit.getTime()) {
        const next = new Date(current.getTime() + s.slotMinutes * 60000);
        const isBooked = bookedAppts.some((appt: any) => {
          const apptStart = new Date(appt.scheduledAt).getTime();
          const apptEnd = apptStart + Number(appt.durationMinutes) * 60000;
          return overlaps(current.getTime(), next.getTime(), apptStart, apptEnd);
        });
        slots.push({
          startTime: current.toISOString(),
          endTime: next.toISOString(),
          isBooked
        });
        current = next;
      }
    }

    return { data: slots };
  }

  async listEncounterQueue(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Math.max(1, Number(q?.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 20)));

    const settings = await (this.prisma as any).opdSettings.findUnique({
      where: { tenantId }
    });
    const sortBy = settings?.queueRule === 'CHECK_IN_TIME' ? 'checkedInAt' : 'createdAt';

    const where: any = {
      tenantId,
      status: { notIn: ['COMPLETED', 'CANCELLED'] }
    };
    if (q?.doctorId) where.doctorId = q.doctorId;

    const [data, total] = await Promise.all([
      (this.prisma as any).opdEncounter.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { [sortBy]: 'asc' },
          { createdAt: 'asc' }
        ],
        include: {
          patient: true,
          doctor: true,
          appointment: true
        }
      }),
      (this.prisma as any).opdEncounter.count({ where })
    ]);

    return {
      data: data.map((e: any) => ({
        ...this.mapKmvpEncounter(e),
        patient: {
          id: e.patient.id,
          firstName: e.patient.firstName,
          lastName: e.patient.lastName,
          mrn: e.patient.mrn,
        },
        doctor: this.mapKmvpDoctor(e.doctor),
        appointment: e.appointment ? this.mapCanonicalAppointment(e.appointment) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  async listCanonicalAppointments(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Math.max(1, Number(q?.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 20)));
    const where: any = { tenantId };
    if (q?.doctorId) where.doctorId = q.doctorId;
    if (q?.patientId) where.patientId = q.patientId;
    if (q?.status) where.status = q.status;
    if (q?.fromDate || q?.toDate) {
      where.scheduledAt = {};
      if (q.fromDate) where.scheduledAt.gte = new Date(`${q.fromDate}T00:00:00.000Z`);
      if (q.toDate) where.scheduledAt.lte = new Date(`${q.toDate}T23:59:59.999Z`);
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).opdAppointment.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { scheduledAt: 'asc' } }),
      (this.prisma as any).opdAppointment.count({ where }),
    ]);
    return { data: data.map((a: any) => this.mapCanonicalAppointment(a)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async createCanonicalAppointment(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.patientId || !body?.doctorId || !body?.scheduledAt) {
      throw new BadRequestException('patientId, doctorId, and scheduledAt are required');
    }
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('scheduledAt must be a valid date-time');
    const durationMinutes = Number(body.durationMinutes ?? 15);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
      throw new BadRequestException('durationMinutes must be between 1 and 1440');
    }
    return this.withCommandIdempotency(tenantId, 'CreateOpdAppointment', body?.idempotencyKey, body, async () => {
      const appointment = await (this.prisma as any).$transaction(async (tx: any) => {
        const [patient, doctor] = await Promise.all([
          tx.patient.findFirst({ where: { id: body.patientId, tenantId } }),
          tx.opdDoctor.findFirst({ where: { id: body.doctorId, tenantId, isActive: true } }),
        ]);
        if (!patient) throw new NotFoundException('Patient not found');
        if (!doctor) throw new NotFoundException('OPD doctor not found');
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:opd-doctor:${body.doctorId}`}, 0))`;
        const endAt = new Date(scheduledAt.getTime() + durationMinutes * 60000);
        const conflicts = await tx.opdAppointment.findMany({
          where: { tenantId, doctorId: body.doctorId, status: { in: ['BOOKED', 'CHECKED_IN', 'IN_CONSULTATION'] }, scheduledAt: { lt: endAt } },
        });
        if (conflicts.some((a: any) => new Date(a.scheduledAt).getTime() + Number(a.durationMinutes) * 60000 > scheduledAt.getTime())) {
          throw new ConflictException('Appointment slot already booked for this doctor');
        }
        const schedule = await tx.opdSchedule.findFirst({
          where: { tenantId, doctorId: body.doctorId, weekday: scheduledAt.getUTCDay(), isActive: true },
        });
        if (!schedule) throw new ConflictException('Doctor is not available for the requested day');
        const start = scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes();
        const end = start + durationMinutes;
        if (start < timeToMinutes(schedule.startTime) || end > timeToMinutes(schedule.endTime)) {
          throw new ConflictException('Requested appointment is outside doctor availability');
        }
        const seq = await this.nextTenantSequence(tenantId, 'OPD_CANONICAL_APPOINTMENT', tx);
        return tx.opdAppointment.create({
          data: {
            tenantId, patientId: body.patientId, doctorId: body.doctorId,
            appointmentCode: buildCode('OPD-APT', seq), scheduledAt,
            timezone: body.timezone ?? schedule.timezone ?? 'Asia/Karachi', durationMinutes,
            status: 'BOOKED', reason: body.reason ?? null, bookedById: actorUserId,
          },
        });
      });
      await this.audit.log({ tenantId, actorUserId, action: 'opd.canonical_appointment.booked', entityType: 'OpdAppointment', entityId: appointment.id, after: this.mapCanonicalAppointment(appointment), correlationId });
      return this.mapCanonicalAppointment(appointment);
    });
  }

  async transitionCanonicalAppointment(tenantId: string, appointmentId: string, target: string, actorUserId: string, body: any, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    return this.withCommandIdempotency(tenantId, `TransitionOpdAppointment:${target}`, body?.idempotencyKey, { appointmentId, target, ...body }, async () => {
      const appointment = await (this.prisma as any).opdAppointment.findFirst({ where: { id: appointmentId, tenantId } });
      if (!appointment) throw new NotFoundException('OPD appointment not found');
      const allowed: Record<string, string[]> = {
        CHECKED_IN: ['BOOKED'], IN_CONSULTATION: ['CHECKED_IN'], COMPLETED: ['IN_CONSULTATION'],
        CANCELLED: ['BOOKED', 'CHECKED_IN'], NO_SHOW: ['BOOKED'],
      };
      if (!allowed[target]?.includes(appointment.status)) throw new ConflictException(`Cannot transition appointment from ${appointment.status} to ${target}`);
      const now = new Date();
      const data: any = { status: target };
      if (target === 'CHECKED_IN') data.checkedInAt = now;
      if (target === 'IN_CONSULTATION') data.consultationStartedAt = now;
      if (target === 'COMPLETED') data.completedAt = now;
      if (target === 'CANCELLED') { data.cancelledAt = now; data.cancelledReason = body?.reason ?? null; }
      if (target === 'NO_SHOW') data.noShowMarkedAt = now;
      const updated = await (this.prisma as any).opdAppointment.update({ where: { id: appointmentId }, data });
      await this.audit.log({ tenantId, actorUserId, action: `opd.canonical_appointment.${target.toLowerCase()}`, entityType: 'OpdAppointment', entityId: appointmentId, before: this.mapCanonicalAppointment(appointment), after: this.mapCanonicalAppointment(updated), correlationId });
      return this.mapCanonicalAppointment(updated);
    });
  }

  async rescheduleCanonicalAppointment(tenantId: string, appointmentId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.scheduledAt) throw new BadRequestException('scheduledAt is required');
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('scheduledAt must be a valid date-time');
    const durationMinutes = Number(body.durationMinutes ?? 15);
    return this.withCommandIdempotency(tenantId, 'RescheduleOpdAppointment', body?.idempotencyKey, { appointmentId, ...body }, async () => {
      const updated = await (this.prisma as any).$transaction(async (tx: any) => {
        const current = await tx.opdAppointment.findFirst({ where: { id: appointmentId, tenantId } });
        if (!current) throw new NotFoundException('OPD appointment not found');
        if (!['BOOKED', 'CHECKED_IN'].includes(current.status)) throw new ConflictException(`Cannot reschedule appointment in status ${current.status}`);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:opd-doctor:${current.doctorId}`}, 0))`;
        const conflicts = await tx.opdAppointment.findMany({ where: { tenantId, doctorId: current.doctorId, id: { not: appointmentId }, status: { in: ['BOOKED', 'CHECKED_IN', 'IN_CONSULTATION'] }, scheduledAt: { lt: new Date(scheduledAt.getTime() + durationMinutes * 60000) } } });
        if (conflicts.some((a: any) => new Date(a.scheduledAt).getTime() + Number(a.durationMinutes) * 60000 > scheduledAt.getTime())) throw new ConflictException('Appointment slot already booked for this doctor');
        return tx.opdAppointment.update({ where: { id: appointmentId }, data: { scheduledAt, durationMinutes, ...(body.timezone ? { timezone: body.timezone } : {}), ...(body.reason !== undefined ? { reason: body.reason } : {}) } });
      });
      await this.audit.log({ tenantId, actorUserId, action: 'opd.canonical_appointment.rescheduled', entityType: 'OpdAppointment', entityId: appointmentId, after: this.mapCanonicalAppointment(updated), correlationId });
      return this.mapCanonicalAppointment(updated);
    });
  }

  async listDoctors(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const where: any = { tenantId };
    if (q?.isActive !== undefined) {
      const b = parseBool(q.isActive);
      if (b !== undefined) where.isActive = b;
    }
    const search = typeof q?.search === 'string' ? q.search.trim() : '';
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { specialtyName: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { clinicName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).opdDoctor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      }),
      (this.prisma as any).opdDoctor.count({ where }),
    ]);
    return {
      data: data.map((d: any) => this.mapKmvpDoctor(d)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getDoctor(tenantId: string, doctorId: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    const d = await (this.prisma as any).opdDoctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!d) throw new NotFoundException('OPD doctor not found');
    return this.mapKmvpDoctor(d);
  }

  async createDoctor(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    if (!body?.code?.trim() || !body?.displayName?.trim() || !body?.specialtyName?.trim()) {
      throw new BadRequestException('code, displayName, and specialtyName are required');
    }
    if (body.consultationFee == null || Number(body.consultationFee) < 0) {
      throw new BadRequestException('consultationFee must be a non-negative number');
    }
    try {
      const d = await (this.prisma as any).opdDoctor.create({
        data: {
          tenantId,
          code: body.code.trim(),
          displayName: body.displayName.trim(),
          specialtyName: body.specialtyName.trim(),
          consultationFee: Number(body.consultationFee),
          userId: body.userId != null ? String(body.userId) : null,
          currency: (body.currency ?? 'PKR').toUpperCase(),
          isActive: body.isActive !== undefined ? !!body.isActive : true,
          sortOrder: Number(body.sortOrder ?? 0),
          designation: body.designation != null ? String(body.designation).trim() : null,
          degrees: body.degrees != null ? String(body.degrees).trim() : null,
          pmdcNumber: body.pmdcNumber != null ? String(body.pmdcNumber).trim() : null,
          phcNumber: body.phcNumber != null ? String(body.phcNumber).trim() : null,
          clinicName: body.clinicName != null ? String(body.clinicName).trim() : null,
          clinicAddress: body.clinicAddress != null ? String(body.clinicAddress).trim() : null,
          clinicPhone: body.clinicPhone != null ? String(body.clinicPhone).trim() : null,
          signatureLabel: body.signatureLabel != null ? String(body.signatureLabel).trim() : null,
          signatureUrl: body.signatureUrl != null ? String(body.signatureUrl).trim() : null,
        },
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'opd.doctor.created',
        entityType: 'OpdDoctor',
        entityId: d.id,
        after: this.mapKmvpDoctor(d),
        correlationId,
      });
      return this.mapKmvpDoctor(d);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Doctor code already exists in tenant');
      throw err;
    }
  }

  async updateDoctor(tenantId: string, doctorId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    const existing = await (this.prisma as any).opdDoctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!existing) throw new NotFoundException('OPD doctor not found');
    try {
      const updated = await (this.prisma as any).opdDoctor.update({
        where: { id: doctorId },
        data: {
          ...(body.code !== undefined ? { code: String(body.code).trim() } : {}),
          ...(body.displayName !== undefined ? { displayName: String(body.displayName).trim() } : {}),
          ...(body.specialtyName !== undefined ? { specialtyName: String(body.specialtyName).trim() } : {}),
          ...(body.consultationFee !== undefined ? { consultationFee: Number(body.consultationFee) } : {}),
          ...(body.currency !== undefined ? { currency: String(body.currency).toUpperCase() } : {}),
          ...(body.isActive !== undefined ? { isActive: !!body.isActive } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
          ...(body.designation !== undefined ? { designation: body.designation != null ? String(body.designation).trim() : null } : {}),
          ...(body.degrees !== undefined ? { degrees: body.degrees != null ? String(body.degrees).trim() : null } : {}),
          ...(body.pmdcNumber !== undefined ? { pmdcNumber: body.pmdcNumber != null ? String(body.pmdcNumber).trim() : null } : {}),
          ...(body.phcNumber !== undefined ? { phcNumber: body.phcNumber != null ? String(body.phcNumber).trim() : null } : {}),
          ...(body.clinicName !== undefined ? { clinicName: body.clinicName != null ? String(body.clinicName).trim() : null } : {}),
          ...(body.clinicAddress !== undefined ? { clinicAddress: body.clinicAddress != null ? String(body.clinicAddress).trim() : null } : {}),
          ...(body.clinicPhone !== undefined ? { clinicPhone: body.clinicPhone != null ? String(body.clinicPhone).trim() : null } : {}),
          ...(body.signatureLabel !== undefined ? { signatureLabel: body.signatureLabel != null ? String(body.signatureLabel).trim() : null } : {}),
          ...(body.signatureUrl !== undefined ? { signatureUrl: body.signatureUrl != null ? String(body.signatureUrl).trim() : null } : {}),
          ...(body.userId !== undefined ? { userId: body.userId != null ? String(body.userId) : null } : {}),
        },
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'opd.doctor.updated',
        entityType: 'OpdDoctor',
        entityId: doctorId,
        before: this.mapKmvpDoctor(existing),
        after: this.mapKmvpDoctor(updated),
        correlationId,
      });
      return this.mapKmvpDoctor(updated);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Doctor code already exists in tenant');
      throw err;
    }
  }

  // ─── OPD KMVP Encounters / Commands ───────────────────────────────────────

  async listEncounters(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const where: any = { tenantId };
    if (q?.status) where.status = q.status;
    if (q?.doctorId) where.doctorId = q.doctorId;
    if (q?.patientId) where.patientId = q.patientId;
    const search = typeof q?.search === 'string' ? q.search.trim() : '';
    if (search) {
      where.OR = [{ visitCode: { contains: search, mode: 'insensitive' } }];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).opdEncounter.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).opdEncounter.count({ where }),
    ]);
    return {
      data: data.map((e: any) => this.mapKmvpEncounter(e)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getEncounter(tenantId: string, encounterId: string) {
    await this.assertOpdEnabled(tenantId);
    const e = await (this.prisma as any).opdEncounter.findFirst({
      where: { id: encounterId, tenantId },
      include: {
        vitals: { orderBy: { enteredAt: 'desc' } },
        notes: true,
        prescriptions: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!e) throw new NotFoundException('OPD encounter not found');
    return {
      ...this.mapKmvpEncounter(e),
      vitals: (e.vitals ?? []).map((v: any) => ({
        id: v.id,
        bpSystolic: v.bpSystolic,
        bpDiastolic: v.bpDiastolic,
        pulse: v.pulse,
        temperatureC: v.temperatureC != null ? Number(v.temperatureC) : null,
        respRate: v.respRate,
        spo2: v.spo2,
        weightKg: v.weightKg != null ? Number(v.weightKg) : null,
        heightCm: v.heightCm != null ? Number(v.heightCm) : null,
        bmi: v.bmi != null ? Number(v.bmi) : null,
        enteredBy: v.enteredBy ?? null,
        enteredAt: v.enteredAt,
      })),
      notes:
        e.notes?.[0] != null
          ? {
              historyNotes: e.notes[0].historyNotes ?? null,
              examNotes: e.notes[0].examNotes ?? null,
              assessment: e.notes[0].assessment ?? null,
              plan: e.notes[0].plan ?? null,
              advice: e.notes[0].advice ?? null,
              diagnosis: e.notes[0].diagnosis ?? null,
              followUp: e.notes[0].followUp ?? null,
              investigations: e.notes[0].investigations ?? null,
              remarks: e.notes[0].remarks ?? null,
              updatedAt: e.notes[0].updatedAt,
            }
          : null,
      prescription:
        e.prescriptions?.[0] != null
          ? {
              id: e.prescriptions[0].id,
              publishedDocumentId: e.prescriptions[0].publishedDocumentId ?? null,
              items: (e.prescriptions[0].items ?? []).map((i: any) => ({
                id: i.id,
                drugName: i.drugName,
                genericName: i.genericName ?? null,
                strength: i.strength ?? null,
                dose: i.dose ?? null,
                frequency: i.frequency ?? null,
                duration: i.duration ?? null,
                route: i.route ?? null,
                instructions: i.instructions ?? null,
                sortOrder: i.sortOrder,
              })),
            }
          : null,
    };
  }

  async createRegistration(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    if (!body?.patientId || !body?.doctorId) {
      throw new BadRequestException('patientId and doctorId are required');
    }
    return this.withCommandIdempotency(
      tenantId,
      'CreateOpdRegistration',
      body?.idempotencyKey,
      body,
      async () => {
        const patient = await (this.prisma as any).patient.findFirst({
          where: { id: body.patientId, tenantId },
        });
        if (!patient) throw new NotFoundException('Patient not found');
        const doctor = await (this.prisma as any).opdDoctor.findFirst({
          where: { id: body.doctorId, tenantId, isActive: true },
        });
        if (!doctor) throw new NotFoundException('Active OPD doctor not found');
        const immediatePayment = body.immediatePaymentAmount == null ? 0 : Number(body.immediatePaymentAmount);
        const consultationFee = Number(doctor.consultationFee);
        if (!Number.isFinite(immediatePayment) || immediatePayment < 0 || immediatePayment > consultationFee) {
          throw new BadRequestException('immediatePaymentAmount must be between zero and the consultation fee');
        }

        let appointmentId: string | null = null;
        let checkedInAt = new Date();

        if (body.appointmentId || body.appointmentCode) {
          const appointment = await (this.prisma as any).opdAppointment.findFirst({
            where: {
              tenantId,
              OR: [
                { id: body.appointmentId },
                { appointmentCode: body.appointmentCode }
              ],
              status: 'BOOKED'
            }
          });
          if (!appointment) {
            throw new NotFoundException('Active appointment not found');
          }
          appointmentId = appointment.id;
          await (this.prisma as any).opdAppointment.update({
            where: { id: appointment.id },
            data: { status: 'CHECKED_IN', checkedInAt }
          });
        }

        const encounter = await (this.prisma as any).encounter.create({
          data: {
            tenantId,
            patientId: body.patientId,
            moduleType: 'OPD',
            status: 'registered',
          },
        });
        const seq = await this.nextTenantSequence(tenantId, 'OPD_ENCOUNTER');
        const opd = await (this.prisma as any).opdEncounter.create({
          data: {
            tenantId,
            patientId: body.patientId,
            encounterId: encounter.id,
            doctorId: body.doctorId,
            appointmentId,
            status: 'REGISTERED',
            visitCode: buildCode('OPD', seq),
            paymentStatus: 'UNPAID',
            checkedInAt,
          },
        });

        const line = {
          description: `Consultation - ${doctor.displayName}`,
          quantity: 1,
          unitPrice: Number(doctor.consultationFee),
          discountAmount: 0,
        };
        const inv = await this.createInvoice(
          tenantId,
          {
            patientId: body.patientId,
            visitId: null,
            encounterId: encounter.id,
            currency: doctor.currency,
            lines: [line],
          },
          actorUserId,
          correlationId,
        );
        if (immediatePayment > 0) {
          await this.issueInvoice(tenantId, inv.id, actorUserId, correlationId);
          await this.recordPayment(
            tenantId,
            inv.id,
            {
              amount: immediatePayment,
              method: body.immediatePaymentMethod ?? 'CASH',
              referenceNo: body.immediatePaymentReferenceNo ?? null,
              notes: body.immediatePaymentNotes ?? null,
            },
            actorUserId,
            correlationId,
          );
          await (this.prisma as any).opdEncounter.update({
            where: { id: opd.id },
            data: { paymentStatus: immediatePayment === consultationFee ? 'PAID' : 'PARTIALLY_PAID' },
          });
        }
        const result = {
          opdEncounter: this.mapKmvpEncounter(opd),
          invoiceId: inv.id,
        };
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.registration.created',
          entityType: 'OpdEncounter',
          entityId: opd.id,
          after: result,
          correlationId,
        });
        return result;
      },
    );
  }

  async recordIntake(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'opd.intake');
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    if (!body?.chiefComplaint || !String(body.chiefComplaint).trim()) {
      throw new BadRequestException('chiefComplaint is required');
    }
    return this.withCommandIdempotency(
      tenantId,
      'RecordOpdIntake',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        assertOpdTransition(e.status, 'INTAKE_COMPLETE');

        const hasMeaningfulVitals =
          body.bpSystolic != null ||
          body.bpDiastolic != null ||
          body.pulse != null ||
          body.temperatureC != null ||
          body.respRate != null ||
          body.spo2 != null ||
          body.weightKg != null ||
          body.heightCm != null;
        if (!hasMeaningfulVitals) {
          throw new BadRequestException('At least one meaningful vital input is required');
        }

        if (body.bpSystolic != null) {
          const val = Number(body.bpSystolic);
          if (val < 70 || val > 220) throw new BadRequestException('bpSystolic must be between 70 and 220 mmHg');
        }
        if (body.bpDiastolic != null) {
          const val = Number(body.bpDiastolic);
          if (val < 40 || val > 130) throw new BadRequestException('bpDiastolic must be between 40 and 130 mmHg');
        }
        if (body.pulse != null) {
          const val = Number(body.pulse);
          if (val < 30 || val > 220) throw new BadRequestException('pulse must be between 30 and 220 bpm');
        }
        if (body.temperatureC != null) {
          const val = Number(body.temperatureC);
          if (val < 30 || val > 45) throw new BadRequestException('temperatureC must be between 30 and 45 C');
        }
        if (body.spo2 != null) {
          const val = Number(body.spo2);
          if (val < 50 || val > 100) throw new BadRequestException('spo2 must be between 50% and 100%');
        }

        const height = body.heightCm != null ? Number(body.heightCm) : null;
        const weight = body.weightKg != null ? Number(body.weightKg) : null;
        let bmi: number | null = null;
        if (height && weight) {
          const hm = height / 100;
          bmi = hm > 0 ? Math.round((weight / (hm * hm)) * 10) / 10 : null;
        }
        await (this.prisma as any).opdVital.create({
          data: {
            tenantId,
            opdEncounterId: e.id,
            bpSystolic: body.bpSystolic ?? null,
            bpDiastolic: body.bpDiastolic ?? null,
            pulse: body.pulse ?? null,
            temperatureC: body.temperatureC ?? null,
            respRate: body.respRate ?? null,
            spo2: body.spo2 ?? null,
            weightKg: body.weightKg ?? null,
            heightCm: body.heightCm ?? null,
            bmi,
            enteredBy: actorUserId,
            enteredAt: new Date(),
          },
        });
        const updated = await (this.prisma as any).opdEncounter.update({
          where: { id: e.id },
          data: {
            chiefComplaint: String(body.chiefComplaint).trim(),
            status: 'INTAKE_COMPLETE',
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : null,
            advice: body.advice != null ? String(body.advice).trim() : null,
            followUp: body.followUp != null ? String(body.followUp).trim() : null,
            investigations: body.investigations != null ? String(body.investigations).trim() : null,
            remarks: body.remarks != null ? String(body.remarks).trim() : null,
          },
        });
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.intake.recorded',
          entityType: 'OpdEncounter',
          entityId: e.id,
          after: this.mapKmvpEncounter(updated),
          correlationId,
        });
        return { opdEncounter: this.mapKmvpEncounter(updated) };
      },
    );
  }

  async startConsultation(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    return this.withCommandIdempotency(tenantId, 'StartOpdConsultation', body?.idempotencyKey, body, async () => {
      const e = await (this.prisma as any).opdEncounter.findFirst({ where: { id: body.opdEncounterId, tenantId } });
      if (!e) throw new NotFoundException('OPD encounter not found');
      assertOpdTransition(e.status, 'IN_CONSULTATION');
      const updated = await (this.prisma as any).opdEncounter.update({
        where: { id: e.id }, data: { status: 'IN_CONSULTATION' },
      });
      await this.audit.log({
        tenantId, actorUserId, action: 'opd.consultation.started', entityType: 'OpdEncounter',
        entityId: e.id, before: this.mapKmvpEncounter(e), after: this.mapKmvpEncounter(updated), correlationId,
      });
      return { opdEncounter: this.mapKmvpEncounter(updated) };
    });
  }

  async signNote(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    return this.withCommandIdempotency(tenantId, 'SignOpdNote', body?.idempotencyKey, body, async () => {
      const e = await (this.prisma as any).opdEncounter.findFirst({ where: { id: body.opdEncounterId, tenantId } });
      if (!e) throw new NotFoundException('OPD encounter not found');
      assertOpdTransition(e.status, 'NOTE_SIGNED');

      // Enforce clinician ownership
      const doctor = await (this.prisma as any).opdDoctor.findFirst({ where: { id: e.doctorId, tenantId } });
      if (doctor?.userId && doctor.userId !== actorUserId) {
        throw new ForbiddenException('Only the assigned clinician can sign clinical notes');
      }

      const values = ['historyNotes', 'examNotes', 'assessment', 'plan', 'advice']
        .map((key) => [key, String(body[key] ?? '').trim()] as const);
      if (values.some(([, value]) => !value)) {
        throw new BadRequestException('historyNotes, examNotes, assessment, plan, and advice are required');
      }

      const latest = await (this.prisma as any).opdNote.findFirst({
        where: { tenantId, opdEncounterId: e.id },
        orderBy: { version: 'desc' }
      });

      let note;
      if (!latest) {
        // Create version 1 directly as SIGNED
        note = await (this.prisma as any).opdNote.create({
          data: {
            tenantId, opdEncounterId: e.id, status: 'SIGNED', signedAt: new Date(), signedBy: actorUserId, version: 1,
            historyNotes: values[0][1], examNotes: values[1][1], assessment: values[2][1], plan: values[3][1], advice: values[4][1],
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : null,
            followUp: body.followUp ? String(body.followUp).trim() : null,
            investigations: body.investigations ? String(body.investigations).trim() : null,
            remarks: body.remarks ? String(body.remarks).trim() : null,
          }
        });
      } else if (latest.status === 'SIGNED') {
        throw new ConflictException('Note is already signed. Use amendments to make changes.');
      } else {
        // Upgrade latest draft to SIGNED
        note = await (this.prisma as any).opdNote.update({
          where: { id: latest.id },
          data: {
            status: 'SIGNED', signedAt: new Date(), signedBy: actorUserId,
            historyNotes: values[0][1], examNotes: values[1][1], assessment: values[2][1], plan: values[3][1], advice: values[4][1],
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : null,
            followUp: body.followUp ? String(body.followUp).trim() : null,
            investigations: body.investigations ? String(body.investigations).trim() : null,
            remarks: body.remarks ? String(body.remarks).trim() : null,
          }
        });
      }

      const updated = await (this.prisma as any).opdEncounter.update({ where: { id: e.id }, data: { status: 'NOTE_SIGNED' } });
      await this.audit.log({
        tenantId, actorUserId, action: 'opd.clinical_note.signed', entityType: 'OpdEncounter', entityId: e.id,
        before: this.mapKmvpEncounter(e), after: { ...this.mapKmvpEncounter(updated), noteId: note.id, noteVersion: note.version }, correlationId,
      });
      return { opdEncounter: this.mapKmvpEncounter(updated), note: { id: note.id, version: note.version, status: note.status } };
    });
  }

  async saveDraftNote(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    return this.withCommandIdempotency(tenantId, 'SaveDraftOpdNote', body?.idempotencyKey, body, async () => {
      const e = await (this.prisma as any).opdEncounter.findFirst({ where: { id: body.opdEncounterId, tenantId } });
      if (!e) throw new NotFoundException('OPD encounter not found');
      if (['COMPLETED', 'CANCELLED'].includes(e.status)) {
        throw new ConflictException('Cannot modify notes of completed or cancelled encounters');
      }

      const doctor = await (this.prisma as any).opdDoctor.findFirst({ where: { id: e.doctorId, tenantId } });
      if (doctor?.userId && doctor.userId !== actorUserId) {
        throw new ForbiddenException('Only the assigned clinician can modify clinical notes');
      }

      const latest = await (this.prisma as any).opdNote.findFirst({
        where: { tenantId, opdEncounterId: e.id },
        orderBy: { version: 'desc' }
      });

      let note;
      if (!latest) {
        note = await (this.prisma as any).opdNote.create({
          data: {
            tenantId,
            opdEncounterId: e.id,
            status: 'DRAFT',
            version: 1,
            historyNotes: body.historyNotes ?? null,
            examNotes: body.examNotes ?? null,
            assessment: body.assessment ?? null,
            plan: body.plan ?? null,
            advice: body.advice ?? null,
            diagnosis: body.diagnosis ?? null,
            followUp: body.followUp ?? null,
            investigations: body.investigations ?? null,
            remarks: body.remarks ?? null,
          }
        });
      } else if (latest.status === 'SIGNED') {
        throw new ConflictException('Cannot edit a signed note directly. Please request an amendment.');
      } else {
        note = await (this.prisma as any).opdNote.update({
          where: { id: latest.id },
          data: {
            historyNotes: body.historyNotes !== undefined ? body.historyNotes : latest.historyNotes,
            examNotes: body.examNotes !== undefined ? body.examNotes : latest.examNotes,
            assessment: body.assessment !== undefined ? body.assessment : latest.assessment,
            plan: body.plan !== undefined ? body.plan : latest.plan,
            advice: body.advice !== undefined ? body.advice : latest.advice,
            diagnosis: body.diagnosis !== undefined ? body.diagnosis : latest.diagnosis,
            followUp: body.followUp !== undefined ? body.followUp : latest.followUp,
            investigations: body.investigations !== undefined ? body.investigations : latest.investigations,
            remarks: body.remarks !== undefined ? body.remarks : latest.remarks,
          }
        });
      }

      await this.audit.log({
        tenantId, actorUserId, action: 'opd.clinical_note.draft_saved', entityType: 'OpdNote', entityId: note.id,
        after: { id: note.id, version: note.version, status: note.status }, correlationId,
      });

      return { note: { id: note.id, version: note.version, status: note.status } };
    });
  }

  async requestNoteAmendment(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.opdEncounterId || !body?.amendmentReason) {
      throw new BadRequestException('opdEncounterId and amendmentReason are required');
    }
    return this.withCommandIdempotency(tenantId, 'RequestOpdNoteAmendment', body?.idempotencyKey, body, async () => {
      const e = await (this.prisma as any).opdEncounter.findFirst({ where: { id: body.opdEncounterId, tenantId } });
      if (!e) throw new NotFoundException('OPD encounter not found');
      if (['COMPLETED', 'CANCELLED'].includes(e.status)) {
        throw new ConflictException('Cannot amend notes of completed or cancelled encounters');
      }

      const doctor = await (this.prisma as any).opdDoctor.findFirst({ where: { id: e.doctorId, tenantId } });
      if (doctor?.userId && doctor.userId !== actorUserId) {
        throw new ForbiddenException('Only the assigned clinician can request amendments');
      }

      const activeNote = await (this.prisma as any).opdNote.findFirst({
        where: { tenantId, opdEncounterId: e.id, status: 'SIGNED' },
        orderBy: { version: 'desc' }
      });
      if (!activeNote) throw new ConflictException('No signed note exists to amend');

      const latest = await (this.prisma as any).opdNote.findFirst({
        where: { tenantId, opdEncounterId: e.id },
        orderBy: { version: 'desc' }
      });
      if (latest && latest.status !== 'SIGNED') {
        throw new ConflictException('A pending note amendment draft already exists');
      }

      const newVersion = activeNote.version + 1;
      const note = await (this.prisma as any).opdNote.create({
        data: {
          tenantId,
          opdEncounterId: e.id,
          status: 'AMENDED_DRAFT',
          version: newVersion,
          historyNotes: body.historyNotes ?? activeNote.historyNotes,
          examNotes: body.examNotes ?? activeNote.examNotes,
          assessment: body.assessment ?? activeNote.assessment,
          plan: body.plan ?? activeNote.plan,
          advice: body.advice ?? activeNote.advice,
          diagnosis: body.diagnosis ?? activeNote.diagnosis,
          followUp: body.followUp ?? activeNote.followUp,
          investigations: body.investigations ?? activeNote.investigations,
          remarks: body.remarks ?? activeNote.remarks,
          amendmentReason: body.amendmentReason,
          amendedById: actorUserId,
          amendmentStatus: 'PENDING',
        }
      });

      await this.audit.log({
        tenantId, actorUserId, action: 'opd.clinical_note.amendment_requested', entityType: 'OpdNote', entityId: note.id,
        after: { id: note.id, version: note.version, status: note.status }, correlationId,
      });

      return { note: { id: note.id, version: note.version, status: note.status, amendmentStatus: note.amendmentStatus } };
    });
  }

  async approveNoteAmendment(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.opdEncounterId || !body?.version) {
      throw new BadRequestException('opdEncounterId and version are required');
    }
    const version = Number(body.version);
    return this.withCommandIdempotency(tenantId, 'ApproveOpdNoteAmendment', body?.idempotencyKey, body, async () => {
      const e = await (this.prisma as any).opdEncounter.findFirst({ where: { id: body.opdEncounterId, tenantId } });
      if (!e) throw new NotFoundException('OPD encounter not found');

      const pending = await (this.prisma as any).opdNote.findUnique({
        where: {
          tenantId_opdEncounterId_version: {
            tenantId,
            opdEncounterId: e.id,
            version
          }
        }
      });
      if (!pending || pending.status !== 'AMENDED_DRAFT' || pending.amendmentStatus !== 'PENDING') {
        throw new NotFoundException('Pending note amendment draft not found');
      }

      const note = await (this.prisma as any).opdNote.update({
        where: { id: pending.id },
        data: {
          status: 'SIGNED',
          amendmentStatus: 'APPROVED',
          signedAt: new Date(),
          signedBy: pending.amendedById,
        }
      });

      await this.audit.log({
        tenantId, actorUserId, action: 'opd.clinical_note.amendment_approved', entityType: 'OpdNote', entityId: note.id,
        after: { id: note.id, version: note.version, status: note.status, amendmentStatus: note.amendmentStatus }, correlationId,
      });

      return { note: { id: note.id, version: note.version, status: note.status, amendmentStatus: note.amendmentStatus } };
    });
  }

  async publishPrescription(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.prescription');
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    const items = Array.isArray(body?.prescriptionItems) ? body.prescriptionItems : [];
    if (items.length < 1) throw new BadRequestException('At least one prescription item is required');
    return this.withCommandIdempotency(
      tenantId,
      'PublishOpdPrescription',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
          include: {
            patient: true,
            doctor: true,
            vitals: { orderBy: { enteredAt: 'desc' }, take: 1 },
          },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        assertOpdTransition(e.status, 'PRESCRIPTION_PUBLISHED');

        const existingNote = await (this.prisma as any).opdNote.findFirst({
          where: { tenantId, opdEncounterId: e.id },
        });
        // Once the note is signed, publication may only attach/publish the
        // prescription. Clinical content must be amended through a separate
        // governed versioning workflow, never silently rewritten here.
        if (e.status === 'NOTE_SIGNED' && existingNote?.status !== 'SIGNED') {
          throw new ConflictException('NOTE_SIGNED encounter has no valid signed note');
        }
        const note = existingNote;
        const followUp = note.followUp ?? '';
        const advice = note.advice ?? '';
        const prescription = await (this.prisma as any).opdEncounterPrescription.upsert({
          where: { tenantId_opdEncounterId: { tenantId, opdEncounterId: e.id } },
          create: { tenantId, opdEncounterId: e.id },
          update: {},
        });
        await (this.prisma as any).opdPrescriptionItemKmvp.deleteMany({
          where: { tenantId, opdPrescriptionId: prescription.id },
        });
        await (this.prisma as any).opdPrescriptionItemKmvp.createMany({
          data: items.map((i: any, idx: number) => ({
            tenantId,
            opdPrescriptionId: prescription.id,
            drugName: String(i.drugName ?? '').trim(),
            genericName: i.genericName ? String(i.genericName).trim() : null,
            strength: i.strength ? String(i.strength).trim() : null,
            dose: i.dose ? String(i.dose).trim() : null,
            frequency: i.frequency ? String(i.frequency).trim() : null,
            duration: i.duration ? String(i.duration).trim() : null,
            route: i.route ? String(i.route).trim() : null,
            instructions: i.instructions ? String(i.instructions).trim() : null,
            sortOrder: idx + 1,
          })),
        });

        const vitals = e.vitals?.[0];
        const payload = {
          payload_version: 'v1',
          templateVersion: 'v2',
          documentFamily: 'opd.prescription.consultants_place.v2',
          patient: {
            mrn: e.patient.mrn,
            firstName: e.patient.firstName,
            lastName: e.patient.lastName,
            gender: e.patient.gender ?? null,
            dateOfBirth: e.patient.dateOfBirth?.toISOString() ?? null,
            mobile: e.patient.mobile ?? null,
          },
          visitCode: e.visitCode,
          doctor: {
            fullName: e.doctor.displayName,
            specialty: e.doctor.specialtyName,
            designation: e.doctor.designation ?? null,
            degrees: e.doctor.degrees ?? null,
            pmdcNumber: e.doctor.pmdcNumber ?? null,
            phcNumber: e.doctor.phcNumber ?? null,
            clinicName: e.doctor.clinicName ?? null,
            clinicAddress: e.doctor.clinicAddress ?? null,
            clinicPhone: e.doctor.clinicPhone ?? null,
            signatureLabel: e.doctor.signatureLabel ?? null,
            signatureUrl: e.doctor.signatureUrl ?? null,
          },
          visitDateTime: e.createdAt.toISOString(),
          majorComplaint: e.chiefComplaint ?? null,
          diagnosis: note.diagnosis ?? e.diagnosis ?? null,
          vitals: vitals
            ? {
                bpSystolic: vitals.bpSystolic,
                bpDiastolic: vitals.bpDiastolic,
                pulse: vitals.pulse,
                temperatureC: vitals.temperatureC != null ? Number(vitals.temperatureC) : null,
                respRate: vitals.respRate,
                spo2: vitals.spo2,
                weightKg: vitals.weightKg != null ? Number(vitals.weightKg) : null,
                heightCm: vitals.heightCm != null ? Number(vitals.heightCm) : null,
                bmi: vitals.bmi != null ? Number(vitals.bmi) : null,
              }
            : null,
          notes: {
            historyNotes: note.historyNotes,
            examNotes: note.examNotes,
            assessment: note.assessment,
            plan: note.plan,
            advice: note.advice,
            followUp: note.followUp ?? null,
            investigations: note.investigations ?? null,
            remarks: note.remarks ?? null,
          },
          prescriptionItems: items,
        };

        const docResult = await this.documents.generateDocument(
          tenantId,
          'OPD_PRESCRIPTION',
          payload,
          e.id,
          'OPD_ENCOUNTER',
          actorUserId,
          correlationId ?? '',
        );
        const updatedEncounter = await (this.prisma as any).opdEncounter.update({
          where: { id: e.id },
          data: {
            status: 'PRESCRIPTION_PUBLISHED',
            publishedAt: new Date(),
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : e.diagnosis,
            advice: advice,
            followUp: followUp || null,
          investigations: note.investigations ?? null,
          remarks: note.remarks ?? null,
          },
        });
        await (this.prisma as any).opdEncounterPrescription.update({
          where: { id: prescription.id },
          data: { publishedDocumentId: docResult.document.id },
        });
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.prescription.published',
          entityType: 'OpdEncounter',
          entityId: e.id,
          after: { documentId: docResult.document.id, status: updatedEncounter.status },
          correlationId,
        });
        return {
          opdEncounter: this.mapKmvpEncounter(updatedEncounter),
          documentId: docResult.document.id,
        };
      },
    );
  }

  async getEncounterPrescriptionDocument(tenantId: string, opdEncounterId: string) {
    await this.assertOpdEnabled(tenantId);
    const prescription = await (this.prisma as any).opdEncounterPrescription.findFirst({
      where: { tenantId, opdEncounterId },
    });
    if (!prescription?.publishedDocumentId) {
      throw new NotFoundException('Prescription document not found');
    }
    const doc = await this.documents.getDocument(tenantId, prescription.publishedDocumentId);
    return doc;
  }

  async downloadEncounterPrescriptionDocument(tenantId: string, opdEncounterId: string) {
    const doc = await this.getEncounterPrescriptionDocument(tenantId, opdEncounterId);
    const bytes = await this.documents.downloadDocument(tenantId, doc.id);
    return { document: doc, bytes };
  }

  async getEncounterReceiptDocument(tenantId: string, opdEncounterId: string) {
    await this.assertOpdEnabled(tenantId);
    const doc = await this.prisma.document.findFirst({
      where: {
        tenantId,
        type: 'OPD_INVOICE_RECEIPT',
        sourceType: 'OPD_ENCOUNTER',
        sourceRef: opdEncounterId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!doc) throw new NotFoundException('OPD receipt document not found');
    return doc;
  }

  async downloadEncounterReceiptDocument(tenantId: string, opdEncounterId: string) {
    const doc = await this.getEncounterReceiptDocument(tenantId, opdEncounterId);
    const bytes = await this.documents.downloadDocument(tenantId, doc.id);
    return { document: doc, bytes };
  }

  async finalizeEncounter(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    return this.withCommandIdempotency(
      tenantId,
      'FinalizeOpdEncounter',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        assertOpdTransition(e.status, 'COMPLETED');
        const updated = await (this.prisma as any).opdEncounter.update({
          where: { id: e.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : e.diagnosis,
            advice: body.advice != null ? String(body.advice).trim() : e.advice,
            followUp: body.followUp != null ? String(body.followUp).trim() : e.followUp,
            investigations: body.investigations != null ? String(body.investigations).trim() : e.investigations,
            remarks: body.remarks != null ? String(body.remarks).trim() : e.remarks,
          },
        });
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.encounter.finalized',
          entityType: 'OpdEncounter',
          entityId: e.id,
          before: this.mapKmvpEncounter(e),
          after: this.mapKmvpEncounter(updated),
          correlationId,
        });
        return { opdEncounter: this.mapKmvpEncounter(updated) };
      },
    );
  }

  async cancelEncounter(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    const reason = String(body?.reason ?? '').trim();
    if (!reason) throw new BadRequestException('reason is required');
    return this.withCommandIdempotency(
      tenantId,
      'CancelOpdEncounter',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        assertOpdTransition(e.status, 'CANCELLED');
        const updated = await (this.prisma as any).opdEncounter.update({
          where: { id: e.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledReason: reason,
          },
        });
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.encounter.cancelled',
          entityType: 'OpdEncounter',
          entityId: e.id,
          before: this.mapKmvpEncounter(e),
          after: this.mapKmvpEncounter(updated),
          correlationId,
        });
        return { opdEncounter: this.mapKmvpEncounter(updated) };
      },
    );
  }

  async generateEncounterReceipt(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.receipt');
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    return this.withCommandIdempotency(
      tenantId,
      'GenerateOpdEncounterReceipt',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
          include: {
            patient: true,
            doctor: true,
          },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        const inv = await (this.prisma as any).invoice.findFirst({
          where: { tenantId, encounterId: e.encounterId },
          include: { lines: { orderBy: { sortOrder: 'asc' } }, payments: { orderBy: { receivedAt: 'desc' } } },
        });
        if (!inv) throw new NotFoundException('OPD encounter invoice not found');

        const payload = {
          payload_version: 'v1',
          templateVersion: 'v2',
          documentFamily: 'opd.receipt.v2',
          invoiceCode: inv.invoiceCode,
          issuedAt: inv.issuedAt?.toISOString() ?? inv.createdAt.toISOString(),
          patientName: `${e.patient.firstName} ${e.patient.lastName}`.trim(),
          patientMrn: e.patient.mrn ?? null,
          patientPhone: e.patient.mobile ?? null,
          status: inv.status,
          visitId: e.id,
          sourceRef: e.id,
          providerName: e.doctor.displayName,
          lines: (inv.lines ?? []).map((line: any) => ({
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            discountAmount: Number(line.discountAmount),
            lineTotal: Number(line.lineTotal),
          })),
          subtotalAmount: Number(inv.subtotalAmount),
          discountAmount: Number(inv.discountAmount),
          totalAmount: Number(inv.totalAmount),
          paidAmount: Number(inv.amountPaid),
          balanceAmount: Number(inv.amountDue),
          paymentMethod: inv.payments?.[0]?.method ?? null,
          referenceNo: inv.payments?.[0]?.referenceNo ?? null,
        };

        const generated = await this.documents.generateDocument(
          tenantId,
          'OPD_INVOICE_RECEIPT',
          payload,
          e.id,
          'OPD_ENCOUNTER',
          actorUserId,
          correlationId ?? '',
        );
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.receipt.generated',
          entityType: 'OpdEncounter',
          entityId: e.id,
          after: { documentId: generated.document.id },
          correlationId,
        });
        return { opdEncounter: this.mapKmvpEncounter(e), documentId: generated.document.id };
      },
    );
  }
}
