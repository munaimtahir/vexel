import { Body, Controller, Put, Req, UseGuards, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { CatalogService } from './catalog.service';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';

@ApiTags('Catalog')
@Controller('admin/catalog/tests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CatalogAdminTopController {
  constructor(private readonly svc: CatalogService) {}

  @Put('top')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  setTopTests(
    @Req() req: Request,
    @Body() body: { testIds: string[] },
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.setTopTests(user.tenantId, body?.testIds ?? [], user.userId, correlationId);
  }
}
