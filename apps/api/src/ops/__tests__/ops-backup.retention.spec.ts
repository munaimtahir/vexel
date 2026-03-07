import * as fs from 'fs';
import * as path from 'path';
import { cleanupExpiredArtifacts } from '../../../../worker/src/ops-backup.processor';

const runtimeDir = process.env.VEXEL_RUNTIME_DIR ?? '/home/munaim/srv/apps/vexel/runtime';

describe('Ops Worker retention cleanup', () => {
  it('purges old backup artifacts and keeps current run untouched', async () => {
    const fullDir = path.join(runtimeDir, 'backups', 'full');
    fs.mkdirSync(fullDir, { recursive: true });

    const oldArtifact = path.join(fullDir, `retention-old-${Date.now()}.tar.gz`);
    fs.writeFileSync(oldArtifact, 'dummy-backup');

    const prisma = {
      opsBackupRun: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'old-run',
            tenantId: 'system',
            correlationId: 'corr-old',
            artifactPath: oldArtifact,
            metaJson: null,
            finishedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    const logPath = path.join(runtimeDir, 'data', 'logs', `retention-test-${Date.now()}.log`);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    try {
      await cleanupExpiredArtifacts(prisma, 'FULL', 'current-run', logStream);
    } finally {
      logStream.end();
    }

    expect(fs.existsSync(oldArtifact)).toBe(false);
    expect(prisma.opsBackupRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'old-run' },
      }),
    );
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ops.artifact.retention_purged',
          entityId: 'old-run',
        }),
      }),
    );
  });
});
