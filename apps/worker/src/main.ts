import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { processCatalogImport } from './catalog-import.processor';
import { processCatalogExport } from './catalog-export.processor';
import { processDocumentRender } from './document-render.processor';
import { processOpsBackup } from './ops-backup.processor';
import { getPrismaClient } from './prisma';

async function ensureStorageBucket() {
  const bucket = process.env.STORAGE_BUCKET ?? 'vexel-documents';
  const s3 = new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT ?? 'http://minio:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? 'vexel',
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? 'vexel_secret_2026',
    },
    forcePathStyle: true,
  });
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✅ Storage bucket '${bucket}' exists`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`✅ Storage bucket '${bucket}' created`);
  }
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
}) as any;

connection.on('connect', () => console.log('✅ Worker connected to Redis'));
connection.on('error', (err) => console.error('❌ Redis error:', err.message));

// Catalog import processor
const catalogImportWorker = new Worker('catalog-import', processCatalogImport, { connection });

// Catalog export processor
const catalogExportWorker = new Worker('catalog-export', processCatalogExport, { connection });

// Document render processor — concurrency=3 so multiple render jobs run in parallel
const documentRenderWorker = new Worker('document-render', processDocumentRender, {
  connection,
  concurrency: 3,
});

// Ops backup processor — concurrency=1 (serialised to prevent resource conflicts)
const opsBackupPrisma = getPrismaClient();
const opsBackupWorker = new Worker(
  'ops-backup',
  async (job) => processOpsBackup(job, opsBackupPrisma),
  { connection, concurrency: 1 },
);

catalogImportWorker.on('completed', (job) => console.log(`[catalog-import] Job ${job.id} completed`));
catalogImportWorker.on('failed', (job, err) => console.error(`[catalog-import] Job ${job?.id} failed: ${err.message}`));
catalogExportWorker.on('completed', (job) => console.log(`[catalog-export] Job ${job.id} completed`));
catalogExportWorker.on('failed', (job, err) => console.error(`[catalog-export] Job ${job?.id} failed: ${err.message}`));
documentRenderWorker.on('completed', (job) => console.log(`[document-render] Job ${job.id} completed`));
documentRenderWorker.on('failed', (job, err) => console.error(`[document-render] Job ${job?.id} failed: ${err.message}`));
opsBackupWorker.on('completed', (job) => console.log(`[ops-backup] Job ${job.id} completed`));
opsBackupWorker.on('failed', (job, err) => console.error(`[ops-backup] Job ${job?.id} failed: ${err.message}`));

console.log('🚀 Vexel Worker running. Queues: catalog-import, catalog-export, document-render, ops-backup');
// Note: the API's /jobs monitoring endpoints (apps/api/src/jobs) watch a queue
// named "jobs" that nothing ever enqueues to — it will always show empty. The
// queues actually doing work (above) aren't monitored by that endpoint today.
// Flagged as a real gap, not fixed here (out of scope for this cleanup pass).

// Ensure MinIO bucket exists on startup
ensureStorageBucket().catch((err) => console.error('Failed to ensure storage bucket:', err.message));

// Worker heartbeat — upserts a singleton row every 30s so the API can detect worker liveness
const WORKER_VERSION = process.env.npm_package_version ?? '0.1.0';
const heartbeatPrisma = getPrismaClient();
async function writeHeartbeat() {
  try {
    await heartbeatPrisma.workerHeartbeat.upsert({
      where: { id: 'worker-singleton' },
      update: { lastBeatAt: new Date() },
      create: { id: 'worker-singleton', startedAt: new Date(), lastBeatAt: new Date(), version: WORKER_VERSION },
    });
  } catch (err: any) {
    console.warn('[worker] heartbeat write failed:', err.message);
  }
}
writeHeartbeat();
const heartbeatTimer = setInterval(writeHeartbeat, 30_000);

process.on('SIGTERM', async () => {
  clearInterval(heartbeatTimer);
  await Promise.all([catalogImportWorker.close(), catalogExportWorker.close(), documentRenderWorker.close(), opsBackupWorker.close()]);
  process.exit(0);
});
