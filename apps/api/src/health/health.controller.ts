import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'API health check' })
  getHealth() {
    return {
      status: 'ok',
      version: '0.1.0',
      uptime: process.uptime(),
      services: { api: 'ok' },
    };
  }

  @Get('worker')
  @ApiOperation({ summary: 'Worker health check (proxied)' })
  getWorkerHealth() {
    // TODO: check Redis/BullMQ connectivity
    return { status: 'ok', services: { worker: 'ok', redis: 'unknown' } };
  }

  @Get('pdf')
  @ApiOperation({ summary: 'PDF service health check (proxied)' })
  getPdfHealth() {
    // TODO: proxy to PDF service
    return { status: 'ok', services: { pdf: 'ok' } };
  }
}
