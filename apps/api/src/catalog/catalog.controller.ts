import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus, Req, Headers, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { CatalogService } from './catalog.service';
import { CatalogImportExportService } from './catalog-import-export.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request, Response } from 'express';

@ApiTags('Catalog')
@Controller('catalog')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CatalogController {
  constructor(
    private readonly svc: CatalogService,
    private readonly importExportSvc: CatalogImportExportService,
  ) {}

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

  @Get('tests/:testId/definition')
  @RequirePermissions(Permission.CATALOG_READ)
  getTestDefinition(@Req() req: Request, @Param('testId') testId: string) {
    return this.svc.getTestDefinition((req as any).user.tenantId, testId);
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
  addTestParameter(
    @Req() req: Request,
    @Param('testId') testId: string,
    @Body() b: { parameterId: string; ordering?: number; displayOrder?: number; isRequired?: boolean; unitOverride?: string | null },
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    const ordering = b.ordering ?? b.displayOrder ?? 0;
    return this.svc.addTestParameterMapping(user.tenantId, testId, b.parameterId, ordering, user.userId, correlationId, { displayOrder: b.displayOrder ?? ordering, isRequired: b.isRequired, unitOverride: b.unitOverride });
  }

  @Put('tests/:testId/parameters/bulk')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  bulkUpdateTestParameters(@Req() req: Request, @Param('testId') testId: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.bulkUpdateTestParameters(user.tenantId, testId, body, user.userId, correlationId);
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

  @Get('panels/:panelId/definition')
  @RequirePermissions(Permission.CATALOG_READ)
  getPanelDefinition(@Req() req: Request, @Param('panelId') panelId: string) {
    return this.svc.getPanelDefinition((req as any).user.tenantId, panelId);
  }

  @Patch('panels/:panelId')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  updatePanel(@Req() req: Request, @Param('panelId') panelId: string, @Body() b: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.updatePanel(user.tenantId, panelId, b, user.userId, correlationId);
  }

  @Get('panels/:panelId/tests')
  @RequirePermissions(Permission.CATALOG_READ)
  listPanelTests(@Req() req: Request, @Param('panelId') panelId: string) {
    return this.svc.listPanelTests((req as any).user.tenantId, panelId);
  }

  @Post('panels/:panelId/tests')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  addPanelTest(@Req() req: Request, @Param('panelId') panelId: string, @Body() b: { testId: string; ordering?: number; displayOrder?: number }, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    const ordering = b.ordering ?? b.displayOrder ?? 0;
    return this.svc.addPanelTestMapping(user.tenantId, panelId, b.testId, ordering, user.userId, correlationId, b.displayOrder ?? ordering);
  }

  @Put('panels/:panelId/tests/bulk')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  bulkUpdatePanelTests(@Req() req: Request, @Param('panelId') panelId: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.bulkUpdatePanelTests(user.tenantId, panelId, body, user.userId, correlationId);
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

  // ─── Templates & Import/Export ────────────────────────────────────────────

  @Get('templates/workbook.xlsx')
  @RequirePermissions(Permission.CATALOG_READ)
  async downloadWorkbookTemplate(@Res() res: Response) {
    const buf = await this.importExportSvc.generateWorkbookTemplate();
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="catalog-template.xlsx"');
    res.send(buf);
  }

  @Get('templates/parameters.csv')
  @RequirePermissions(Permission.CATALOG_READ)
  downloadParametersTemplate(@Res() res: Response) {
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="parameters-template.csv"');
    res.send(this.importExportSvc.generateParametersCsv());
  }

  @Get('templates/tests.csv')
  @RequirePermissions(Permission.CATALOG_READ)
  downloadTestsTemplate(@Res() res: Response) {
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="tests-template.csv"');
    res.send(this.importExportSvc.generateTestsCsv());
  }

  @Get('templates/test-parameters.csv')
  @RequirePermissions(Permission.CATALOG_READ)
  downloadTestParametersTemplate(@Res() res: Response) {
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="test-parameters-template.csv"');
    res.send(this.importExportSvc.generateTestParametersCsv());
  }

  @Get('templates/panels.csv')
  @RequirePermissions(Permission.CATALOG_READ)
  downloadPanelsTemplate(@Res() res: Response) {
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="panels-template.csv"');
    res.send(this.importExportSvc.generatePanelsCsv());
  }

  @Get('templates/panel-tests.csv')
  @RequirePermissions(Permission.CATALOG_READ)
  downloadPanelTestsTemplate(@Res() res: Response) {
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="panel-tests-template.csv"');
    res.send(this.importExportSvc.generatePanelTestsCsv());
  }

  @Post('import')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @UseInterceptors(FileInterceptor('file'))
  async importCatalog(@Req() req: Request, @UploadedFile() file: Express.Multer.File, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    const mode = body.mode ?? 'UPSERT_PATCH';
    const validate = body.validate === 'true';
    return this.importExportSvc.importFromWorkbook(user.tenantId, file.buffer, { mode, validate }, user.userId, correlationId);
  }

  @Get('export')
  @RequirePermissions(Permission.CATALOG_READ)
  async exportCatalog(@Req() req: Request, @Res() res: Response) {
    const buf = await this.importExportSvc.generateWorkbookTemplate();
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="catalog-export.xlsx"');
    res.send(buf);
  }
}
