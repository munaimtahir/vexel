import { ConflictException, NotFoundException } from '@nestjs/common';
import { OpdService } from './opd.service';

function serviceWith(prisma: any) {
  return new OpdService(prisma, { log: jest.fn() } as any, { getDocument: jest.fn() } as any);
}

describe('OpdService billing invariants', () => {
  const baseInvoice = {
    id: 'inv-1', tenantId: 'tenant-a', patientId: 'patient-a', encounterId: 'enc-1',
    status: 'ISSUED', currency: 'PKR', subtotalAmount: 1000, discountAmount: 0,
    totalAmount: 1000, amountPaid: 0, amountDue: 1000, lines: [],
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

  it('creates invoices against the canonical encounter link without the retired opdVisitId column', async () => {
    const create = jest.fn().mockResolvedValue({ ...baseInvoice, status: 'DRAFT' });
    const prisma = {
      tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
      patient: { findFirst: jest.fn().mockResolvedValue({ id: 'patient-a', tenantId: 'tenant-a' }) },
      encounter: { findFirst: jest.fn().mockResolvedValue({ id: 'enc-1', tenantId: 'tenant-a', patientId: 'patient-a', moduleType: 'OPD' }) },
      tenantSequence: { upsert: jest.fn().mockResolvedValue({ nextValue: 2 }) },
      invoice: { create },
    };

    await serviceWith(prisma).createInvoice('tenant-a', {
      patientId: 'patient-a', encounterId: 'enc-1', visitId: 'retired-visit-id',
      lines: [{ description: 'Consultation', quantity: 1, unitPrice: 1000 }],
    }, 'actor');

    const data = create.mock.calls[0][0].data;
    expect(data.encounterId).toBe('enc-1');
    expect(data).not.toHaveProperty('opdVisitId');
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
        update: jest.fn().mockResolvedValue({ ...paidInvoice, lines: [] }),
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

  describe('OPD Slots and Queueing', () => {
    it('generates 15-minute time slots correctly in scheduled timezone', async () => {
      const schedule = {
        id: 'sch-1', tenantId: 'tenant-a', doctorId: 'doc-1', weekday: 6,
        startTime: '09:00', endTime: '10:00', slotMinutes: 15, timezone: 'Asia/Karachi', isActive: true
      };
      const prisma = {
        tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        opdDoctor: { findFirst: jest.fn().mockResolvedValue({ id: 'doc-1', tenantId: 'tenant-a', isActive: true }) },
        opdSchedule: { findMany: jest.fn().mockResolvedValue([schedule]) },
        opdAppointment: { findMany: jest.fn().mockResolvedValue([]) },
      };

      const result = await serviceWith(prisma).getDoctorSlots('tenant-a', 'doc-1', '2026-08-29'); // 2026-08-29 is Saturday (6)
      expect(result.data).toHaveLength(4);
      expect(result.data[0].isBooked).toBe(false);
    });

    it('orders encounters FCFS by checkedInAt when CHECK_IN_TIME queue rule is set', async () => {
      const e1 = { id: 'e1', tenantId: 'tenant-a', checkedInAt: new Date('2026-08-29T10:00:00Z'), createdAt: new Date('2026-08-29T10:00:00Z'), patient: {}, doctor: {}, appointment: null };
      const e2 = { id: 'e2', tenantId: 'tenant-a', checkedInAt: new Date('2026-08-29T09:00:00Z'), createdAt: new Date('2026-08-29T09:10:00Z'), patient: {}, doctor: {}, appointment: null };
      
      const prisma = {
        tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        opdSettings: { findUnique: jest.fn().mockResolvedValue({ queueRule: 'CHECK_IN_TIME' }) },
        opdEncounter: {
          findMany: jest.fn().mockResolvedValue([e2, e1]),
          count: jest.fn().mockResolvedValue(2),
        }
      };

      const result = await serviceWith(prisma).listEncounterQueue('tenant-a', {});
      expect(prisma.opdEncounter.findMany.mock.calls[0][0].orderBy[0]).toEqual({ checkedInAt: 'asc' });
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Clinical Vitals Bounds Validation', () => {
    it('rejects vital BP systolic value out of bounds (70-220)', async () => {
      const prisma = {
        tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        opdEncounter: { findFirst: jest.fn().mockResolvedValue({ id: 'enc-1', status: 'REGISTERED' }) },
      };
      await expect(serviceWith(prisma).recordIntake('tenant-a', { opdEncounterId: 'enc-1', chiefComplaint: 'Fever', bpSystolic: 69 }, 'actor'))
        .rejects.toThrow('bpSystolic must be between 70 and 220 mmHg');
    });

    it('rejects vital temperature value out of bounds (30-45)', async () => {
      const prisma = {
        tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        opdEncounter: { findFirst: jest.fn().mockResolvedValue({ id: 'enc-1', status: 'REGISTERED' }) },
      };
      await expect(serviceWith(prisma).recordIntake('tenant-a', { opdEncounterId: 'enc-1', chiefComplaint: 'Fever', temperatureC: 46 }, 'actor'))
        .rejects.toThrow('temperatureC must be between 30 and 45 C');
    });
  });

  describe('Clinician Ownership & Clinical Note Amendments', () => {
    it('enforces clinician ownership for note signing', async () => {
      const prisma = {
        tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        opdEncounter: { findFirst: jest.fn().mockResolvedValue({ id: 'enc-1', doctorId: 'doc-1', status: 'IN_CONSULTATION' }) },
        opdDoctor: { findFirst: jest.fn().mockResolvedValue({ id: 'doc-1', userId: 'clinician-1' }) },
      };
      
      await expect(serviceWith(prisma).signNote('tenant-a', {
        opdEncounterId: 'enc-1', historyNotes: 'H', examNotes: 'E', assessment: 'A', plan: 'P', advice: 'Ad'
      }, 'unauthorized-actor'))
        .rejects.toThrow('Only the assigned clinician can sign clinical notes');
    });

    it('creates note amendment draft at incremented version and handles approval', async () => {
      const activeNote = { id: 'note-1', tenantId: 'tenant-a', opdEncounterId: 'enc-1', status: 'SIGNED', version: 1 };
      const prisma = {
        tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        opdEncounter: { findFirst: jest.fn().mockResolvedValue({ id: 'enc-1', doctorId: 'doc-1', status: 'NOTE_SIGNED' }) },
        opdDoctor: { findFirst: jest.fn().mockResolvedValue({ id: 'doc-1', userId: 'clinician-1' }) },
        opdNote: {
          findFirst: jest.fn().mockResolvedValue(activeNote),
          create: jest.fn().mockResolvedValue({ id: 'note-2', status: 'AMENDED_DRAFT', version: 2, amendmentStatus: 'PENDING' }),
        }
      };

      const result = await serviceWith(prisma).requestNoteAmendment('tenant-a', {
        opdEncounterId: 'enc-1', amendmentReason: 'Typo'
      }, 'clinician-1');
      expect(result.note.version).toBe(2);
      expect(result.note.status).toBe('AMENDED_DRAFT');
    });
  });

  describe('Refund Controls', () => {
    it('rejects refund if amount exceeds configured refundMaxLimitPct of settings', async () => {
      const settings = { refundMaxLimitPct: 50 }; // 50% max refund allowed
      const invoice = { id: 'inv-1', totalAmount: 1000, amountPaid: 1000, amountDue: 0, status: 'PAID' };
      const tx = {
        invoice: { findFirst: jest.fn().mockResolvedValue(invoice), update: jest.fn() },
        $queryRaw: jest.fn().mockResolvedValue([]),
        payment: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
        tenantSequence: { upsert: jest.fn().mockResolvedValue({ nextValue: 2 }) },
      };
      const prisma = {
        tenantFeature: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        opdSettings: { findUnique: jest.fn().mockResolvedValue(settings) },
        $transaction: jest.fn((fn: any) => fn(tx)),
      };

      await expect(serviceWith(prisma).refundInvoice('tenant-a', 'inv-1', { amount: 501 }, 'actor'))
        .rejects.toThrow('Total refund exceeds maximum allowed limit of 50% (500)');
    });
  });
});
