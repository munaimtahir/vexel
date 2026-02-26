import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { DocumentsService } from './documents.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Post('receipt\\:generate')
  @RequirePermissions(Permission.DOCUMENT_GENERATE)
  async generateReceipt(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    const { sourceRef, sourceType, ...payload } = body;
    const result = await this.svc.generateDocument(
      user.tenantId,
      'RECEIPT',
      payload,
      sourceRef,
      sourceType,
      user.userId,
      correlationId ?? '',
    );
    return res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK).json(result.document);
  }

  @Post('report\\:generate')
  @RequirePermissions(Permission.DOCUMENT_GENERATE)
  async generateReport(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    if (body.encounterId) {
      const result = await this.svc.generateFromEncounter(
        user.tenantId,
        body.encounterId,
        user.userId,
        correlationId ?? '',
      );
      return res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK).json(result.document);
    }
    const { sourceRef, sourceType, ...payload } = body;
    const result = await this.svc.generateDocument(
      user.tenantId,
      'LAB_REPORT',
      payload,
      sourceRef,
      sourceType,
      user.userId,
      correlationId ?? '',
    );
    return res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK).json(result.document);
  }

  @Get()
  @RequirePermissions(Permission.DOCUMENT_GENERATE)
  list(@Req() req: Request, @Query() q: any) {
    return this.svc.listDocuments((req as any).user.tenantId, q);
  }

  @Get(':id')
  @RequirePermissions(Permission.DOCUMENT_GENERATE)
  getById(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getDocument((req as any).user.tenantId, id);
  }

  @Post(':id\\:publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.DOCUMENT_PUBLISH)
  publish(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.publishDocument(user.tenantId, id, user.userId, correlationId ?? '');
  }

  @Get(':id/download')
  @RequirePermissions(Permission.DOCUMENT_GENERATE)
  async download(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user.tenantId;
    return this.svc.downloadDocument(tenantId, id);
  }

  @Get(':id/render')
  @RequirePermissions(Permission.DOCUMENT_GENERATE)
  async renderOverride(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Query('format') format?: string,
  ) {
    const tenantId = (req as any).user.tenantId;
    const pdfBytes = await this.svc.renderWithFormatOverride(tenantId, id, format);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.send(pdfBytes);
  }
}
