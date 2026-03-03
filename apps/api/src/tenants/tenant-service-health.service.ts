import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

const DOCUMENT_RENDER_QUEUE = 'document-render';
const WORKER_STALE_MS = 60_000; // 60 seconds

@Injectable()
export class TenantServiceHealthService {
  private readonly logger = new Logger(TenantServiceHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async getServiceHealth(
    tenantId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    // 1. Resolve tenant (404 if not found)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { domains: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    this.logger.log({
      msg: 'admin.tenant.service_health.read',
      tenantId,
      actorUserId,
      correlationId,
    });

    // 2. Run all probes in parallel
    const [dbHealth, redisHealth, pdfHealth, workerHealth, limsSnapshot, featureFlagsMap] =
      await Promise.all([
        this.probeDb(),
        this.probeRedis(),
        this.probePdf(),
        this.probeWorker(),
        this.getLimsSnapshot(tenantId),
        this.getFeatureFlags(tenantId),
      ]);

    // 3. Emit audit event
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'admin.tenant.service_health.read',
      entityType: 'Tenant',
      entityId: tenantId,
      correlationId,
    });

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domains: tenant.domains.map((d: any) => d.domain),
        status: tenant.status,
        featureFlags: featureFlagsMap,
      },
      services: {
        api: {
          ok: true,
          version: process.env.npm_package_version ?? '0.1.0',
          uptimeSec: process.uptime(),
        },
        worker: workerHealth,
        pdf: pdfHealth,
        db: dbHealth,
        redis: redisHealth,
      },
      limsSnapshot,
    };
  }

  // ─── Probes ──────────────────────────────────────────────────────────────

  private async probeDb(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }

  private async probeRedis(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    let conn: IORedis | null = null;
    try {
      const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
      conn = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true });
      await conn.connect();
      await conn.ping();
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    } finally {
      conn?.disconnect();
    }
  }

  private async probePdf(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    const pdfUrl = process.env.PDF_SERVICE_URL ?? 'http://pdf:8080';
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${pdfUrl}/health/pdf`, { signal: ctrl.signal });
      clearTimeout(timeout);
      if (!res.ok) return { ok: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }

  private async probeWorker(): Promise<{
    ok: boolean;
    queues: { documentRenderDepth: number; failedJobs24h: number };
    lastHeartbeatAt?: string;
  }> {
    let documentRenderDepth = 0;
    let failedJobs24h = 0;
    let lastHeartbeatAt: string | undefined;
    let ok = false;

    // Check heartbeat
    try {
      const hb = await this.prisma.workerHeartbeat.findUnique({ where: { id: 'worker-singleton' } });
      if (hb) {
        lastHeartbeatAt = hb.lastBeatAt.toISOString();
        const staleMs = Date.now() - hb.lastBeatAt.getTime();
        ok = staleMs < WORKER_STALE_MS;
      }
    } catch (err: any) {
      this.logger.warn(`Worker heartbeat read failed: ${err.message}`);
    }

    // Check queue depths via Redis
    try {
      const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
      const conn = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true });
      await conn.connect();
      // BullMQ stores waiting jobs in a list with key `bull:{queueName}:wait`
      documentRenderDepth = await conn.llen(`bull:${DOCUMENT_RENDER_QUEUE}:wait`);

      // Count failed jobs in last 24h from our job_runs table (tenant-agnostic)
      const since = new Date(Date.now() - 86_400_000);
      failedJobs24h = await this.prisma.jobRun.count({
        where: { status: 'failed', finishedAt: { gte: since } },
      });
      conn.disconnect();
    } catch (err: any) {
      this.logger.warn(`Worker queue probe failed: ${err.message}`);
    }

    return { ok, queues: { documentRenderDepth, failedJobs24h }, lastHeartbeatAt };
  }

  // ─── LIMS Snapshot ───────────────────────────────────────────────────────

  private async getLimsSnapshot(tenantId: string) {
    const since24h = new Date(Date.now() - 86_400_000);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const [pendingResults, pendingVerification, failedDocuments24h, publishedToday] =
      await Promise.all([
        // Encounters with orders that haven't been fully resulted yet
        this.prisma.encounter.count({
          where: {
            tenantId,
            status: { in: ['lab_ordered', 'specimen_collected', 'specimen_received', 'partial_resulted'] },
          },
        }),
        // Encounters in resulted state awaiting verification
        this.prisma.encounter.count({
          where: { tenantId, status: 'resulted' },
        }),
        // Documents that FAILED in last 24h
        this.prisma.document.count({
          where: { tenantId, status: 'FAILED', updatedAt: { gte: since24h } },
        }),
        // Documents published today
        this.prisma.document.count({
          where: { tenantId, status: 'PUBLISHED', publishedAt: { gte: todayMidnight } },
        }),
      ]);

    return { pendingResults, pendingVerification, failedDocuments24h, publishedToday };
  }

  private async getFeatureFlags(tenantId: string): Promise<Record<string, boolean>> {
    try {
      const flags = await this.featureFlags.listForTenant(tenantId);
      if (!Array.isArray(flags)) return {};
      return Object.fromEntries(flags.map((f: any) => [f.key, f.enabled]));
    } catch {
      return {};
    }
  }
}
