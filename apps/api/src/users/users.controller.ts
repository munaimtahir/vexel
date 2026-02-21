import {
  Controller, Get, Post, Patch, Put, Param, Body,
  Query, UseGuards, HttpCode, HttpStatus, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { UsersService } from './users.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  @RequirePermissions(Permission.USER_READ)
  listUsers(@Req() req: Request, @Query() q: any) {
    const user = (req as any).user;
    return this.svc.list(user.tenantId, q);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.USER_CREATE)
  createUser(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.create(user.tenantId, body, user.userId, correlationId);
  }

  @Get(':id')
  @RequirePermissions(Permission.USER_READ)
  getUser(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getById((req as any).user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.USER_UPDATE)
  updateUser(
    @Req() req: Request, @Param('id') id: string, @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.update(user.tenantId, id, body, user.userId, correlationId);
  }

  @Get(':id/roles')
  @RequirePermissions(Permission.ROLE_READ)
  getUserRoles(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getRoles((req as any).user.tenantId, id);
  }

  @Put(':id/roles')
  @RequirePermissions(Permission.ROLE_ASSIGN)
  setUserRoles(
    @Req() req: Request, @Param('id') id: string, @Body() body: { roleIds: string[] },
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.setRoles(user.tenantId, id, body.roleIds, user.userId, user.isSuperAdmin, correlationId);
  }
}
