import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function n(v: any): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertOpdEnabled(tenantId: string) {
    const flag = await (this.prisma as any).tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key: 'module.opd' } },
    });
    if (!flag?.enabled) throw new ForbiddenException('module.opd feature is disabled for this tenant');
  }

  private async getInvoiceRawOrThrow(tenantId: string, invoiceId: string) {
    const row = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        opdVisit: { include: { appointment: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: { where: { status: 'POSTED' }, orderBy: { receivedAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('OPD invoice not found');
    return row;
  }

  private mapPayment(payment: any) {
    return {
      id: payment.id,
      tenantId: payment.tenantId,
      invoiceId: payment.invoiceId,
      amount: n(payment.amount),
      method: payment.method,
      referenceNo: payment.referenceNo ?? null,
      note: payment.note ?? null,
      paidAt: payment.receivedAt,
      createdBy: payment.receivedById ?? null,
      createdAt: payment.createdAt,
    };
  }

  private mapInvoiceLine(line: any) {
    return {
      id: line.id,
      description: line.description,
      quantity: n(line.quantity),
      unitPrice: n(line.unitPrice),
      discountAmount: n(line.discountAmount),
      taxAmount: 0,
      total: n(line.lineTotal),
    };
  }

  private mapInvoice(row: any) {
    const payments = (row.payments ?? []).filter((p: any) => p.status === 'POSTED').map((p: any) => this.mapPayment(p));
    const lines = (row.lines ?? []).map((l: any) => this.mapInvoiceLine(l));
    return {
      id: row.id,
      tenantId: row.tenantId,
      patientId: row.patientId,
      visitId: row.opdVisitId ?? null,
      appointmentId: row.opdVisit?.appointmentId ?? null,
      invoiceNumber: row.invoiceCode ?? null,
      status: row.status,
      currency: row.currency,
      subtotal: n(row.subtotalAmount),
      discountTotal: n(row.discountAmount),
      taxTotal: 0,
      grandTotal: n(row.totalAmount),
      paidTotal: n(row.amountPaid),
      balanceDue: n(row.amountDue),
      issuedAt: row.issuedAt ?? null,
      voidedAt: row.voidedAt ?? null,
      voidReason: row.voidReason ?? null,
      note: null,
      lines,
      payments,
      invoiceDocumentId: null,
      receiptDocumentId: null,
      createdBy: row.createdById ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listInvoices(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const where: any = { tenantId };
    if (q?.patientId) where.patientId = q.patientId;
    if (q?.visitId) where.opdVisitId = q.visitId;
    if (q?.appointmentId) where.opdVisit = { appointmentId: q.appointmentId };
    if (q?.status) where.status = q.status;
    if (q?.createdFrom || q?.createdTo) {
      where.createdAt = {};
      if (q.createdFrom) where.createdAt.gte = new Date(q.createdFrom);
      if (q.createdTo) where.createdAt.lte = new Date(q.createdTo);
    }
    if (q?.search) {
      const s = String(q.search);
      where.OR = [
        { invoiceCode: { contains: s, mode: 'insensitive' } },
        { patient: { mrn: { contains: s, mode: 'insensitive' } } },
        { patient: { firstName: { contains: s, mode: 'insensitive' } } },
        { patient: { lastName: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [rows, total] = await Promise.all([
      (this.prisma as any).invoice.findMany({
        where,
        include: {
          opdVisit: { include: { appointment: true } },
          lines: { orderBy: { sortOrder: 'asc' } },
          payments: { where: { status: 'POSTED' }, orderBy: { receivedAt: 'asc' } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).invoice.count({ where }),
    ]);
    return {
      data: rows.map((r: any) => this.mapInvoice(r)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createInvoice(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    const patient = await (this.prisma as any).patient.findFirst({ where: { id: body?.patientId, tenantId } });
    if (!patient) throw new NotFoundException('Patient not found');

    let opdVisitId = body?.visitId ?? null;
    if (opdVisitId) {
      const visit = await (this.prisma as any).oPDVisit.findFirst({ where: { id: opdVisitId, tenantId } });
      if (!visit) throw new NotFoundException('OPD visit not found');
      if (visit.patientId !== body.patientId) throw new ConflictException('Visit patientId mismatch');
    } else if (body?.appointmentId) {
      const visit = await (this.prisma as any).oPDVisit.findFirst({
        where: { tenantId, appointmentId: body.appointmentId },
      });
      if (visit) opdVisitId = visit.id;
    }

    const normalizedLines = (body?.lines ?? []).map((line: any, idx: number) => {
      const quantity = Number(line.quantity ?? 1);
      const unitPrice = Number(line.unitPrice ?? 0);
      const discountAmount = Number(line.discountAmount ?? 0);
      const total = line.total == null ? (quantity * unitPrice) - discountAmount : Number(line.total);
      if (quantity < 0 || unitPrice < 0 || discountAmount < 0 || total < 0) {
        throw new ConflictException('Invalid invoice line amounts');
      }
      return {
        sortOrder: idx,
        lineType: 'SERVICE',
        description: line.description,
        quantity,
        unitPrice,
        discountAmount,
        lineTotal: total,
      };
    });
    if (!normalizedLines.length) throw new ConflictException('At least one invoice line is required');

    const subtotal = normalizedLines.reduce((sum: number, l: any) => sum + (l.quantity * l.unitPrice), 0);
    const discountAmount = normalizedLines.reduce((sum: number, l: any) => sum + l.discountAmount, 0);
    const totalAmount = normalizedLines.reduce((sum: number, l: any) => sum + l.lineTotal, 0);

    const created = await (this.prisma as any).invoice.create({
      data: {
        tenantId,
        patientId: body.patientId,
        opdVisitId,
        encounterId: null,
        status: 'DRAFT',
        currency: body?.currency ?? 'PKR',
        subtotalAmount: new Decimal(String(subtotal)),
        discountAmount: new Decimal(String(discountAmount)),
        totalAmount: new Decimal(String(totalAmount)),
        amountPaid: new Decimal('0'),
        amountDue: new Decimal(String(totalAmount)),
        createdById: actorUserId,
        lines: {
          create: normalizedLines.map((l: any) => ({
            tenantId,
            sortOrder: l.sortOrder,
            lineType: l.lineType,
            description: l.description,
            quantity: new Decimal(String(l.quantity)),
            unitPrice: new Decimal(String(l.unitPrice)),
            discountAmount: new Decimal(String(l.discountAmount)),
            lineTotal: new Decimal(String(l.lineTotal)),
          })),
        },
      },
      include: {
        opdVisit: { include: { appointment: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: { where: { status: 'POSTED' }, orderBy: { receivedAt: 'asc' } },
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.invoice.create',
      entityType: 'Invoice',
      entityId: created.id,
      after: body,
      correlationId,
    });
    return this.mapInvoice(created);
  }

  async getInvoice(tenantId: string, invoiceId: string) {
    await this.assertOpdEnabled(tenantId);
    return this.mapInvoice(await this.getInvoiceRawOrThrow(tenantId, invoiceId));
  }

  async listInvoicePayments(tenantId: string, invoiceId: string) {
    await this.assertOpdEnabled(tenantId);
    const invoice = await this.getInvoiceRawOrThrow(tenantId, invoiceId);
    return {
      data: (invoice.payments ?? []).filter((p: any) => p.status === 'POSTED').map((p: any) => this.mapPayment(p)),
    };
  }

  async issueInvoice(tenantId: string, invoiceId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    const invoice = await this.getInvoiceRawOrThrow(tenantId, invoiceId);
    if (invoice.status !== 'DRAFT') throw new ConflictException('Invalid invoice transition');
    const updated = await (this.prisma as any).invoice.update({
      where: { id: invoiceId },
      data: { status: 'ISSUED', issuedAt: new Date() },
      include: {
        opdVisit: { include: { appointment: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: { where: { status: 'POSTED' }, orderBy: { receivedAt: 'asc' } },
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.invoice.issue',
      entityType: 'Invoice',
      entityId: invoiceId,
      before: { status: invoice.status },
      after: { status: 'ISSUED', note: body?.note ?? null },
      correlationId,
    });
    return this.mapInvoice(updated);
  }

  async voidInvoice(tenantId: string, invoiceId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    const invoice = await this.getInvoiceRawOrThrow(tenantId, invoiceId);
    if (invoice.status === 'VOID') throw new ConflictException('Invalid invoice transition');
    if (invoice.status === 'PAID' || n(invoice.amountPaid) > 0) {
      throw new ConflictException('Cannot void invoice with posted payments');
    }
    const updated = await (this.prisma as any).invoice.update({
      where: { id: invoiceId },
      data: { status: 'VOID', voidedAt: new Date(), voidReason: body?.reason ?? null },
      include: {
        opdVisit: { include: { appointment: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        payments: { where: { status: 'POSTED' }, orderBy: { receivedAt: 'asc' } },
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.invoice.void',
      entityType: 'Invoice',
      entityId: invoiceId,
      before: { status: invoice.status },
      after: { status: 'VOID', reason: body?.reason ?? null },
      correlationId,
    });
    return this.mapInvoice(updated);
  }

  async recordInvoicePayment(
    tenantId: string,
    invoiceId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const invoice = await this.getInvoiceRawOrThrow(tenantId, invoiceId);
    if (!['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)) {
      throw new ConflictException('Invalid invoice transition');
    }
    const amount = Number(body?.amount);
    if (!(amount > 0)) throw new ConflictException('Payment amount must be greater than 0');
    const balanceDue = n(invoice.amountDue);
    if (amount > balanceDue) throw new ConflictException('Overpayment is not allowed');
    const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new ConflictException('Invalid paidAt');

    const result = await (this.prisma as any).$transaction(async (tx: any) => {
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId,
          status: 'POSTED',
          method: body?.method ?? 'CASH',
          amount: new Decimal(String(amount)),
          receivedAt: paidAt,
          receivedById: actorUserId,
          referenceNo: body?.referenceNo ?? null,
          note: body?.note ?? null,
          correlationId: correlationId ?? null,
        },
      });

      const nextPaidTotal = n(invoice.amountPaid) + amount;
      const nextDue = Math.max(0, n(invoice.totalAmount) - nextPaidTotal);
      const nextStatus = nextDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: new Decimal(String(nextPaidTotal)),
          amountDue: new Decimal(String(nextDue)),
          status: nextStatus,
        },
      });

      const invoiceFresh = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId },
        include: {
          opdVisit: { include: { appointment: true } },
          lines: { orderBy: { sortOrder: 'asc' } },
          payments: { where: { status: 'POSTED' }, orderBy: { receivedAt: 'asc' } },
        },
      });
      return { payment, invoice: invoiceFresh };
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.invoice.record_payment',
      entityType: 'Invoice',
      entityId: invoiceId,
      before: { status: invoice.status, amountPaid: n(invoice.amountPaid), amountDue: n(invoice.amountDue) },
      after: { status: result.invoice.status, amountPaid: n(result.invoice.amountPaid), amountDue: n(result.invoice.amountDue), paymentId: result.payment.id, amount },
      correlationId,
    });

    return {
      invoice: this.mapInvoice(result.invoice),
      payment: this.mapPayment(result.payment),
    };
  }
}
