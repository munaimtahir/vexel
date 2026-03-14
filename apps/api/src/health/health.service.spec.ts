import IORedis from 'ioredis';
import { HealthService } from './health.service';

jest.mock('ioredis', () => {
  const mock = jest.fn();
  (mock as any).default = mock;
  return mock;
});

describe('HealthService', () => {
  const redisCtor = IORedis as unknown as jest.Mock;
  const realFetch = (global as any).fetch;

  function makeService(heartbeat: Date | null) {
    const prisma = {
      workerHeartbeat: {
        findUnique: jest.fn().mockResolvedValue(
          heartbeat
            ? { id: 'worker-singleton', lastBeatAt: heartbeat }
            : null,
        ),
      },
    };
    return { service: new HealthService(prisma as any), prisma };
  }

  beforeEach(() => {
    redisCtor.mockReset();
    (global as any).fetch = jest.fn();
  });

  afterAll(() => {
    (global as any).fetch = realFetch;
  });

  it('returns ok worker health when redis and heartbeat are healthy', async () => {
    redisCtor.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      llen: jest.fn().mockResolvedValue(0),
      disconnect: jest.fn(),
    }));
    const { service } = makeService(new Date());

    const result = await service.getWorkerHealth();

    expect(result.status).toBe('ok');
    expect(result.services.worker).toBe('ok');
    expect(result.services.redis).toBe('ok');
  });

  it('degrades worker health when redis is unavailable', async () => {
    redisCtor.mockImplementation(() => ({
      connect: jest.fn().mockRejectedValue(new Error('redis down')),
      disconnect: jest.fn(),
    }));
    const { service } = makeService(new Date());

    const result = await service.getWorkerHealth();

    expect(result.status).toBe('degraded');
    expect(result.services.redis).toBe('down');
  });

  it('degrades worker health when heartbeat is stale', async () => {
    redisCtor.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      llen: jest.fn().mockResolvedValue(0),
      disconnect: jest.fn(),
    }));
    const stale = new Date(Date.now() - 5 * 60_000);
    const { service } = makeService(stale);

    const result = await service.getWorkerHealth();

    expect(result.status).toBe('degraded');
    expect(result.services.worker).toBe('down');
  });

  it('returns ok pdf health on healthy dependency', async () => {
    ((global as any).fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 });
    const { service } = makeService(new Date());

    const result = await service.getPdfHealth();

    expect(result.status).toBe('ok');
    expect(result.services.pdf).toBe('ok');
  });

  it('degrades pdf health on non-200 response', async () => {
    ((global as any).fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 });
    const { service } = makeService(new Date());

    const result = await service.getPdfHealth();

    expect(result.status).toBe('degraded');
    expect(result.services.pdf).toBe('down');
    expect(result.details.pdfHttpStatus).toBe(503);
  });

  it('degrades pdf health on timeout/error', async () => {
    ((global as any).fetch as jest.Mock).mockRejectedValueOnce(new Error('timeout'));
    const { service } = makeService(new Date());

    const result = await service.getPdfHealth();

    expect(result.status).toBe('degraded');
    expect(result.services.pdf).toBe('down');
  });
});
