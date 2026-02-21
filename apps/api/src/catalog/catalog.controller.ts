import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { CatalogService } from './catalog.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';

@ApiTags('Catalog')
@Controller('catalog')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Get('tests')
  @RequirePermissions(Permission.CATALOG_READ)
  listTests(@Req() req: Request, @Query() q: any) {
    return this.svc.listTests((req as any).user.tenantId, q);
  }

  @Post('tests')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  createTest(@Req() req: Request, @Body() b: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.createTest(user.tenantId, b, user.userId, correlationId);
  }

  @Get('tests/:id')
  @RequirePermissions(Permission.CATALOG_READ)
  getTest(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getTest((req as any).user.tenantId, id);
  }

  @Patch('tests/:id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  updateTest(@Req() req: Request, @Param('id') id: string, @Body() b: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.updateTest(user.tenantId, id, b, user.userId, correlationId);
  }

  @Delete('tests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  deleteTest(@Req() req: Request, @Param('id') id: string, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.deleteTest(user.tenantId, id, user.userId, correlationId);
  }

  @Get('panels')
  @RequirePermissions(Permission.CATALOG_READ)
  listPanels(@Req() req: Request, @Query() q: any) {
    return this.svc.listPanels((req as any).user.tenantId, q);
  }

  @Post('panels')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  createPanel(@Req() req: Request, @Body() b: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.createPanel(user.tenantId, b, user.userId, correlationId);
  }
}
