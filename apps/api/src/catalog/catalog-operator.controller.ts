import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { CatalogService } from './catalog.service';

@ApiTags('Catalog')
@Controller('operator/catalog/tests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CatalogOperatorController {
  constructor(private readonly svc: CatalogService) {}

  @Get('search')
  @RequirePermissions(Permission.CATALOG_READ)
  searchTests(@Req() req: Request, @Query('q') q: string, @Query('limit') limit?: string) {
    return this.svc.searchTestsForOperator((req as any).user.tenantId, {
      q,
      limit: limit === undefined ? undefined : Number(limit),
    });
  }

  @Get('top')
  @RequirePermissions(Permission.CATALOG_READ)
  listTopTests(@Req() req: Request) {
    return this.svc.listTopTestsForOperator((req as any).user.tenantId);
  }
}
