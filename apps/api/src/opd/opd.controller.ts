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
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CORRELATION_ID_HEADER } from '../common/correlation-id.middleware';
import { getTenantId } from '../common/tenant-context';
import { Permission } from '../rbac/permissions';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { OpdService } from './opd.service';

@ApiTags('OPD Billing', 'OPD Doctors', 'OPD Encounters', 'OPD Commands')
@Controller('opd')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class OpdController {
  constructor(private readonly svc: OpdService) {}

  private resolveTenantId(req: Request): string {
    return getTenantId(req) ?? (req as any).user.tenantId;
  }

  // ─── Providers ─────────────────────────────────────────────────────────────

  // ─── OPD KMVP Doctors ──────────────────────────────────────────────────────

  @Get('doctors')
  @RequirePermissions(Permission.OPD_ENCOUNTER_READ)
  listDoctors(@Req() req: Request, @Query() q: any) {
    return this.svc.listDoctors(this.resolveTenantId(req), q);
  }

  @Get('doctors/:doctorId')
  @RequirePermissions(Permission.OPD_ENCOUNTER_READ)
  getDoctor(@Req() req: Request, @Param('doctorId') doctorId: string) {
    return this.svc.getDoctor(this.resolveTenantId(req), doctorId);
  }

  @Post('doctors')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MODULE_ADMIN)
  createDoctor(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createDoctor(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Patch('doctors/:doctorId')
  @RequirePermissions(Permission.MODULE_ADMIN)
  updateDoctor(
    @Req() req: Request,
    @Param('doctorId') doctorId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.updateDoctor(this.resolveTenantId(req), doctorId, body, user.userId, correlationId);
  }

  @Get('doctors/:doctorId/schedules')
  @RequirePermissions(Permission.OPD_ENCOUNTER_READ)
  listCanonicalSchedules(@Req() req: Request, @Param('doctorId') doctorId: string, @Query() q: any) {
    return this.svc.listCanonicalSchedules(this.resolveTenantId(req), doctorId, q);
  }

  @Get('doctors/:doctorId/slots')
  @RequirePermissions(Permission.OPD_ENCOUNTER_READ)
  getDoctorSlots(@Req() req: Request, @Param('doctorId') doctorId: string, @Query('date') date: string) {
    return this.svc.getDoctorSlots(this.resolveTenantId(req), doctorId, date);
  }

  @Post('doctors/:doctorId/schedules')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MODULE_ADMIN)
  createCanonicalSchedule(
    @Req() req: Request,
    @Param('doctorId') doctorId: string,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createCanonicalSchedule(this.resolveTenantId(req), doctorId, body, user.userId, correlationId);
  }

  @Get('canonical-appointments')
  @RequirePermissions(Permission.OPD_ENCOUNTER_READ)
  listCanonicalAppointments(@Req() req: Request, @Query() q: any) {
    return this.svc.listCanonicalAppointments(this.resolveTenantId(req), q);
  }

  @Post('canonical-appointments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.OPD_ENCOUNTER_MANAGE)
  createCanonicalAppointment(@Req() req: Request, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.createCanonicalAppointment(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('canonical-appointments/:appointmentId:check-in')
  @RequirePermissions(Permission.OPD_INTAKE_WRITE)
  checkInCanonicalAppointment(@Req() req: Request, @Param('appointmentId') appointmentId: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.transitionCanonicalAppointment(this.resolveTenantId(req), appointmentId, 'CHECKED_IN', user.userId, body, correlationId);
  }

  @Post('canonical-appointments/:appointmentId:cancel')
  @RequirePermissions(Permission.OPD_ENCOUNTER_MANAGE)
  cancelCanonicalAppointment(@Req() req: Request, @Param('appointmentId') appointmentId: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.transitionCanonicalAppointment(this.resolveTenantId(req), appointmentId, 'CANCELLED', user.userId, body, correlationId);
  }

  @Post('canonical-appointments/:appointmentId:reschedule')
  @RequirePermissions(Permission.OPD_ENCOUNTER_MANAGE)
  rescheduleCanonicalAppointment(@Req() req: Request, @Param('appointmentId') appointmentId: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.rescheduleCanonicalAppointment(this.resolveTenantId(req), appointmentId, body, user.userId, correlationId);
  }

  @Post('canonical-appointments/:appointmentId:no-show')
  @RequirePermissions(Permission.OPD_ENCOUNTER_MANAGE)
  noShowCanonicalAppointment(@Req() req: Request, @Param('appointmentId') appointmentId: string, @Body() body: any, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    const user = (req as any).user;
    return this.svc.transitionCanonicalAppointment(this.resolveTenantId(req), appointmentId, 'NO_SHOW', user.userId, body, correlationId);
  }

  // ─── OPD KMVP Encounters + Commands ───────────────────────────────────────

  @Get('encounters')
  @RequirePermissions(Permission.OPD_ENCOUNTER_READ)
  listEncounters(@Req() req: Request, @Query() q: any) {
    return this.svc.listEncounters(this.resolveTenantId(req), q);
  }

  @Get('encounters/queue')
  @RequirePermissions(Permission.OPD_ENCOUNTER_READ)
  listEncounterQueue(@Req() req: Request, @Query() q: any) {
    return this.svc.listEncounterQueue(this.resolveTenantId(req), q);
  }

  @Get('encounters/:encounterId')
  @RequirePermissions(Permission.OPD_ENCOUNTER_READ)
  getEncounter(@Req() req: Request, @Param('encounterId') encounterId: string) {
    return this.svc.getEncounter(this.resolveTenantId(req), encounterId);
  }

  @Post('commands/createRegistration')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.OPD_ENCOUNTER_MANAGE)
  createRegistration(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.createRegistration(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/recordIntake')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_INTAKE_WRITE)
  recordIntake(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.recordIntake(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/publishPrescription')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_PRESCRIPTION_PUBLISH)
  publishPrescription(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.publishPrescription(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/signNote')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_CLINICAL_NOTE_SIGN)
  signNote(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.signNote(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/saveDraftNote')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_CLINICAL_NOTE_WRITE)
  saveDraftNote(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.saveDraftNote(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/requestNoteAmendment')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_CLINICAL_NOTE_WRITE)
  requestNoteAmendment(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.requestNoteAmendment(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/approveNoteAmendment')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MODULE_ADMIN)
  approveNoteAmendment(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.approveNoteAmendment(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/startConsultation')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_CLINICAL_NOTE_WRITE)
  startConsultation(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.startConsultation(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/finalizeEncounter')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_ENCOUNTER_MANAGE)
  finalizeEncounter(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.finalizeEncounter(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/cancelEncounter')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_ENCOUNTER_MANAGE)
  cancelEncounter(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.cancelEncounter(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Post('commands/generateReceipt')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.OPD_DOCUMENT_GENERATE)
  generateEncounterReceipt(
    @Req() req: Request,
    @Body() body: any,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    const user = (req as any).user;
    return this.svc.generateEncounterReceipt(this.resolveTenantId(req), body, user.userId, correlationId);
  }

  @Get('encounters/:encounterId/prescription')
  @RequirePermissions(Permission.OPD_DOCUMENT_READ)
  getEncounterPrescription(@Req() req: Request, @Param('encounterId') encounterId: string) {
    return this.svc.getEncounterPrescriptionDocument(this.resolveTenantId(req), encounterId);
  }

  @Get('encounters/:encounterId/prescription/file')
  @RequirePermissions(Permission.OPD_DOCUMENT_READ)
  async downloadEncounterPrescription(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const tenantId = this.resolveTenantId(req);
    const { document, bytes } = await this.svc.downloadEncounterPrescriptionDocument(tenantId, encounterId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="opd-prescription-${document.id}.pdf"`);
    return new StreamableFile(bytes);
  }

  @Get('encounters/:encounterId/receipt')
  @RequirePermissions(Permission.OPD_DOCUMENT_READ)
  getEncounterReceipt(@Req() req: Request, @Param('encounterId') encounterId: string) {
    return this.svc.getEncounterReceiptDocument(this.resolveTenantId(req), encounterId);
  }

  @Get('encounters/:encounterId/receipt/file')
  @RequirePermissions(Permission.OPD_DOCUMENT_READ)
  async downloadEncounterReceipt(
    @Req() req: Request,
    @Param('encounterId') encounterId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const tenantId = this.resolveTenantId(req);
    const { document, bytes } = await this.svc.downloadEncounterReceiptDocument(tenantId, encounterId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="opd-receipt-${document.id}.pdf"`);
    return new StreamableFile(bytes);
  }

}
