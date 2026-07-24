import { ConflictException, NotFoundException } from '@nestjs/common';
import { EncountersService } from '../encounters.service';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn().mockResolvedValue({}) })),
}));
jest.mock('ioredis', () => {
  const mock = jest.fn().mockImplementation(() => ({}));
  (mock as any).default = mock;
  return mock;
});

function makeEncounter(tenantId = 'tenant-a') {
  return { id: 'enc-1', tenantId, moduleType: 'LIMS', status: 'lab_ordered' };
}

function makeLabOrder(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'lo-1',
    tenantId: 'tenant-a',
    encounterId: 'enc-1',
    totalAmount: 1000,
    discountAmount: 0,
    payableAmount: 1000,
    amountPaid: 0,
    dueAmount: 1000,
    ...overrides,
  };
}

function buildPrisma() {
  return {
    tenantFeature: { findUnique: jest.fn().mockResolvedValue({ key: 'module.lims', enabled: true }) },
    encounter: { findFirst: jest.fn().mockResolvedValue(makeEncounter()) },
    labOrder: {
      findFirst: jest.fn().mockResolvedValue(makeLabOrder()),
      update: jest.fn().mockResolvedValue({}),
    },
    cashTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function buildAudit() {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

describe('Cash / payments (collectDue, applyDiscount, getFinancials)', () => {
  let service: EncountersService;
  let prisma: ReturnType<typeof buildPrisma>;
  let audit: ReturnType<typeof buildAudit>;

  beforeEach(() => {
    prisma = buildPrisma();
    audit = buildAudit();
    service = new EncountersService(prisma as any, audit as any, {} as any);
  });

  describe('collectDue', () => {
    it('writes a CashTransaction with type DUE_RECEIVED and the given paymentMode', async () => {
      const result = await service.collectDue('tenant-a', 'enc-1', { amount: 300, paymentMode: 'CARD' }, 'user-1');

      expect(prisma.cashTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-a',
            encounterId: 'enc-1',
            type: 'DUE_RECEIVED',
            paymentMode: 'CARD',
            actorUserId: 'user-1',
          }),
        }),
      );
      expect(result).toEqual({ success: true, dueAmount: 700 });
    });

    it('defaults paymentMode to CASH when not provided', async () => {
      await service.collectDue('tenant-a', 'enc-1', { amount: 100 }, 'user-1');
      expect(prisma.cashTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ paymentMode: 'CASH' }) }),
      );
    });

    it('updates the lab order amountPaid/dueAmount', async () => {
      await service.collectDue('tenant-a', 'enc-1', { amount: 400 }, 'user-1');
      expect(prisma.labOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lo-1' },
          data: expect.objectContaining({ dueAmount: expect.anything() }),
        }),
      );
    });

    it('writes an audit event', async () => {
      await service.collectDue('tenant-a', 'enc-1', { amount: 100 }, 'user-1', 'corr-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'encounter.collect-due', tenantId: 'tenant-a', correlationId: 'corr-1' }),
      );
    });

    it('rejects a non-positive amount', async () => {
      await expect(service.collectDue('tenant-a', 'enc-1', { amount: 0 }, 'user-1')).rejects.toThrow(ConflictException);
      await expect(service.collectDue('tenant-a', 'enc-1', { amount: -50 }, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for an unknown / cross-tenant encounter', async () => {
      prisma.encounter.findFirst.mockResolvedValueOnce(null);
      await expect(service.collectDue('tenant-b', 'enc-1', { amount: 100 }, 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('applyDiscount', () => {
    it('writes a CashTransaction with type DISCOUNT and the reason', async () => {
      const result = await service.applyDiscount('tenant-a', 'enc-1', { discountAmount: 200, reason: 'staff discount' }, 'user-1');

      expect(prisma.cashTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'DISCOUNT', reason: 'staff discount' }),
        }),
      );
      expect(result).toEqual({ success: true, newPayable: 800, newDue: 800 });
    });

    it('rejects a missing or blank reason', async () => {
      await expect(
        service.applyDiscount('tenant-a', 'enc-1', { discountAmount: 100, reason: '' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.applyDiscount('tenant-a', 'enc-1', { discountAmount: 100, reason: '   ' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a non-positive discount amount', async () => {
      await expect(
        service.applyDiscount('tenant-a', 'enc-1', { discountAmount: 0, reason: 'x' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('writes an audit event', async () => {
      await service.applyDiscount('tenant-a', 'enc-1', { discountAmount: 50, reason: 'x' }, 'user-1', 'corr-2');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'encounter.apply-discount', correlationId: 'corr-2' }),
      );
    });
  });

  describe('getFinancials (ledger read path)', () => {
    it('returns the encounter and its cash transactions, tenant-scoped', async () => {
      const enc = { id: 'enc-1', tenantId: 'tenant-a', labOrders: [makeLabOrder()], patient: {} };
      (prisma as any).encounter.findFirst.mockResolvedValueOnce(enc);
      (prisma as any).cashTransaction.findMany.mockResolvedValueOnce([{ id: 'tx-1', type: 'DUE_RECEIVED', amount: 300 }]);

      const result = await service.getFinancials('tenant-a', 'enc-1');

      expect(prisma.cashTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-a', encounterId: 'enc-1' } }),
      );
      expect(result).toEqual({ encounter: enc, transactions: [{ id: 'tx-1', type: 'DUE_RECEIVED', amount: 300 }] });
    });

    it('throws NotFoundException when the encounter does not belong to the tenant', async () => {
      (prisma as any).encounter.findFirst.mockResolvedValueOnce(null);
      await expect(service.getFinancials('tenant-b', 'enc-1')).rejects.toThrow(NotFoundException);
    });
  });
});
