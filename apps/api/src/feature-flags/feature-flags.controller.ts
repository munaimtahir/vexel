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
@Controller('feature-flags')
@ApiBearerAuth()
export class FeatureFlagsController {
  constructor(private readonly svc: FeatureFlagsService) {}

  /** Feature flag definitions (typed registry) — all non-deprecated flags with metadata.
   *  Used by Admin UI to render structured sections with status badges. */
  @Get('definitions')
  @UseGuards(JwtAuthGuard)
  getDefinitions() {
    return this.svc.getDefinitions();
  }

  /** Resolved flags for current tenant — JWT auth only, no special permission required.
   *  Used by Operator/Admin UI for feature gating (sidebar, button visibility). */
  @Get('resolved')
  @UseGuards(JwtAuthGuard)
  getResolvedFlags(@Req() req: Request) {
    const user = (req as any).user;
    return this.svc.getResolvedFlags(user.tenantId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FEATURE_FLAG_READ)
  listFlags(@Req() req: Request) {
    const user = (req as any).user;
    return this.svc.listForTenant(user.tenantId);
  }

  @Put(':key')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.FEATURE_FLAG_SET)
  setFlag(
    @Req() req: Request,
    @Param('key') key: string,
    @Body() body: { enabled: boolean; variantJson?: string },
    @Headers(CORRELATION_ID_HEADER) cid?: string,
  ) {
    const user = (req as any).user;
    if (body.variantJson) {
      const variant = JSON.parse(body.variantJson);
      return this.svc.setVariantForTenant(user.tenantId, key, variant, user.userId, cid);
    }
    return this.svc.setForTenant(user.tenantId, [{ key, enabled: body.enabled }], user.userId, cid);
  }
}
