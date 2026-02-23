import {
  Controller, Get, Post, Patch, Put, Param, Body,
  Query, UseGuards, HttpCode, HttpStatus, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { TenantsService } from './tenants.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(
    private readonly svc: TenantsService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Get()
  @RequirePermissions(Permission.TENANT_READ)
  listTenants(@Query() q: any) { return this.svc.list(q); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.TENANT_CREATE)
  createTenant(
    @Req() req: Request, @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) cid?: string,
  ) {
    return this.svc.create(body, (req as any).user.userId, cid);
  }

  @Get(':id')
  @RequirePermissions(Permission.TENANT_READ)
  getTenant(@Param('id') id: string) { return this.svc.getById(id); }

  @Patch(':id')
  @RequirePermissions(Permission.TENANT_UPDATE)
  updateTenant(
    @Req() req: Request, @Param('id') id: string, @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) cid?: string,
  ) {
    return this.svc.update(id, body, (req as any).user.userId, cid);
  }

  @Get(':id/config')
  @RequirePermissions(Permission.BRANDING_READ)
  getConfig(@Param('id') id: string) { return this.svc.getConfig(id); }

  @Patch(':id/config')
  @RequirePermissions(Permission.BRANDING_WRITE)
  updateConfig(
    @Req() req: Request, @Param('id') id: string, @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) cid?: string,
  ) {
    return this.svc.updateConfig(id, body, (req as any).user.userId, cid);
  }

  @Get(':id/feature-flags')
  @RequirePermissions(Permission.FEATURE_FLAG_READ)
  getTenantFeatureFlags(@Param('id') id: string) {
    return this.featureFlags.listForTenant(id);
  }

  @Put(':id/feature-flags')
  @RequirePermissions(Permission.FEATURE_FLAG_SET)
  setTenantFeatureFlags(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { flags: Array<{ key: string; enabled: boolean }> },
    @Headers(CORRELATION_ID_HEADER) cid?: string,
  ) {
    return this.featureFlags.setForTenant(id, body.flags, (req as any).user.userId, cid);
  }
}
