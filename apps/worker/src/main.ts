import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on('connect', () => console.log('✅ Worker connected to Redis'));
connection.on('error', (err) => console.error('❌ Redis error:', err.message));

// Placeholder jobs queue processor
const jobsWorker = new Worker(
  'jobs',
  async (job) => {
    console.log(`[worker] Processing job ${job.id} (${job.name})`);
    // TODO: implement actual job handlers (PDF render, imports, nightly jobs)
    await new Promise((r) => setTimeout(r, 100));
    console.log(`[worker] Job ${job.id} completed`);
  },
  { connection },
);

jobsWorker.on('completed', (job) => console.log(`[worker] Job ${job.id} completed`));
jobsWorker.on('failed', (job, err) => console.error(`[worker] Job ${job?.id} failed: ${err.message}`));

console.log('🚀 Vexel Worker running. Listening on queue: jobs');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await jobsWorker.close();
  process.exit(0);
});
