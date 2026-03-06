import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { AccountService } from './account.service';

@ApiTags('Account')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('account/me')
  @RequirePermissions(Permission.ACCOUNT_PROFILE_READ_SELF)
  getMe(@Req() req: Request) {
    return this.accountService.getMe((req as any).user);
  }

  @Patch('account/me')
  @RequirePermissions(Permission.ACCOUNT_PROFILE_UPDATE_SELF)
  updateMe(
    @Req() req: Request,
    @Body() body: { displayName: string },
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.accountService.updateMe((req as any).user, body, correlationId);
  }

  @Post('account/change-password')
  @RequirePermissions(Permission.ACCOUNT_PASSWORD_CHANGE_SELF)
  changePassword(
    @Req() req: Request,
    @Body() body: { currentPassword: string; newPassword: string },
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.accountService.changePassword((req as any).user, body, correlationId);
  }

  @Get('admin/navigation')
  @RequirePermissions(Permission.ACCOUNT_PROFILE_READ_SELF)
  getAdminNavigation(@Req() req: Request) {
    return this.accountService.getAdminNavigationSummary((req as any).user);
  }

  @Get('admin/landing')
  @RequirePermissions(Permission.ACCOUNT_PROFILE_READ_SELF)
  getAdminLanding(@Req() req: Request) {
    return this.accountService.getAdminLanding((req as any).user);
  }
}
