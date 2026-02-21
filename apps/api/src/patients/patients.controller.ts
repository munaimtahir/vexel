import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, HttpCode, HttpStatus, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { PatientsService } from './patients.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';
import { getTenantId } from '../common/tenant-context';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private readonly svc: PatientsService) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  @Get()
  @RequirePermissions(Permission.PATIENT_MANAGE)
  list(@Req() req: Request, @Query() q: any) {
    return this.svc.list(this.resolveTenantId(req), q);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.PATIENT_MANAGE)
  create(@Req() req: Request, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.create(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Get(':id')
  @RequirePermissions(Permission.PATIENT_MANAGE)
  getById(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getById(this.resolveTenantId(req), id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PATIENT_MANAGE)
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.update(this.resolveTenantId(req), id, body, user.userId, correlationId);
  }
}
