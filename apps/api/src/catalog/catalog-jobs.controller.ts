import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus, Req, Headers, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { CatalogJobsService } from './catalog-jobs.service';
import { CatalogImportExportService } from './catalog-import-export.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { Request } from 'express';
import { Response } from 'express';

@ApiTags('Catalog')
@Controller('catalog')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CatalogJobsController {
  constructor(
    private readonly svc: CatalogJobsService,
    private readonly importExportSvc: CatalogImportExportService,
  ) {}

  @Post('import-jobs')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  createImportJob(@Req() req: Request, @Body() payload: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.createImportJob(user.tenantId, payload, user.userId, correlationId ?? 'manual');
  }

  @Get('import-jobs')
  @RequirePermissions(Permission.CATALOG_READ)
  listImportJobs(@Req() req: Request, @Query() q: any) {
    return this.svc.listImportJobs((req as any).user.tenantId, q);
  }

  @Get('import-jobs/:id')
  @RequirePermissions(Permission.CATALOG_READ)
  getImportJob(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getImportJob((req as any).user.tenantId, id);
  }

  @Post('import-jobs/:id\\:validate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CATALOG_READ)
  validateImportJob(@Req() req: Request, @Param('id') id: string) {
    return this.svc.validateImportJob((req as any).user.tenantId, id);
  }

  @Post('import-jobs/:id\\:apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  applyImportJob(@Req() req: Request, @Param('id') id: string, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.applyImportJob(user.tenantId, id, user.userId, correlationId ?? 'manual');
  }

  @Get('import-jobs/:id/errors')
  @RequirePermissions(Permission.CATALOG_READ)
  getImportJobErrors(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getImportJobErrors((req as any).user.tenantId, id);
  }

  @Post('import-jobs/:id\\:retry')
  @RequirePermissions(Permission.JOB_RETRY)
  retryImportJob(@Req() req: Request, @Param('id') id: string, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.retryImportJob(user.tenantId, id, user.userId, correlationId ?? 'manual');
  }

  @Post('export-jobs')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CATALOG_MANAGE)
  createExportJob(@Req() req: Request, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.createExportJob(user.tenantId, user.userId, correlationId ?? 'manual');
  }

  @Get('export-jobs')
  @RequirePermissions(Permission.CATALOG_READ)
  listExportJobs(@Req() req: Request, @Query() q: any) {
    return this.svc.listExportJobs((req as any).user.tenantId, q);
  }

  @Get('export-jobs/:id')
  @RequirePermissions(Permission.CATALOG_READ)
  getExportJob(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getExportJob((req as any).user.tenantId, id);
  }

  @Get('export-jobs/:id/download')
  @RequirePermissions(Permission.CATALOG_READ)
  async downloadExportJob(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const tenantId = (req as any).user.tenantId;
    const job = await this.svc.getExportJob(tenantId, id);
    if (job.status !== 'completed') {
      res.status(HttpStatus.CONFLICT).json({ message: `Export job is not completed (current: ${job.status})` });
      return;
    }
    const buf = await this.importExportSvc.generateExportWorkbook(tenantId);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="catalog-export-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buf);
  }
}
