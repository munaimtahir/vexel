import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { OpsService } from './ops.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';

@ApiTags('Ops')
@Controller('ops')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class OpsController {
  constructor(private readonly svc: OpsService) {}

  private actor(req: Request): string {
    return (req as any).user?.userId ?? 'unknown';
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  @RequirePermissions(Permission.OPS_VIEW)
  getDashboard() {
    return this.svc.getDashboard();
  }

  // ─── Runs ──────────────────────────────────────────────────────────────────

  @Get('runs')
  @RequirePermissions(Permission.OPS_VIEW)
  listRuns(@Query() q: any) {
    return this.svc.listRuns(q);
  }

  @Get('runs/:id')
  @RequirePermissions(Permission.OPS_VIEW)
  getRun(@Param('id') id: string) {
    return this.svc.getRun(id);
  }

  @Get('runs/:id/logs')
  @RequirePermissions(Permission.OPS_VIEW)
  getRunLogs(
    @Param('id') id: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getRunLogs(id, offset ? Number(offset) : 0, limit ? Number(limit) : 200);
  }

  // ─── Backup Commands ──────────────────────────────────────────────────────

  @Post('backups/full\\:run')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(Permission.OPS_RUN_BACKUP)
  runFullBackup(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.triggerFullBackup(body ?? {}, this.actor(req), correlationId);
  }

  @Post('backups/tenant\\:export')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(Permission.OPS_EXPORT_TENANT)
  runTenantExport(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.triggerTenantExport(body, this.actor(req), correlationId);
  }

  // ─── Restore Commands ─────────────────────────────────────────────────────

  @Post('restores/full\\:dryRun')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(Permission.OPS_RESTORE)
  restoreDryRun(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.triggerRestoreDryRun(body, this.actor(req), correlationId);
  }

  @Post('restores/full\\:run')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(Permission.OPS_RESTORE)
  restoreRun(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.triggerRestoreRun(body, this.actor(req), correlationId);
  }

  // ─── Healthcheck ──────────────────────────────────────────────────────────

  @Post('healthcheck\\:run')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(Permission.OPS_RUN_BACKUP)
  runHealthcheck(
    @Req() req: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.triggerHealthcheck(this.actor(req), correlationId);
  }

  // ─── Schedules ────────────────────────────────────────────────────────────

  @Get('schedules')
  @RequirePermissions(Permission.OPS_VIEW)
  listSchedules() {
    return this.svc.listSchedules();
  }

  @Post('schedules\\:create')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.OPS_CONFIGURE_SCHEDULES)
  createSchedule(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.createSchedule(body, this.actor(req), correlationId);
  }

  @Post('schedules/:id\\:update')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPS_CONFIGURE_SCHEDULES)
  updateSchedule(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.updateSchedule(id, body, this.actor(req), correlationId);
  }

  @Post('schedules/:id\\:toggle')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPS_CONFIGURE_SCHEDULES)
  toggleSchedule(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { isEnabled: boolean },
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.toggleSchedule(id, body.isEnabled, this.actor(req), correlationId);
  }

  // ─── Storage Targets ──────────────────────────────────────────────────────

  @Get('storage-targets')
  @RequirePermissions(Permission.OPS_VIEW)
  listStorageTargets() {
    return this.svc.listStorageTargets();
  }

  @Post('storage-targets\\:create')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.OPS_CONFIGURE_STORAGE)
  createStorageTarget(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.createStorageTarget(body, this.actor(req), correlationId);
  }

  @Post('storage-targets/:id\\:update')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPS_CONFIGURE_STORAGE)
  updateStorageTarget(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.updateStorageTarget(id, body, this.actor(req), correlationId);
  }

  @Post('storage-targets/:id\\:toggle')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPS_CONFIGURE_STORAGE)
  toggleStorageTarget(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { isEnabled: boolean },
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.toggleStorageTarget(id, body.isEnabled, this.actor(req), correlationId);
  }

  @Post('storage-targets/:id\\:test')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPS_CONFIGURE_STORAGE)
  testStorageTarget(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.svc.testStorageTarget(id, this.actor(req), correlationId);
  }
}
