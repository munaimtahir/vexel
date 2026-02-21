import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus, Req, Headers } from '@nestjs/common';
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

  // ─── Tests ────────────────────────────────────────────────────────────────

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

  @Get('tests/:testId/parameters')
  @RequirePermissions(Permission.CATALOG_READ)
  listTestParameters(@Req() req: Request, @Param('testId') testId: string) {
    return this.svc.listTestParameters((req as any).user.tenantId, testId);
  }

  @Post('tests/:testId/parameters')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  addTestParameter(@Req() req: Request, @Param('testId') testId: string, @Body() b: { parameterId: string; ordering?: number }, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.addTestParameterMapping(user.tenantId, testId, b.parameterId, b.ordering ?? 0, user.userId, correlationId);
  }

  @Delete('tests/:testId/parameters/:parameterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  removeTestParameter(@Req() req: Request, @Param('testId') testId: string, @Param('parameterId') parameterId: string, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.removeTestParameterMapping(user.tenantId, testId, parameterId, user.userId, correlationId);
  }

  // ─── Panels ───────────────────────────────────────────────────────────────

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

  @Get('panels/:panelId/tests')
  @RequirePermissions(Permission.CATALOG_READ)
  listPanelTests(@Req() req: Request, @Param('panelId') panelId: string) {
    return this.svc.listPanelTests((req as any).user.tenantId, panelId);
  }

  @Post('panels/:panelId/tests')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  addPanelTest(@Req() req: Request, @Param('panelId') panelId: string, @Body() b: { testId: string; ordering?: number }, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.addPanelTestMapping(user.tenantId, panelId, b.testId, b.ordering ?? 0, user.userId, correlationId);
  }

  @Delete('panels/:panelId/tests/:testId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  removePanelTest(@Req() req: Request, @Param('panelId') panelId: string, @Param('testId') testId: string, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.removePanelTestMapping(user.tenantId, panelId, testId, user.userId, correlationId);
  }

  // ─── Parameters ───────────────────────────────────────────────────────────

  @Get('parameters')
  @RequirePermissions(Permission.CATALOG_READ)
  listParameters(@Req() req: Request, @Query() q: any) {
    return this.svc.listParameters((req as any).user.tenantId, q);
  }

  @Post('parameters')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  createParameter(@Req() req: Request, @Body() b: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.createParameter(user.tenantId, b, user.userId, correlationId);
  }

  @Get('parameters/:id')
  @RequirePermissions(Permission.CATALOG_READ)
  getParameter(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getParameter((req as any).user.tenantId, id);
  }

  @Put('parameters/:id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  updateParameter(@Req() req: Request, @Param('id') id: string, @Body() b: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.updateParameter(user.tenantId, id, b, user.userId, correlationId);
  }

  // ─── Reference Ranges ─────────────────────────────────────────────────────

  @Get('reference-ranges')
  @RequirePermissions(Permission.CATALOG_READ)
  listReferenceRanges(@Req() req: Request, @Query() q: any) {
    return this.svc.listReferenceRanges((req as any).user.tenantId, q.parameterId, q);
  }

  @Post('reference-ranges')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  createReferenceRange(@Req() req: Request, @Body() b: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.createReferenceRange(user.tenantId, b, user.userId, correlationId);
  }

  @Put('reference-ranges/:id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  updateReferenceRange(@Req() req: Request, @Param('id') id: string, @Body() b: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.updateReferenceRange(user.tenantId, id, b, user.userId, correlationId);
  }

  @Delete('reference-ranges/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  deleteReferenceRange(@Req() req: Request, @Param('id') id: string, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.deleteReferenceRange(user.tenantId, id, user.userId, correlationId);
  }
}
