import { Controller, Get, Put, Param, Body, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { FeatureFlagsService } from './feature-flags.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';

@ApiTags('FeatureFlags')
@Controller('tenants/:tenantId/feature-flags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class FeatureFlagsController {
  constructor(private readonly svc: FeatureFlagsService) {}

  @Get()
  @RequirePermissions(Permission.FEATURE_FLAG_READ)
  listFlags(@Req() req: Request) {
    const user = (req as any).user;
    return this.svc.listForTenant(user.tenantId);
  }

  @Put(':key')
  @RequirePermissions(Permission.FEATURE_FLAG_SET)
  setFlag(
    @Req() req: Request,
    @Param('key') key: string,
    @Body() body: { enabled: boolean },
    @Headers(CORRELATION_ID_HEADER) cid?: string,
  ) {
    const user = (req as any).user;
    return this.svc.setForTenant(user.tenantId, [{ key, enabled: body.enabled }], user.userId, cid);
  }
}
