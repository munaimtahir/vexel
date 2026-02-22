import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { processCatalogImport } from './catalog-import.processor';
import { processCatalogExport } from './catalog-export.processor';
import { processDocumentRender } from './document-render.processor';

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

// Legacy jobs queue
const jobsWorker = new Worker(
  'jobs',
  async (job) => {
    console.log(`[worker] Processing job ${job.id} (${job.name})`);
    await new Promise((r) => setTimeout(r, 100));
    console.log(`[worker] Job ${job.id} completed`);
  },
  { connection },
);

// Catalog import processor
const catalogImportWorker = new Worker('catalog-import', processCatalogImport, { connection });

// Catalog export processor
const catalogExportWorker = new Worker('catalog-export', processCatalogExport, { connection });

// Document render processor
const documentRenderWorker = new Worker('document-render', processDocumentRender, { connection });

jobsWorker.on('completed', (job) => console.log(`[jobs] Job ${job.id} completed`));
jobsWorker.on('failed', (job, err) => console.error(`[jobs] Job ${job?.id} failed: ${err.message}`));
catalogImportWorker.on('completed', (job) => console.log(`[catalog-import] Job ${job.id} completed`));
catalogImportWorker.on('failed', (job, err) => console.error(`[catalog-import] Job ${job?.id} failed: ${err.message}`));
catalogExportWorker.on('completed', (job) => console.log(`[catalog-export] Job ${job.id} completed`));
catalogExportWorker.on('failed', (job, err) => console.error(`[catalog-export] Job ${job?.id} failed: ${err.message}`));
documentRenderWorker.on('completed', (job) => console.log(`[document-render] Job ${job.id} completed`));
documentRenderWorker.on('failed', (job, err) => console.error(`[document-render] Job ${job?.id} failed: ${err.message}`));

console.log('🚀 Vexel Worker running. Queues: jobs, catalog-import, catalog-export, document-render');

// Ensure MinIO bucket exists on startup
ensureStorageBucket().catch((err) => console.error('Failed to ensure storage bucket:', err.message));

process.on('SIGTERM', async () => {
  await Promise.all([jobsWorker.close(), catalogImportWorker.close(), catalogExportWorker.close(), documentRenderWorker.close()]);
  process.exit(0);
});
