import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@Controller('audit-events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AuditEventsController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  async list(
    @Req() req: Request,
    @Query('actorUserId') actorUserId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('correlationId') correlationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.svc.list({
      tenantId: (req as any).user.tenantId,
      actorUserId,
      entityType,
      entityId,
      action,
      correlationId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
    });
  }

  /** Platform-wide audit access is intentionally separate from tenant audit access. */
  @Get('platform')
  @RequirePermissions(Permission.ADMIN_AUDIT_READ)
  async listPlatform(
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('correlationId') correlationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if ((req as any).user?.isSuperAdmin !== true) {
      throw new ForbiddenException('Platform audit access requires super-admin');
    }
    return this.svc.list({
      tenantId,
      actorUserId,
      entityType,
      entityId,
      action,
      correlationId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
    });
  }
}
