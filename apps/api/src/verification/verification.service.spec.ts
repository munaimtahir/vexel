import { VerificationService } from './verification.service';

describe('VerificationService per-test commands', () => {
  const tx = {
    labOrder: { updateMany: jest.fn(), findMany: jest.fn() },
    labResult: { updateMany: jest.fn() },
    encounter: { update: jest.fn() },
  };
  const prisma = {
    labOrder: { findFirst: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const audit = { logInTransaction: jest.fn() };
  const documents = { generateFromEncounter: jest.fn().mockResolvedValue({ document: { id: 'doc-a' } }) };
  const service = new VerificationService(prisma as any, audit as any, documents as any);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.labOrder.updateMany.mockResolvedValue({ count: 1 });
    tx.labOrder.findMany.mockResolvedValue([
      { status: 'verified', resultStatus: 'SUBMITTED' },
      { status: 'processing', resultStatus: 'PENDING' },
    ]);
    tx.labResult.updateMany.mockResolvedValue({ count: 1 });
    tx.encounter.update.mockResolvedValue({});
    audit.logInTransaction.mockResolvedValue({});
  });

  it('verifies only the selected submitted test and derives a partial encounter status', async () => {
    prisma.labOrder.findFirst.mockResolvedValue({
      id: 'test-a', tenantId: 'tenant-a', encounterId: 'encounter-a', resultStatus: 'SUBMITTED', status: 'processing',
    });

    await expect(service.verifyOrderedTest('tenant-a', 'user-a', 'test-a', 'corr-a')).resolves.toEqual({
      orderedTestId: 'test-a', encounterId: 'encounter-a', encounterStatus: 'partial_resulted', documentJobId: 'doc-a',
    });
    expect(tx.labOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'test-a', tenantId: 'tenant-a' }),
      data: { status: 'verified' },
    }));
    expect(tx.labResult.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ labOrderId: 'test-a', tenantId: 'tenant-a' }),
    }));
    expect(audit.logInTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'TEST_VERIFIED', entityId: 'test-a', correlationId: 'corr-a',
    }));
    expect(documents.generateFromEncounter).toHaveBeenCalledWith('tenant-a', 'encounter-a', 'user-a', 'corr-a');
  });

  it('returns only the selected submitted test for correction', async () => {
    prisma.labOrder.findFirst.mockResolvedValue({
      id: 'test-a', tenantId: 'tenant-a', encounterId: 'encounter-a', resultStatus: 'SUBMITTED', status: 'processing',
    });

    await service.returnOrderedTestForCorrection('tenant-a', 'user-a', 'test-a', 'typo', 'corr-a');
    expect(tx.labOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'test-a', tenantId: 'tenant-a' }),
      data: expect.objectContaining({ resultStatus: 'PENDING', status: 'processing' }),
    }));
    expect(audit.logInTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'TEST_RETURNED_FOR_CORRECTION', entityId: 'test-a',
    }));
  });
});
