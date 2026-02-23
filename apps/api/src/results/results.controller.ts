import {
  Controller,
  Get,
  Post,
  Param,
  Body,
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
import { ResultsService } from './results.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';
import { getTenantId } from '../common/tenant-context';

@ApiTags('Results')
@Controller('results')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ResultsController {
  constructor(private readonly svc: ResultsService) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  @Get('tests/pending')
  @RequirePermissions(Permission.RESULT_ENTER)
  getPendingTests(@Req() req: Request, @Query() q: any) {
    return this.svc.getPendingTests(this.resolveTenantId(req), q);
  }

  @Get('tests/submitted')
  @RequirePermissions(Permission.RESULT_ENTER)
  getSubmittedTests(@Req() req: Request, @Query() q: any) {
    return this.svc.getSubmittedTests(this.resolveTenantId(req), q);
  }

  @Get('tests/:orderedTestId')
  @RequirePermissions(Permission.RESULT_ENTER)
  getOrderedTestDetail(
    @Req() req: Request,
    @Param('orderedTestId') orderedTestId: string,
  ) {
    return this.svc.getOrderedTestDetail(this.resolveTenantId(req), orderedTestId);
  }

  @Post('tests/:orderedTestId/save')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.RESULT_ENTER)
  saveResults(
    @Req() req: Request,
    @Param('orderedTestId') orderedTestId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.saveResults(
      this.resolveTenantId(req),
      user.userId,
      orderedTestId,
      body.values ?? [],
      correlationId,
    );
  }

  @Post('tests/:orderedTestId/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.RESULT_ENTER)
  submitResults(
    @Req() req: Request,
    @Param('orderedTestId') orderedTestId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.submitResults(
      this.resolveTenantId(req),
      user.userId,
      orderedTestId,
      correlationId,
    );
  }

  @Post('tests/:orderedTestId/submit-and-verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.RESULT_VERIFY)
  submitAndVerify(
    @Req() req: Request,
    @Param('orderedTestId') orderedTestId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.submitAndVerify(
      this.resolveTenantId(req),
      user.userId,
      orderedTestId,
      correlationId,
    );
  }
}
