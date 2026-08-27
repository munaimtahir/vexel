import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { cleanupExpiredArtifacts as CleanupFn } from '../../../../worker/src/ops-backup.processor';

describe('Ops Worker retention cleanup', () => {
  let runtimeDir: string;
  let cleanupExpiredArtifacts: typeof CleanupFn;
  const originalRuntimeDir = process.env.VEXEL_RUNTIME_DIR;

  beforeEach(() => {
    // Use a fresh temp directory per test — VEXEL_RUNTIME_DIR points at the real
    // production runtime dir on deployed hosts, and a hardcoded fallback path
    // tied to one machine breaks on any other host (including CI runners).
    runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vexel-ops-retention-test-'));
    // The module reads VEXEL_RUNTIME_DIR into a module-level const at import
    // time (used by cleanupExpiredArtifacts's "must be under runtime dir"
    // safety guard), so the env var must be set before a fresh import.
    process.env.VEXEL_RUNTIME_DIR = runtimeDir;
    jest.resetModules();
    ({ cleanupExpiredArtifacts } = require('../../../../worker/src/ops-backup.processor'));
  });

  afterEach(() => {
    process.env.VEXEL_RUNTIME_DIR = originalRuntimeDir;
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  });

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
      await new Promise<void>((resolve) => logStream.end(resolve));
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
