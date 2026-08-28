import { ConflictException, NotFoundException } from '@nestjs/common';
import { OpdService } from './opd.service';

function serviceWith(prisma: any) {
  return new OpdService(prisma, { log: jest.fn() } as any, { getDocument: jest.fn() } as any);
}

describe('OpdService billing invariants', () => {
  const baseInvoice = {
    id: 'inv-1', tenantId: 'tenant-a', patientId: 'patient-a', encounterId: 'enc-1',
    status: 'ISSUED', currency: 'PKR', subtotalAmount: 1000, discountAmount: 0,
    totalAmount: 1000, amountPaid: 0, amountDue: 1000, lines: [], opdVisit: null,
    createdAt: new Date(), updatedAt: new Date(),
  };

  it('rejects an invoice linked to an encounter owned by another tenant', async () => {
    const prisma = {
      tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
      patient: { findFirst: jest.fn().mockResolvedValue({ id: 'patient-a', tenantId: 'tenant-a' }) },
      encounter: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(serviceWith(prisma).createInvoice('tenant-a', {
      patientId: 'patient-a', encounterId: 'enc-b',
      lines: [{ description: 'Consultation', quantity: 1, unitPrice: 1000 }],
    }, 'actor')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects empty invoices before any financial write', async () => {
    const prisma = { tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) } };
    await expect(serviceWith(prisma).createInvoice('tenant-a', { patientId: 'patient-a', lines: [] }, 'actor'))
      .rejects.toThrow('At least one invoice line is required');
  });

  it('rejects overpayment while holding the invoice row lock', async () => {
    const update = jest.fn();
    const tx = {
      invoice: { findFirst: jest.fn().mockResolvedValue({ ...baseInvoice, amountPaid: 900, amountDue: 100 }), update },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      tenantSequence: { upsert: jest.fn() },
      payment: { create: jest.fn() },
    };
    const prisma = {
      tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    await expect(serviceWith(prisma).recordPayment('tenant-a', 'inv-1', { amount: 101, method: 'CASH' }, 'actor'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });

  it('locks and updates the invoice atomically for a valid payment', async () => {
    const paidInvoice = { ...baseInvoice, status: 'PAID', amountPaid: 1000, amountDue: 0 };
    const tx = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue(baseInvoice),
        update: jest.fn().mockResolvedValue({ ...paidInvoice, lines: [], opdVisit: null }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      tenantSequence: { upsert: jest.fn().mockResolvedValue({ nextValue: 2 }) },
      payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1', tenantId: 'tenant-a', invoiceId: 'inv-1', status: 'POSTED', method: 'CASH', amount: 1000, receivedAt: new Date() }) },
    };
    const prisma = {
      tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    const result = await serviceWith(prisma).recordPayment('tenant-a', 'inv-1', { amount: 1000, method: 'CASH' }, 'actor');
    expect(result.invoice.status).toBe('PAID');
    expect(result.payment.id).toBe('pay-1');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.invoice.update).toHaveBeenCalledTimes(1);
  });
});
