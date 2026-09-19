import { Controller, Get, Post, Param, Query, UseGuards, HttpCode, HttpStatus, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { JobsService } from './jobs.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  @Get()
  @RequirePermissions(Permission.JOB_READ)
  listJobs(@Req() req: Request, @Query() q: any) {
    const user = (req as any).user;
    return this.svc.list(q, { tenantId: user.tenantId, isSuperAdmin: user.isSuperAdmin });
  }

  @Get('failed')
  @RequirePermissions(Permission.JOB_READ)
  listFailed(@Req() req: Request, @Query() q: any) {
    const user = (req as any).user;
    return this.svc.listFailed(q, { tenantId: user.tenantId, isSuperAdmin: user.isSuperAdmin });
  }

  @Get('failed-count')
  @RequirePermissions(Permission.JOB_READ)
  getFailedCount(@Req() req: Request) {
    const user = (req as any).user;
    return this.svc.failedCount({ tenantId: user.tenantId, isSuperAdmin: user.isSuperAdmin });
  }

  @Post(':id\\:retry')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.JOB_RETRY)
  retryJob(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.retryJob(id, {
      tenantId: user.tenantId,
      actorUserId: user.userId,
      correlationId,
      isSuperAdmin: user.isSuperAdmin,
    });
  }
}
