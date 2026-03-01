import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { OpdService } from './opd.service';

@ApiTags('OPD Providers', 'OPD Schedules', 'OPD Scheduling', 'OPD Appointments', 'OPD Visits', 'OPD Billing')
@Controller('opd')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class OpdController {
  constructor(private readonly svc: OpdService) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  // ─── Providers ─────────────────────────────────────────────────────────────

  @Get('providers')
  @RequirePermissions(Permission.MODULE_ADMIN)
  listProviders(@Req() req: Request, @Query() q: any) {
    return this.svc.listProviders(this.resolveTenantId(req), q);
  }

  @Post('providers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MODULE_ADMIN)
  createProvider(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createProvider(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Get('providers/:providerId')
  @RequirePermissions(Permission.MODULE_ADMIN)
  getProvider(@Req() req: Request, @Param('providerId') providerId: string) {
    return this.svc.getProvider(this.resolveTenantId(req), providerId);
  }

  @Patch('providers/:providerId')
  @RequirePermissions(Permission.MODULE_ADMIN)
  updateProvider(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.updateProvider(this.resolveTenantId(req), providerId, body, user.userId, correlationId);
  }

  @Delete('providers/:providerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.MODULE_ADMIN)
  async deleteProvider(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    await this.svc.deleteProvider(this.resolveTenantId(req), providerId, user.userId, correlationId);
  }

  // ─── Provider Schedules ────────────────────────────────────────────────────

  @Get('providers/:providerId/schedules')
  @RequirePermissions(Permission.MODULE_ADMIN)
  listProviderSchedules(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Query() q: any,
  ) {
    return this.svc.listProviderSchedules(this.resolveTenantId(req), providerId, q);
  }

  @Post('providers/:providerId/schedules')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MODULE_ADMIN)
  createProviderSchedule(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createProviderSchedule(
      this.resolveTenantId(req),
      providerId,
      body,
      user.userId,
      correlationId,
    );
  }

  @Patch('providers/:providerId/schedules/:scheduleId')
  @RequirePermissions(Permission.MODULE_ADMIN)
  updateProviderSchedule(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.updateProviderSchedule(
      this.resolveTenantId(req),
      providerId,
      scheduleId,
      body,
      user.userId,
      correlationId,
    );
  }

  @Delete('providers/:providerId/schedules/:scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.MODULE_ADMIN)
  async deleteProviderSchedule(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Param('scheduleId') scheduleId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    await this.svc.deleteProviderSchedule(
      this.resolveTenantId(req),
      providerId,
      scheduleId,
      user.userId,
      correlationId,
    );
  }

  // ─── Provider Availability ─────────────────────────────────────────────────

  @Get('providers/:providerId/availability')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getProviderAvailability(
    @Req() req: Request,
    @Param('providerId') providerId: string,
    @Query() q: any,
  ) {
    return this.svc.getProviderAvailability(this.resolveTenantId(req), providerId, q);
  }

  // ─── Appointments ──────────────────────────────────────────────────────────

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

  @Post('appointments/:appointmentId/reschedule')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  rescheduleAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.rescheduleAppointment(
      this.resolveTenantId(req),
      appointmentId,
      body,
      user.userId,
      correlationId,
    );
  }

  @Post('appointments/:appointmentId/check-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  checkInAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.checkInAppointment(
      this.resolveTenantId(req),
      appointmentId,
      user.userId,
      correlationId,
    );
  }

  @Post('appointments/:appointmentId/start-consultation')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  startAppointmentConsultation(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.startAppointmentConsultation(
      this.resolveTenantId(req),
      appointmentId,
      user.userId,
      correlationId,
    );
  }

  @Post('appointments/:appointmentId/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  completeAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.completeAppointment(
      this.resolveTenantId(req),
      appointmentId,
      user.userId,
      correlationId,
    );
  }

  @Post('appointments/:appointmentId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  cancelAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.cancelAppointment(
      this.resolveTenantId(req),
      appointmentId,
      body,
      user.userId,
      correlationId,
    );
  }

  @Post('appointments/:appointmentId/no-show')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  markNoShowAppointment(
    @Req() req: Request,
    @Param('appointmentId') appointmentId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.markNoShowAppointment(
      this.resolveTenantId(req),
      appointmentId,
      user.userId,
      correlationId,
    );
  }

  // ─── Visits ────────────────────────────────────────────────────────────────

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

  @Post('visits/:visitId/mark-waiting')
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

  @Post('visits/:visitId/start-consultation')
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

  @Post('visits/:visitId/complete')
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

  @Post('visits/:visitId/cancel')
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

  // ─── Vitals ────────────────────────────────────────────────────────────────

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

  // ─── Clinical Note ─────────────────────────────────────────────────────────

  @Get('visits/:visitId/clinical-note')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getClinicalNote(@Req() req: Request, @Param('visitId') visitId: string) {
    return this.svc.getClinicalNote(this.resolveTenantId(req), visitId);
  }

  @Put('visits/:visitId/clinical-note')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  upsertClinicalNote(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.upsertClinicalNote(this.resolveTenantId(req), visitId, body, user.userId, correlationId);
  }

  @Post('visits/:visitId/clinical-note/sign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  signClinicalNote(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.signClinicalNote(this.resolveTenantId(req), visitId, user.userId, correlationId);
  }

  // ─── Prescription ──────────────────────────────────────────────────────────

  @Get('visits/:visitId/prescription')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getPrescription(@Req() req: Request, @Param('visitId') visitId: string) {
    return this.svc.getPrescription(this.resolveTenantId(req), visitId);
  }

  @Put('visits/:visitId/prescription')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  upsertPrescription(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.upsertPrescription(this.resolveTenantId(req), visitId, body, user.userId, correlationId);
  }

  @Post('visits/:visitId/prescription/sign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  signPrescription(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.signPrescription(this.resolveTenantId(req), visitId, user.userId, correlationId);
  }

  @Post('visits/:visitId/prescription/mark-printed')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  markPrescriptionPrinted(
    @Req() req: Request,
    @Param('visitId') visitId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.markPrescriptionPrinted(this.resolveTenantId(req), visitId, user.userId, correlationId);
  }

  // ─── Billing / Invoices ────────────────────────────────────────────────────

  @Get('billing/invoices')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  listInvoices(@Req() req: Request, @Query() q: any) {
    return this.svc.listInvoices(this.resolveTenantId(req), q);
  }

  @Post('billing/invoices')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  createInvoice(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createInvoice(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Get('billing/invoices/:invoiceId')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  getInvoice(@Req() req: Request, @Param('invoiceId') invoiceId: string) {
    return this.svc.getInvoice(this.resolveTenantId(req), invoiceId);
  }

  @Get('billing/invoices/:invoiceId/payments')
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  listInvoicePayments(@Req() req: Request, @Param('invoiceId') invoiceId: string) {
    return this.svc.listInvoicePayments(this.resolveTenantId(req), invoiceId);
  }

  @Post('billing/invoices/:invoiceId/issue')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  issueInvoice(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.issueInvoice(this.resolveTenantId(req), invoiceId, user.userId, correlationId);
  }

  @Post('billing/invoices/:invoiceId/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  voidInvoice(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.voidInvoice(this.resolveTenantId(req), invoiceId, body, user.userId, correlationId);
  }

  @Post('billing/invoices/:invoiceId/payments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  recordPayment(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.recordPayment(this.resolveTenantId(req), invoiceId, body, user.userId, correlationId);
  }

  @Post('billing/invoices/:invoiceId/receipt')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ENCOUNTER_MANAGE)
  generateReceipt(
    @Req() req: Request,
    @Param('invoiceId') invoiceId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.generateReceipt(this.resolveTenantId(req), invoiceId, user.userId, correlationId);
  }
}
