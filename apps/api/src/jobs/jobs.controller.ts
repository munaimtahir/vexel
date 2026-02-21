import { Controller, Get, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobsService } from './jobs.service';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  @Get()
  listJobs(@Query() q: any) { return this.svc.list(q); }

  @Get('failed')
  listFailed(@Query() q: any) { return this.svc.listFailed(q); }

  @Get('failed-count')
  getFailedCount() { return this.svc.failedCount(); }

  @Post(':id\\:retry')
  @HttpCode(HttpStatus.OK)
  retryJob(@Param('id') id: string) { return this.svc.retry(id); }
}
