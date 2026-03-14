import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

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
  @ApiOperation({ summary: 'Worker health check' })
  async getWorkerHealth() {
    return this.healthService.getWorkerHealth();
  }

  @Get('pdf')
  @ApiOperation({ summary: 'PDF service health check' })
  async getPdfHealth() {
    return this.healthService.getPdfHealth();
  }
}
