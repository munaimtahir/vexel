import { Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const WORKER_HEARTBEAT_ID = 'worker-singleton';
const WORKER_STALE_MS = 60_000;
const HEALTH_TIMEOUT_MS = 1_500;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getWorkerHealth() {
    const redis = await this.probeRedis();
    const heartbeat = await this.probeWorkerHeartbeat();

    const status = redis.ok && heartbeat.ok ? 'ok' : 'degraded';

    return {
      status,
      services: {
        worker: heartbeat.ok ? 'ok' : 'down',
        redis: redis.ok ? 'ok' : 'down',
      },
      details: {
        redisLatencyMs: redis.latencyMs ?? null,
        redisError: redis.error ?? null,
        workerLastHeartbeatAt: heartbeat.lastHeartbeatAt ?? null,
      },
    };
  }

  async getPdfHealth() {
    const pdf = await this.probePdf();

    return {
      status: pdf.ok ? 'ok' : 'degraded',
      services: { pdf: pdf.ok ? 'ok' : 'down' },
      details: {
        pdfLatencyMs: pdf.latencyMs ?? null,
        pdfHttpStatus: pdf.httpStatus ?? null,
        pdfError: pdf.error ?? null,
      },
    };
  }

  async getDeepHealth() {
    const start = Date.now();
    const [db, redis, worker, pdf, storage] = await Promise.all([
      this.probeDb(),
      this.probeRedis(),
      this.probeWorkerHeartbeat(),
      this.probePdf(),
      this.probeStorage(),
    ]);

    const queueOk = redis.ok && redis.queueDepth !== undefined;
    const ok = db.ok && redis.ok && worker.ok && pdf.ok && storage.ok;
    const status = ok ? 'ok' : 'degraded';

    // Count failed jobs from Prisma to check failed jobs present
    let failedJobsCount = 0;
    try {
      failedJobsCount = await this.prisma.jobRun.count({
        where: { status: 'failed' },
      });
    } catch { /* ignore */ }

    return {
      status,
      latencyMs: Date.now() - start,
      services: {
        api: 'ok',
        db: db.ok ? 'ok' : 'down',
        redis: redis.ok ? 'ok' : 'down',
        worker: worker.ok ? 'ok' : 'down',
        pdf: pdf.ok ? 'ok' : 'down',
        storage: storage.ok ? 'ok' : 'down',
        queue: queueOk ? 'ok' : 'down',
      },
      details: {
        dbLatencyMs: db.latencyMs ?? null,
        dbError: db.error ?? null,
        redisLatencyMs: redis.latencyMs ?? null,
        redisError: redis.error ?? null,
        queueDepth: redis.queueDepth ?? null,
        workerLastHeartbeatAt: worker.lastHeartbeatAt ?? null,
        pdfLatencyMs: pdf.latencyMs ?? null,
        pdfHttpStatus: pdf.httpStatus ?? null,
        pdfError: pdf.error ?? null,
        storageError: storage.error ?? null,
        failedJobsCount,
      },
    };
  }

  private async probeDb(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err?.message ?? String(err) };
    }
  }

  private async probeRedis(): Promise<{ ok: boolean; latencyMs?: number; queueDepth?: number; error?: string }> {
    const start = Date.now();
    let conn: IORedis | null = null;
    try {
      const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
      conn = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: HEALTH_TIMEOUT_MS, lazyConnect: true });
      await conn.connect();
      await conn.ping();
      let depth = 0;
      try {
        depth = await conn.llen('bull:document-render:wait');
      } catch { /* ignore */ }
      return { ok: true, latencyMs: Date.now() - start, queueDepth: depth };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err?.message ?? String(err) };
    } finally {
      conn?.disconnect();
    }
  }

  private async probeWorkerHeartbeat(): Promise<{ ok: boolean; lastHeartbeatAt?: string }> {
    try {
      const hb = await this.prisma.workerHeartbeat.findUnique({ where: { id: WORKER_HEARTBEAT_ID } });
      if (!hb) return { ok: false };
      const staleMs = Date.now() - hb.lastBeatAt.getTime();
      return {
        ok: staleMs < WORKER_STALE_MS,
        lastHeartbeatAt: hb.lastBeatAt.toISOString(),
      };
    } catch {
      return { ok: false };
    }
  }

  private async probePdf(): Promise<{ ok: boolean; latencyMs?: number; httpStatus?: number; error?: string }> {
    const start = Date.now();
    const pdfUrl = process.env.PDF_SERVICE_URL ?? 'http://pdf:8080';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      const response = await fetch(`${pdfUrl}/health/pdf`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        return {
          ok: false,
          latencyMs: Date.now() - start,
          httpStatus: response.status,
          error: `HTTP ${response.status}`,
        };
      }
      return { ok: true, latencyMs: Date.now() - start, httpStatus: response.status };
    } catch (err: any) {
      clearTimeout(timeout);
      return { ok: false, latencyMs: Date.now() - start, error: err?.message ?? String(err) };
    }
  }

  private async probeStorage(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.storageService.ensureBucket();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) };
    }
  }
}
