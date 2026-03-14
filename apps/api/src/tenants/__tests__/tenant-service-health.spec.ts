/**
 * Unit tests for TenantServiceHealthService
 *
 * Tests:
 * 1. Returns 404 when tenant not found
 * 2. Returns all service health blocks with graceful degradation on probe failures
 * 3. LIMS snapshot counts are tenant-scoped (tenantId filter enforced)
 * 4. Audit event emitted on successful read
 * 5. Worker marked ok=false when heartbeat is stale
 */

import { TenantServiceHealthService } from '../tenant-service-health.service';
import { NotFoundException } from '@nestjs/common';

// ─── Mock deps ───────────────────────────────────────────────────────────────

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
  logBestEffort: jest.fn().mockResolvedValue(undefined),
};
const mockFeatureFlags = {
  listForTenant: jest.fn().mockResolvedValue([{ key: 'module.lims', enabled: true }]),
};

const TENANT_A = 'tenant-a-uuid';
const TENANT_B = 'tenant-b-uuid';

const baseTenant = {
  id: TENANT_A,
  name: 'Tenant A',
  status: 'active',
  domains: [{ domain: 'a.example.com' }],
};

function buildMockPrisma(overrides: Record<string, any> = {}) {
  return {
    tenant: {
      findUnique: jest.fn().mockImplementation(({ where }) =>
        where.id === TENANT_A ? Promise.resolve(baseTenant) : Promise.resolve(null),
      ),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    encounter: {
      count: jest.fn().mockImplementation(({ where }) => {
        // Verify tenant scoping
        if (where.tenantId !== TENANT_A) return Promise.resolve(0);
        if (Array.isArray(where.status?.in)) return Promise.resolve(3); // pendingResults
        if (where.status === 'resulted') return Promise.resolve(2);     // pendingVerification
        return Promise.resolve(0);
      }),
    },
    document: {
      count: jest.fn().mockImplementation(({ where }) => {
        if (where.tenantId !== TENANT_A) return Promise.resolve(0);
        if (where.status === 'FAILED') return Promise.resolve(1);
        if (where.status === 'PUBLISHED') return Promise.resolve(5);
        return Promise.resolve(0);
      }),
    },
    workerHeartbeat: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'worker-singleton',
        lastBeatAt: new Date(), // fresh heartbeat
        startedAt: new Date(Date.now() - 120_000),
        version: '0.1.0',
      }),
    },
    jobRun: {
      count: jest.fn().mockResolvedValue(0),
    },
    ...overrides,
  };
}

// Mock IORedis to avoid real network calls
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    llen: jest.fn().mockResolvedValue(0),
    disconnect: jest.fn(),
  }));
});

// Mock fetch for PDF probe
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ status: 'ok' }),
}) as any;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TenantServiceHealthService', () => {
  let service: TenantServiceHealthService;
  let mockPrisma: ReturnType<typeof buildMockPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = buildMockPrisma();
    service = new TenantServiceHealthService(
      mockPrisma as any,
      mockAudit as any,
      mockFeatureFlags as any,
    );
  });

  it('throws NotFoundException when tenant not found', async () => {
    await expect(
      service.getServiceHealth('non-existent-id', 'actor-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns full health response for valid tenant', async () => {
    const result = await service.getServiceHealth(TENANT_A, 'actor-1', 'corr-1');

    expect(result.tenant.id).toBe(TENANT_A);
    expect(result.tenant.domains).toContain('a.example.com');
    expect(result.services.api.ok).toBe(true);
    expect(result.services.api.uptimeSec).toBeGreaterThan(0);
    expect(result.services.db.ok).toBe(true);
    expect(result.limsSnapshot.pendingResults).toBe(3);
    expect(result.limsSnapshot.pendingVerification).toBe(2);
    expect(result.limsSnapshot.failedDocuments24h).toBe(1);
    expect(result.limsSnapshot.publishedToday).toBe(5);
  });

  it('enforces tenant scoping in LIMS snapshot queries', async () => {
    await service.getServiceHealth(TENANT_A, 'actor-1');

    // Every encounter.count call must include tenantId = TENANT_A
    const encounterCalls = (mockPrisma.encounter.count as jest.Mock).mock.calls;
    for (const [args] of encounterCalls) {
      expect(args.where.tenantId).toBe(TENANT_A);
    }

    // Every document.count call must include tenantId = TENANT_A
    const documentCalls = (mockPrisma.document.count as jest.Mock).mock.calls;
    for (const [args] of documentCalls) {
      expect(args.where.tenantId).toBe(TENANT_A);
    }
  });

  it('emits audit event with correct action and entityId', async () => {
    await service.getServiceHealth(TENANT_A, 'actor-user-1', 'corr-xyz');

    expect(mockAudit.logBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.tenant.service_health.read',
        entityType: 'Tenant',
        entityId: TENANT_A,
        tenantId: TENANT_A,
        actorUserId: 'actor-user-1',
        correlationId: 'corr-xyz',
      }),
    );
  });

  it('marks worker ok=false when heartbeat is stale (>60s)', async () => {
    const staleTime = new Date(Date.now() - 90_000); // 90s ago
    mockPrisma = buildMockPrisma({
      workerHeartbeat: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'worker-singleton',
          lastBeatAt: staleTime,
          startedAt: new Date(Date.now() - 3_600_000),
          version: '0.1.0',
        }),
      },
    });
    service = new TenantServiceHealthService(
      mockPrisma as any,
      mockAudit as any,
      mockFeatureFlags as any,
    );

    const result = await service.getServiceHealth(TENANT_A, 'actor-1');
    expect(result.services.worker.ok).toBe(false);
    expect(result.services.worker.lastHeartbeatAt).toBeDefined();
  });

  it('marks worker ok=false when heartbeat row does not exist', async () => {
    mockPrisma = buildMockPrisma({
      workerHeartbeat: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });
    service = new TenantServiceHealthService(
      mockPrisma as any,
      mockAudit as any,
      mockFeatureFlags as any,
    );

    const result = await service.getServiceHealth(TENANT_A, 'actor-1');
    expect(result.services.worker.ok).toBe(false);
  });

  it('returns db ok=false with error message on DB failure', async () => {
    mockPrisma = buildMockPrisma({
      $queryRaw: jest.fn().mockRejectedValue(new Error('Connection refused')),
    });
    service = new TenantServiceHealthService(
      mockPrisma as any,
      mockAudit as any,
      mockFeatureFlags as any,
    );

    const result = await service.getServiceHealth(TENANT_A, 'actor-1');
    expect(result.services.db.ok).toBe(false);
    expect(result.services.db.error).toContain('Connection refused');
  });

  it('returns pdf ok=false gracefully when PDF service unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await service.getServiceHealth(TENANT_A, 'actor-1');
    expect(result.services.pdf.ok).toBe(false);
    expect(result.services.pdf.error).toBeDefined();
  });

  it('does not leak tenant B data when querying tenant A', async () => {
    // Confirm the service would return 404 for tenant B
    await expect(
      service.getServiceHealth(TENANT_B, 'actor-1'),
    ).rejects.toThrow(NotFoundException);

    // No count queries should have been issued for tenant B
    expect(mockPrisma.encounter.count).not.toHaveBeenCalled();
    expect(mockPrisma.document.count).not.toHaveBeenCalled();
  });
});
