import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus, Req, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { SampleCollectionService } from './sample-collection.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';
import { getTenantId } from '../common/tenant-context';

@ApiTags('Sample Collection')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SampleCollectionController {
  constructor(
    private readonly svc: SampleCollectionService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  @Get('sample-collection/worklist')
  @RequirePermissions(Permission.PATIENT_MANAGE)
  getWorklist(@Req() req: Request, @Query() q: any) {
    return this.svc.getWorklist(this.resolveTenantId(req), q);
  }

  @Post('encounters/:encounterId\\:collect-specimens')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  async collectSpecimens(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
    @Body() body: { specimenItemIds?: string[] },
  ) {
    const tenantId = this.resolveTenantId(req);
    const user = (req as any).user;
    const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
    const result = await this.svc.collectSpecimens(
      tenantId,
      user.userId,
      encounterId,
      body.specimenItemIds ?? [],
      correlationId,
    );
    // Auto-receive when receiveSeparate is disabled (single-click collect+receive)
    const receiveSeparate = await this.featureFlags.isEnabled(tenantId, 'lims.operator.sample.receiveSeparate.enabled');
    if (!receiveSeparate) {
      try {
        await this.svc.receiveSpecimens(tenantId, user.userId, encounterId, body.specimenItemIds ?? [], correlationId);
      } catch { /* non-fatal */ }
    }
    return result;
  }

  @Post('encounters/:encounterId\\:postpone-specimen')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  async postponeSpecimen(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
    @Body() body: { specimenItemId: string; reason: string },
  ) {
    const user = (req as any).user;
    const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
    return this.svc.postponeSpecimen(
      this.resolveTenantId(req),
      user.userId,
      encounterId,
      body.specimenItemId,
      body.reason,
      correlationId,
    );
  }

  @Post('encounters/:encounterId\\:receive-specimens')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  async receiveSpecimens(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
    @Body() body: { specimenItemIds?: string[] },
  ) {
    const tenantId = this.resolveTenantId(req);
    const enabled = await this.featureFlags.isEnabled(tenantId, 'lims.operator.sample.receiveSeparate.enabled');
    if (!enabled) throw new ForbiddenException('Feature lims.operator.sample.receiveSeparate.enabled is disabled');

    const user = (req as any).user;
    const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
    return this.svc.receiveSpecimens(
      tenantId,
      user.userId,
      encounterId,
      body.specimenItemIds ?? [],
      correlationId,
    );
  }
}
