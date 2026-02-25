import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingService } from '../billing.service';

function buildPayment(overrides: Record<string, any> = {}) {
  return {
    id: 'pay-1',
    tenantId: 'tenant-a',
    invoiceId: 'inv-1',
    status: 'POSTED',
    method: 'CASH',
    amount: 0,
    receivedAt: new Date('2026-02-24T10:00:00.000Z'),
    receivedById: 'user-1',
    referenceNo: null,
    note: null,
    correlationId: 'corr-1',
    createdAt: new Date('2026-02-24T10:00:00.000Z'),
    ...overrides,
  };
}

function buildInvoice(overrides: Record<string, any> = {}) {
  return {
    id: 'inv-1',
    tenantId: 'tenant-a',
    patientId: 'patient-1',
    opdVisitId: 'visit-1',
    opdVisit: { id: 'visit-1', appointmentId: 'appt-1', appointment: { id: 'appt-1' } },
    invoiceCode: 'INV-001',
    status: 'ISSUED',
    currency: 'PKR',
    subtotalAmount: 1000,
    discountAmount: 0,
    totalAmount: 1000,
    amountPaid: 0,
    amountDue: 1000,
    issuedAt: new Date('2026-02-24T09:00:00.000Z'),
    voidedAt: null,
    voidReason: null,
    createdById: 'user-1',
    createdAt: new Date('2026-02-24T09:00:00.000Z'),
    updatedAt: new Date('2026-02-24T09:00:00.000Z'),
    lines: [],
    payments: [],
    ...overrides,
  };
}

function buildPrisma() {
  const tx = {
    payment: {
      create: jest.fn(),
    },
    invoice: {
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  return {
    tenantFeature: {
      findUnique: jest.fn().mockResolvedValue({ enabled: true }),
    },
    invoice: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
    __tx: tx,
  };
}

function buildAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

describe('BillingService OPD invoice payments', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: ReturnType<typeof buildAudit>;
  let service: BillingService;

  beforeEach(() => {
    prisma = buildPrisma();
    audit = buildAudit();
    service = new BillingService(prisma as any, audit as any);
  });

  it('records partial payment and moves invoice to PARTIALLY_PAID with reduced balance', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(
      buildInvoice({ status: 'ISSUED', totalAmount: 1000, amountPaid: 0, amountDue: 1000 }),
    );
    prisma.__tx.payment.create.mockResolvedValueOnce(buildPayment({ id: 'pay-partial', amount: 400 }));
    prisma.__tx.invoice.update.mockResolvedValueOnce({});
    prisma.__tx.invoice.findFirst.mockResolvedValueOnce(
      buildInvoice({
        status: 'PARTIALLY_PAID',
        totalAmount: 1000,
        amountPaid: 400,
        amountDue: 600,
        payments: [buildPayment({ id: 'pay-partial', amount: 400 })],
      }),
    );

    const result = await service.recordInvoicePayment(
      'tenant-a',
      'inv-1',
      { amount: 400, method: 'CASH' },
      'user-1',
      'corr-1',
    );

    expect(result.invoice.status).toBe('PARTIALLY_PAID');
    expect(result.invoice.paidTotal).toBe(400);
    expect(result.invoice.balanceDue).toBe(600);
    expect(prisma.__tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ status: 'PARTIALLY_PAID' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'opd.invoice.record_payment' }));
  });

  it('records final payment and moves invoice to PAID with zero balance', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(
      buildInvoice({ status: 'PARTIALLY_PAID', totalAmount: 1000, amountPaid: 400, amountDue: 600 }),
    );
    prisma.__tx.payment.create.mockResolvedValueOnce(buildPayment({ id: 'pay-final', amount: 600 }));
    prisma.__tx.invoice.update.mockResolvedValueOnce({});
    prisma.__tx.invoice.findFirst.mockResolvedValueOnce(
      buildInvoice({
        status: 'PAID',
        totalAmount: 1000,
        amountPaid: 1000,
        amountDue: 0,
        payments: [
          buildPayment({ id: 'pay-partial', amount: 400 }),
          buildPayment({ id: 'pay-final', amount: 600 }),
        ],
      }),
    );

    const result = await service.recordInvoicePayment(
      'tenant-a',
      'inv-1',
      { amount: 600, method: 'CARD', referenceNo: 'TXN-1' },
      'user-1',
      'corr-2',
    );

    expect(result.invoice.status).toBe('PAID');
    expect(result.invoice.paidTotal).toBe(1000);
    expect(result.invoice.balanceDue).toBe(0);
    expect(prisma.__tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
  });

  it('returns 409 when payment command is attempted from invalid invoice status', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(buildInvoice({ status: 'DRAFT' }));

    await expect(
      service.recordInvoicePayment('tenant-a', 'inv-1', { amount: 100 }, 'user-1', 'corr-3'),
    ).rejects.toThrow(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('enforces tenant isolation in invoice lookup (cross-tenant reads not found)', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(null);

    await expect(service.getInvoice('tenant-a', 'inv-from-tenant-b')).rejects.toThrow(NotFoundException);

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'inv-from-tenant-b', tenantId: 'tenant-a' }),
      }),
    );
  });
});
