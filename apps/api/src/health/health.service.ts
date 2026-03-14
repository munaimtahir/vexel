import { Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

const WORKER_HEARTBEAT_ID = 'worker-singleton';
const WORKER_STALE_MS = 60_000;
const HEALTH_TIMEOUT_MS = 1_500;

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async probeRedis(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    let conn: IORedis | null = null;
    try {
      const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
      conn = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: HEALTH_TIMEOUT_MS, lazyConnect: true });
      await conn.connect();
      await conn.ping();
      await conn.llen('bull:document-render:wait');
      return { ok: true, latencyMs: Date.now() - start };
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
}
