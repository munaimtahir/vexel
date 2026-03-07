import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { TemplatesService } from './templates.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';

@ApiTags('Templates')
@Controller('admin/templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TemplatesController {
  constructor(private readonly svc: TemplatesService) {}

  @Get()
  @RequirePermissions(Permission.TEMPLATES_READ)
  list(@Req() req: Request, @Query() q: any) {
    return this.svc.listTemplates((req as any).user.tenantId, q);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.TEMPLATES_WRITE)
  create(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createTemplate(user.tenantId, user.userId, correlationId ?? '', body);
  }

  @Get(':id')
  @RequirePermissions(Permission.TEMPLATES_READ)
  getOne(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getTemplate((req as any).user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TEMPLATES_WRITE)
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.updateTemplate(user.tenantId, id, user.userId, correlationId ?? '', body);
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.TEMPLATES_WRITE)
  clone(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.cloneTemplate(user.tenantId, id, user.userId, correlationId ?? '', body);
  }

  @Post(':id/new-version')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.TEMPLATES_WRITE)
  newVersion(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createNewVersion(user.tenantId, id, user.userId, correlationId ?? '');
  }

  @Post(':id/activate')
  @RequirePermissions(Permission.TEMPLATES_WRITE)
  activate(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.activateTemplate(user.tenantId, id, user.userId, correlationId ?? '');
  }

  @Post(':id/archive')
  @RequirePermissions(Permission.TEMPLATES_WRITE)
  archive(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.archiveTemplate(user.tenantId, id, user.userId, correlationId ?? '');
  }

  @Post(':id/preview')
  @RequirePermissions(Permission.TEMPLATES_READ)
  async preview(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
    @Res() res?: Response,
  ) {
    const user = (req as any).user;
    const pdfBytes = await this.svc.previewTemplate(
      user.tenantId,
      id,
      user.userId,
      correlationId ?? '',
      body?.samplePayload,
    );
    res!.setHeader('Content-Type', 'application/pdf');
    res!.setHeader('Content-Disposition', 'inline; filename="template-preview.pdf"');
    res!.setHeader('Content-Length', pdfBytes.length);
    res!.send(pdfBytes);
  }
}

@ApiTags('Templates')
@Controller('admin/template-blueprints')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TemplateBlueprintsController {
  constructor(private readonly svc: TemplatesService) {}

  @Get()
  @RequirePermissions(Permission.TEMPLATES_READ)
  listBlueprints() {
    return this.svc.listBlueprints();
  }

  @Post('provision-defaults')
  @RequirePermissions(Permission.TEMPLATES_PROVISION)
  provisionDefaults(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.provisionDefaults(user.tenantId, user.userId, correlationId ?? '', body ?? {});
  }
}

@ApiTags('Templates')
@Controller(['admin/catalog/tests', 'catalog/tests'])
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TestTemplateMapsController {
  constructor(private readonly svc: TemplatesService) {}

  @Get(':testId/templates')
  @RequirePermissions(Permission.TEMPLATES_READ)
  getMappings(@Req() req: Request, @Param('testId') testId: string) {
    return this.svc.getTestMappings((req as any).user.tenantId, testId);
  }

  @Put(':testId/templates')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.TEMPLATES_WRITE)
  setMappings(
    @Req() req: Request,
    @Param('testId') testId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.setTestMappings(user.tenantId, testId, user.userId, correlationId ?? '', body);
  }
}
