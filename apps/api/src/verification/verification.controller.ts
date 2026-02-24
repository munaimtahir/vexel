import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { VerificationService } from './verification.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';
import { getTenantId } from '../common/tenant-context';

@ApiTags('Verification')
@Controller('verification')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class VerificationController {
  constructor(private readonly svc: VerificationService) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  @Get('encounters/pending')
  @RequirePermissions(Permission.RESULT_VERIFY)
  getVerificationQueue(@Req() req: Request, @Query() q: any) {
    return this.svc.getVerificationQueue(this.resolveTenantId(req), {
      search: q.search,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Get('encounters/:encounterId')
  @RequirePermissions(Permission.RESULT_VERIFY)
  getEncounterVerificationDetail(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
  ) {
    return this.svc.getEncounterVerificationDetail(this.resolveTenantId(req), encounterId);
  }

  @Post('encounters/:encounterId\\:verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.RESULT_VERIFY)
  verifyEncounter(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.verifyEncounter(
      this.resolveTenantId(req),
      user.userId,
      encounterId,
      correlationId,
    );
  }
}
