import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { Permission } from '../rbac/permissions';
import { getTenantId } from '../common/tenant-context';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@RequirePermissions(Permission.REPORTS_READ)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  @Get('registrations')
  getRegistrations(@Req() req: Request, @Query() q: any) {
    return this.svc.getRegistrationsReport(this.resolveTenantId(req), {
      from: q.from,
      to: q.to,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Get('patient-history/:patientId')
  getPatientHistory(@Req() req: Request, @Param('patientId') patientId: string) {
    return this.svc.getPatientHistory(this.resolveTenantId(req), patientId);
  }

  @Get('worklist-status')
  getWorklistStatus(@Req() req: Request) {
    return this.svc.getWorklistStatusReport(this.resolveTenantId(req));
  }

  @Get('encounter-timeline/:encounterId')
  getEncounterTimeline(@Req() req: Request, @Param('encounterId') encounterId: string) {
    return this.svc.getEncounterTimeline(this.resolveTenantId(req), encounterId);
  }

  @Get('staff-activity')
  getStaffActivity(@Req() req: Request, @Query() q: any) {
    return this.svc.getStaffActivityReport(this.resolveTenantId(req), {
      actorUserId: q.actorUserId,
      from: q.from,
      to: q.to,
    });
  }

  @Get('exceptions')
  getExceptions(@Req() req: Request, @Query() q: any) {
    return this.svc.getExceptionsReport(this.resolveTenantId(req), { from: q.from, to: q.to });
  }

  @Get('financial/daily-collection')
  getDailyCollection(@Req() req: Request, @Query('date') date: string) {
    return this.svc.getDailyCollectionReport(this.resolveTenantId(req), date ?? new Date().toISOString());
  }

  @Get('financial/outstanding-dues')
  getOutstandingDues(@Req() req: Request) {
    return this.svc.getOutstandingDuesReport(this.resolveTenantId(req));
  }

  @Get('financial/discounts')
  getDiscounts(@Req() req: Request, @Query() q: any) {
    return this.svc.getDiscountsReport(this.resolveTenantId(req), { from: q.from, to: q.to });
  }
}
