import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { ImpersonationService } from './impersonation.service';

@ApiTags('Admin Impersonation')
@Controller('admin/impersonation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ImpersonationController {
  constructor(private readonly impersonation: ImpersonationService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.USER_READ)
  @ApiOperation({ summary: 'Start read-only impersonation session' })
  async start(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: { user_id: string; reason: string },
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    if (!body?.user_id) {
      throw new ForbiddenException('user_id is required');
    }

    const result = await this.impersonation.start(
      (req as any).user,
      { userId: body.user_id, reason: body.reason, correlationId },
      req,
      response,
    );

    return {
      session_id: result.sessionId,
      impersonated_user: result.impersonatedUser,
      mode: result.mode,
      expires_at: result.expiresAt,
    };
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.USER_READ)
  @ApiOperation({ summary: 'Stop impersonation session' })
  async stop(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.impersonation.stop((req as any).user, req, response, correlationId);
  }

  @Get('status')
  @RequirePermissions(Permission.USER_READ)
  @ApiOperation({ summary: 'Get impersonation status' })
  async status(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.impersonation.status((req as any).user, req);
    if (!result.active && (req as any).cookies?.[this.impersonation.getCookieName()]) {
      this.impersonation.clearCookie(response);
    }
    return result;
  }
}
