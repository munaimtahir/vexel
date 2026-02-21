import {
  Controller, Get, Post, Patch, Param, Body, UseGuards,
  HttpCode, HttpStatus, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { RolesService } from './roles.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly svc: RolesService) {}

  @Get()
  @RequirePermissions(Permission.ROLE_READ)
  listRoles(@Req() req: Request) { return this.svc.list((req as any).user.tenantId); }

  @Get('permissions')
  @RequirePermissions(Permission.ROLE_READ)
  listPermissions() { return this.svc.listPermissions(); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ROLE_CREATE)
  createRole(
    @Req() req: Request, @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) cid?: string,
  ) {
    const user = (req as any).user;
    return this.svc.create(user.tenantId, body, user.userId, cid);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ROLE_UPDATE)
  updateRole(
    @Req() req: Request, @Param('id') id: string, @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) cid?: string,
  ) {
    const user = (req as any).user;
    return this.svc.update(user.tenantId, id, body, user.userId, cid);
  }
}
