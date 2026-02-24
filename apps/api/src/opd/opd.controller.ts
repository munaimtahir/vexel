import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { getTenantId } from '../common/tenant-context';
import { Permission } from '../rbac/permissions';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { OpdService } from './opd.service';

@ApiTags('OPD Providers', 'OPD Schedules', 'OPD Scheduling')
@Controller('opd')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class OpdController {
  constructor(private readonly svc: OpdService) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  @Get('providers')
  @RequirePermissions(Permission.MODULE_ADMIN)
  listProviders(@Req() req: Request, @Query() q: any) {
    return this.svc.listProviders(this.resolveTenantId(req), q);
  }

  @Post('providers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MODULE_ADMIN)
  createProvider(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createProvider(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Get('providers/:providerId')
  @RequirePermissions(Permission.MODULE_ADMIN)
  getProvider(@Req() req: Request, @Param('providerId') providerId: string) {
    return this.svc.getProvider(this.resolveTenantId(req), providerId);
  }

  @Patch('providers/:providerId')
  @RequirePermissions(Permission.MODULE_ADMIN)
  updateProvider(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.updateProvider(this.resolveTenantId(req), providerId, body, user.userId, correlationId);
  }

  @Get('providers/:providerId/schedules')
  @RequirePermissions(Permission.MODULE_ADMIN)
  listProviderSchedules(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Query() q: any,
  ) {
    return this.svc.listProviderSchedules(this.resolveTenantId(req), providerId, q);
  }

  @Post('providers/:providerId/schedules')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MODULE_ADMIN)
  createProviderSchedule(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createProviderSchedule(
      this.resolveTenantId(req),
      providerId,
      body,
      user.userId,
      correlationId,
    );
  }

  @Patch('providers/:providerId/schedules/:scheduleId')
  @RequirePermissions(Permission.MODULE_ADMIN)
  updateProviderSchedule(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.updateProviderSchedule(
      this.resolveTenantId(req),
      providerId,
      scheduleId,
      body,
      user.userId,
      correlationId,
    );
  }

  @Delete('providers/:providerId/schedules/:scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.MODULE_ADMIN)
  async deleteProviderSchedule(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Param('scheduleId') scheduleId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    await this.svc.deleteProviderSchedule(
      this.resolveTenantId(req),
      providerId,
      scheduleId,
      user.userId,
      correlationId,
    );
  }

  @Get('providers/:providerId/availability')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getProviderAvailability(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Query() q: any,
  ) {
    return this.svc.getProviderAvailability(this.resolveTenantId(req), providerId, q);
  }
}
