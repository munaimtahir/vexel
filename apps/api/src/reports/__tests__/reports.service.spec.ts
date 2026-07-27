import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from '../reports.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrismaService() {
  return {
    patient: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    encounter: { findMany: jest.fn(), findFirst: jest.fn() },
    labOrder: { findMany: jest.fn(), groupBy: jest.fn() },
    document: { findMany: jest.fn() },
    auditEvent: { findMany: jest.fn() },
    cashTransaction: { findMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaMock: ReturnType<typeof makePrismaService>;

  beforeEach(async () => {
    prismaMock = makePrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
  });

  describe('getRegistrationsReport', () => {
    it('scopes patient queries by tenantId and returns paginated data with daily counts', async () => {
      prismaMock.patient.findMany.mockResolvedValueOnce([
        { id: 'p1', mrn: 'MRN-1', firstName: 'A', lastName: 'B', gender: 'M', mobile: null, createdAt: new Date() },
      ]);
      prismaMock.patient.count.mockResolvedValueOnce(1);
      prismaMock.$queryRaw.mockResolvedValueOnce([{ day: new Date('2026-07-01'), count: 1n }]);

      const result = await service.getRegistrationsReport('tenant-1', { page: 1, limit: 50 });

      expect(prismaMock.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }),
      );
      expect(result.total).toBe(1);
      expect(result.dailyCounts).toEqual([{ date: new Date('2026-07-01'), count: 1 }]);
    });
  });

  describe('getPatientHistory', () => {
    it('throws NotFoundException if patient does not belong to tenant', async () => {
      prismaMock.patient.findFirst.mockResolvedValueOnce(null);
      await expect(service.getPatientHistory('tenant-1', 'p-404')).rejects.toThrow(NotFoundException);
    });

    it('aggregates encounters and documents for a patient', async () => {
      prismaMock.patient.findFirst.mockResolvedValueOnce({ id: 'p1', tenantId: 'tenant-1' });
      prismaMock.encounter.findMany.mockResolvedValueOnce([
        { id: 'e1', encounterCode: 'ENC-1', status: 'verified', createdAt: new Date(), labOrders: [] },
      ]);
      prismaMock.document.findMany.mockResolvedValueOnce([
        { id: 'd1', type: 'LAB_REPORT', status: 'PUBLISHED', sourceRef: 'e1', publishedAt: new Date(), createdAt: new Date() },
      ]);

      const result = await service.getPatientHistory('tenant-1', 'p1');

      expect(result.visitCount).toBe(1);
      expect(result.encounters[0].documents).toHaveLength(1);
    });
  });

  describe('getWorklistStatusReport', () => {
    it('returns status counts and a pending list with computed age', async () => {
      prismaMock.labOrder.groupBy.mockResolvedValueOnce([{ status: 'ordered', _count: { _all: 3 } }]);
      const createdAt = new Date(Date.now() - 2 * 3_600_000);
      prismaMock.labOrder.findMany.mockResolvedValueOnce([
        {
          id: 'lo1',
          encounterId: 'e1',
          testNameSnapshot: 'CBC',
          status: 'ordered',
          resultStatus: 'PENDING',
          createdAt,
          encounter: { encounterCode: 'ENC-1', patient: { firstName: 'A', lastName: 'B', mrn: 'MRN-1' } },
        },
      ]);

      const result = await service.getWorklistStatusReport('tenant-1');

      expect(result.statusCounts).toEqual([{ status: 'ordered', count: 3 }]);
      expect(result.pending[0].ageHours).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getEncounterTimeline', () => {
    it('throws NotFoundException for an encounter outside the tenant', async () => {
      prismaMock.encounter.findFirst.mockResolvedValueOnce(null);
      await expect(service.getEncounterTimeline('tenant-1', 'e-404')).rejects.toThrow(NotFoundException);
    });

    it('merges Encounter and LabOrder audit events chronologically', async () => {
      prismaMock.encounter.findFirst.mockResolvedValueOnce({ id: 'e1', encounterCode: 'ENC-1' });
      prismaMock.labOrder.findMany.mockResolvedValueOnce([{ id: 'lo1' }]);
      prismaMock.auditEvent.findMany.mockResolvedValueOnce([
        { id: 'a1', action: 'encounter.register', entityType: 'Encounter', entityId: 'e1', actor: null, before: null, after: {}, createdAt: new Date() },
      ]);

      const result = await service.getEncounterTimeline('tenant-1', 'e1');

      expect(prismaMock.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            OR: expect.arrayContaining([
              { entityType: 'Encounter', entityId: 'e1' },
              { entityType: 'LabOrder', entityId: { in: ['lo1'] } },
            ]),
          }),
        }),
      );
      expect(result.events).toHaveLength(1);
    });
  });

  describe('getDailyCollectionReport', () => {
    it('sums transactions by payment mode for the given day', async () => {
      prismaMock.cashTransaction.findMany.mockResolvedValueOnce([
        { id: 't1', encounterId: 'e1', type: 'PAYMENT', amount: 500, paymentMode: 'CASH', actor: null, createdAt: new Date() },
        { id: 't2', encounterId: 'e2', type: 'PAYMENT', amount: 200, paymentMode: 'CARD', actor: null, createdAt: new Date() },
      ]);

      const result = await service.getDailyCollectionReport('tenant-1', '2026-07-27');

      expect(result.total).toBe(700);
      expect(result.byPaymentMode).toEqual({ CASH: 500, CARD: 200 });
    });
  });

  describe('getOutstandingDuesReport', () => {
    it('scopes by tenantId and only includes orders with a positive due amount', async () => {
      prismaMock.labOrder.findMany.mockResolvedValueOnce([
        {
          id: 'lo1',
          encounterId: 'e1',
          testNameSnapshot: 'CBC',
          payableAmount: 700,
          amountPaid: 400,
          dueAmount: 300,
          createdAt: new Date(),
          encounter: { encounterCode: 'ENC-1', patient: { firstName: 'A', lastName: 'B', mrn: 'MRN-1' } },
        },
      ]);

      const result = await service.getOutstandingDuesReport('tenant-1');

      expect(prismaMock.labOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1', dueAmount: { gt: 0 } } }),
      );
      expect(result.totalDue).toBe(300);
    });
  });

  describe('getDiscountsReport', () => {
    it('totals DISCOUNT-type cash transactions', async () => {
      prismaMock.cashTransaction.findMany.mockResolvedValueOnce([
        {
          id: 't1',
          encounterId: 'e1',
          amount: 100,
          reason: 'loyalty',
          actor: { firstName: 'A', lastName: 'B' },
          encounter: { patient: { firstName: 'P', lastName: 'Q', mrn: 'MRN-1' } },
          createdAt: new Date(),
        },
      ]);

      const result = await service.getDiscountsReport('tenant-1', {});

      expect(result.totalDiscounted).toBe(100);
    });
  });
});
