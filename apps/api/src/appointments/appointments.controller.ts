import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { getTenantId } from '../common/tenant-context';
import { Permission } from '../rbac/permissions';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { AppointmentsService } from './appointments.service';

@ApiTags('OPD Appointments', 'OPD Visits')
@Controller('opd')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  @Get('appointments')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  listAppointments(@Req() req: Request, @Query() q: any) {
    return this.svc.listAppointments(this.resolveTenantId(req), q);
  }

  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  createAppointment(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createAppointment(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Get('appointments/:appointmentId')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getAppointment(@Req() req: Request, @Param('appointmentId') appointmentId: string) {
    return this.svc.getAppointment(this.resolveTenantId(req), appointmentId);
  }

  @Post('appointments/:appointmentId\\:reschedule')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  rescheduleAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.rescheduleAppointment(this.resolveTenantId(req), appointmentId, body, user.userId, correlationId);
  }

  @Post('appointments/:appointmentId\\:check-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  checkInAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.checkInAppointment(this.resolveTenantId(req), appointmentId, user.userId, correlationId);
  }

  @Post('appointments/:appointmentId\\:start-consultation')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  startAppointmentConsultation(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.startAppointmentConsultation(this.resolveTenantId(req), appointmentId, user.userId, correlationId);
  }

  @Post('appointments/:appointmentId\\:complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  completeAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.completeAppointment(this.resolveTenantId(req), appointmentId, body, user.userId, correlationId);
  }

  @Post('appointments/:appointmentId\\:cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  cancelAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.cancelAppointment(this.resolveTenantId(req), appointmentId, body, user.userId, correlationId);
  }

  @Post('appointments/:appointmentId\\:mark-no-show')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  markNoShowAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.markNoShowAppointment(this.resolveTenantId(req), appointmentId, user.userId, correlationId);
  }

  @Get('visits')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  listVisits(@Req() req: Request, @Query() q: any) {
    return this.svc.listVisits(this.resolveTenantId(req), q);
  }

  @Post('visits')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  createVisit(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createVisit(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Get('visits/:visitId')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getVisit(@Req() req: Request, @Param('visitId') visitId: string) {
    return this.svc.getVisit(this.resolveTenantId(req), visitId);
  }

  @Post('visits/:visitId\\:mark-waiting')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  markVisitWaiting(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.markVisitWaiting(this.resolveTenantId(req), visitId, user.userId, correlationId);
  }

  @Post('visits/:visitId\\:start-consultation')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  startVisitConsultation(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.startVisitConsultation(this.resolveTenantId(req), visitId, user.userId, correlationId);
  }

  @Post('visits/:visitId\\:complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  completeVisit(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.completeVisit(this.resolveTenantId(req), visitId, user.userId, correlationId);
  }

  @Post('visits/:visitId\\:cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  cancelVisit(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.cancelVisit(this.resolveTenantId(req), visitId, body, user.userId, correlationId);
  }

  @Get('visits/:visitId/vitals')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  listVisitVitals(@Req() req: Request, @Param('visitId') visitId: string) {
    return this.svc.listVisitVitals(this.resolveTenantId(req), visitId);
  }

  @Post('visits/:visitId/vitals')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  recordVisitVitals(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.recordVisitVitals(this.resolveTenantId(req), visitId, body, user.userId, correlationId);
  }

  @Get('visits/:visitId/clinical-note')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getVisitClinicalNote(@Req() req: Request, @Param('visitId') visitId: string) {
    return this.svc.getVisitClinicalNote(this.resolveTenantId(req), visitId);
  }

  @Put('visits/:visitId/clinical-note')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  upsertVisitClinicalNote(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.upsertVisitClinicalNote(
      this.resolveTenantId(req),
      visitId,
      body,
      user.userId,
      correlationId,
    );
  }

  @Post('visits/:visitId/clinical-note\\:sign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  signVisitClinicalNote(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.signVisitClinicalNote(
      this.resolveTenantId(req),
      visitId,
      user.userId,
      correlationId,
    );
  }

  @Get('visits/:visitId/prescription')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getVisitPrescription(@Req() req: Request, @Param('visitId') visitId: string) {
    return this.svc.getVisitPrescription(this.resolveTenantId(req), visitId);
  }

  @Put('visits/:visitId/prescription')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  upsertVisitPrescription(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.upsertVisitPrescription(
      this.resolveTenantId(req),
      visitId,
      body,
      user.userId,
      correlationId,
    );
  }

  @Post('visits/:visitId/prescription\\:sign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  signVisitPrescription(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.signVisitPrescription(
      this.resolveTenantId(req),
      visitId,
      user.userId,
      correlationId,
    );
  }

  @Post('visits/:visitId/prescription\\:mark-printed')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  markVisitPrescriptionPrinted(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.markVisitPrescriptionPrinted(
      this.resolveTenantId(req),
      visitId,
      user.userId,
      correlationId,
    );
  }
}
