import { Injectable } from '@nestjs/common';
import IORedis from 'ioredis';

@Injectable()
export class HealthService {
  private getRedisConnection() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    return new IORedis(url, {
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
    });
  }

  async checkRedisHealth(): Promise<'ok' | 'error'> {
    const redis = this.getRedisConnection();
    try {
      const status = await redis.ping();
      return status === 'PONG' ? 'ok' : 'error';
    } catch (err) {
      return 'error';
    } finally {
      // Use disconnect() to immediately close the connection
      await redis.disconnect();
    }
  }

  async checkWorkerHealth() {
    const redisStatus = await this.checkRedisHealth();
    return {
      status: redisStatus === 'ok' ? 'ok' : 'error',
      services: {
        worker: redisStatus === 'ok' ? 'ok' : 'down',
        redis: redisStatus,
      },
    };
  }

  async checkPdfHealth() {
    const pdfServiceUrl = process.env.PDF_SERVICE_URL ?? 'http://pdf:8080';
    try {
      const response = await fetch(`${pdfServiceUrl}/health/pdf`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return { status: 'error', services: { pdf: 'down' } };
    } catch (err) {
      return { status: 'error', services: { pdf: 'down' } };
    }
  }
}
