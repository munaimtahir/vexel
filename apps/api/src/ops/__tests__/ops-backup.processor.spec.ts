import { createRestorePreSnapshotRun } from '../../../../worker/src/ops-backup.processor';

describe('Ops Worker pre-snapshot helper', () => {
  it('creates a real pre-snapshot run and audit event', async () => {
    const prisma = {
      opsBackupRun: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    const result = await createRestorePreSnapshotRun(prisma, 'restore-run-1');

    expect(result.preSnapshotRunId).toBeTruthy();
    expect(result.preSnapshotCorrelationId).toBe('restore-presnap-restore-run-1');
    expect(prisma.opsBackupRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: result.preSnapshotRunId,
          type: 'FULL',
          status: 'QUEUED',
          correlationId: result.preSnapshotCorrelationId,
        }),
      }),
    );
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ops.restore.pre_snapshot.queued',
          entityId: result.preSnapshotRunId,
        }),
      }),
    );
  });
});
