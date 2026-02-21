import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { EncountersService } from './encounters.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';

@ApiTags('Encounters')
@Controller('encounters')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class EncountersController {
  constructor(private readonly svc: EncountersService) {}

  @Get()
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  list(@Req() req: Request, @Query() q: any) {
    return this.svc.list((req as any).user.tenantId, q);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  register(@Req() req: Request, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.register(user.tenantId, body, user.userId, correlationId);
  }

  @Get(':id')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getById(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getById((req as any).user.tenantId, id);
  }

  @Post(':id\\:order-lab')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  orderLab(@Req() req: Request, @Param('id') id: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.orderLab(user.tenantId, id, body, user.userId, correlationId);
  }

  @Post(':id\\:collect-specimen')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  collectSpecimen(@Req() req: Request, @Param('id') id: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.collectSpecimen(user.tenantId, id, body, user.userId, correlationId);
  }

  @Post(':id\\:result')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.RESULT_ENTER)
  enterResult(@Req() req: Request, @Param('id') id: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.enterResult(user.tenantId, id, body, user.userId, correlationId);
  }

  @Post(':id\\:verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.RESULT_VERIFY)
  verify(@Req() req: Request, @Param('id') id: string, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.verify(user.tenantId, id, user.userId, correlationId);
  }

  @Post(':id\\:cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  cancel(@Req() req: Request, @Param('id') id: string, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.cancel(user.tenantId, id, user.userId, correlationId);
  }
}
