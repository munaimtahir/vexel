import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const APPOINTMENT_TRANSITIONS: Record<string, string[]> = {
  BOOKED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const VISIT_TRANSITIONS: Record<string, string[]> = {
  REGISTERED: ['WAITING', 'CANCELLED'],
  WAITING: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function parseDateOrThrow(value: any, field: string): Date {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new ConflictException(`Invalid ${field}`);
  return d;
}

function toIsoOrNull(v: any) {
  return v ? new Date(v).toISOString() : null;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertOpdEnabled(tenantId: string) {
    const flag = await (this.prisma as any).tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key: 'module.opd' } },
    });
    if (!flag?.enabled) throw new ForbiddenException('module.opd feature is disabled for this tenant');
  }

  private async getAppointmentOrThrow(tenantId: string, appointmentId: string) {
    const row = await (this.prisma as any).appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        patient: true,
        provider: true,
        opdVisits: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('OPD appointment not found');
    return row;
  }

  private async getVisitOrThrow(tenantId: string, visitId: string) {
    const row = await (this.prisma as any).oPDVisit.findFirst({
      where: { id: visitId, tenantId },
      include: {
        patient: true,
        provider: true,
        appointment: true,
        encounter: true,
      },
    });
    if (!row) throw new NotFoundException('OPD visit not found');
    return row;
  }

  private async assertAppointmentSlotAvailable(
    tenantId: string,
    providerId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeId?: string,
  ) {
    const provider = await (this.prisma as any).provider.findFirst({
      where: { id: providerId, tenantId, isActive: true },
    });
    if (!provider) throw new NotFoundException('OPD provider not found');

    const weekday = scheduledAt.getUTCDay();
    const hh = String(scheduledAt.getUTCHours()).padStart(2, '0');
    const mm = String(scheduledAt.getUTCMinutes()).padStart(2, '0');
    const time = `${hh}:${mm}`;
    const schedule = await (this.prisma as any).providerSchedule.findFirst({
      where: {
        tenantId,
        providerId,
        weekday,
        isActive: true,
        startTime: { lte: time },
        endTime: { gt: time },
      },
    });
    if (!schedule) throw new ConflictException('Provider unavailable for requested slot');

    const start = scheduledAt;
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const sameDayStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0));
    const sameDayEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 23, 59, 59, 999));
    const existing = await (this.prisma as any).appointment.findMany({
      where: {
        tenantId,
        providerId,
        scheduledAt: { gte: sameDayStart, lte: sameDayEnd },
        status: { in: ['BOOKED', 'CHECKED_IN', 'IN_CONSULTATION'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, scheduledAt: true, durationMinutes: true },
    });
    for (const a of existing) {
      const aStart = new Date(a.scheduledAt);
      const aEnd = new Date(aStart.getTime() + Number(a.durationMinutes ?? 15) * 60000);
      if (start < aEnd && aStart < end) throw new ConflictException('Scheduling conflict');
    }
  }

  private mapAppointment(row: any) {
    const visit = row.opdVisits?.[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      patientId: row.patientId,
      providerId: row.providerId,
      visitId: visit?.id ?? null,
      encounterId: visit?.encounterId ?? null,
      scheduledAt: row.scheduledAt,
      durationMinutes: row.durationMinutes ?? null,
      reason: row.reason ?? null,
      status: row.status,
      cancelledReason: row.cancelledReason ?? null,
      notes: row.notes ?? null,
      createdBy: row.bookedById ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapVisit(row: any) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      patientId: row.patientId,
      providerId: row.providerId ?? null,
      appointmentId: row.appointmentId ?? null,
      encounterId: row.encounterId ?? null,
      visitNumber: row.visitCode ?? null,
      status: row.status,
      registeredAt: row.createdAt ?? null,
      waitingAt: toIsoOrNull(row.waitingAt),
      consultationStartedAt: toIsoOrNull(row.consultationStartedAt),
      completedAt: toIsoOrNull(row.completedAt),
      cancelledReason: row.cancelledReason ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private assertCanTransition(kind: 'appointment' | 'visit', from: string, to: string) {
    const table = kind === 'appointment' ? APPOINTMENT_TRANSITIONS : VISIT_TRANSITIONS;
    if (!(table[from] ?? []).includes(to)) {
      throw new ConflictException(`Invalid ${kind} transition ${from} -> ${to}`);
    }
  }

  async listAppointments(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const where: any = { tenantId };
    if (q?.providerId) where.providerId = q.providerId;
    if (q?.patientId) where.patientId = q.patientId;
    if (q?.status) where.status = q.status;
    if (q?.visitId) where.opdVisits = { some: { id: q.visitId, tenantId } };
    if (q?.scheduledFrom || q?.scheduledTo) {
      where.scheduledAt = {};
      if (q.scheduledFrom) where.scheduledAt.gte = new Date(q.scheduledFrom);
      if (q.scheduledTo) where.scheduledAt.lte = new Date(q.scheduledTo);
    }
    if (q?.search) {
      const s = String(q.search);
      where.OR = [
        { patient: { mrn: { contains: s, mode: 'insensitive' } } },
        { patient: { firstName: { contains: s, mode: 'insensitive' } } },
        { patient: { lastName: { contains: s, mode: 'insensitive' } } },
        { appointmentCode: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      (this.prisma as any).appointment.findMany({
        where,
        include: { opdVisits: { take: 1, orderBy: { createdAt: 'desc' } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
      (this.prisma as any).appointment.count({ where }),
    ]);
    return {
      data: rows.map((r: any) => this.mapAppointment(r)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createAppointment(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    const scheduledAt = parseDateOrThrow(body?.scheduledAt, 'scheduledAt');
    const durationMinutes = Number(body?.durationMinutes ?? 15);
    const patient = await (this.prisma as any).patient.findFirst({ where: { id: body?.patientId, tenantId } });
    if (!patient) throw new NotFoundException('Patient not found');
    await this.assertAppointmentSlotAvailable(tenantId, body?.providerId, scheduledAt, durationMinutes);

    const created = await (this.prisma as any).appointment.create({
      data: {
        tenantId,
        patientId: body.patientId,
        providerId: body.providerId,
        scheduledAt,
        durationMinutes,
        reason: body?.reason ?? null,
        notes: body?.notes ?? null,
        status: 'BOOKED',
        bookedById: actorUserId,
      },
      include: { opdVisits: { take: 1 } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.appointment.create',
      entityType: 'Appointment',
      entityId: created.id,
      after: body,
      correlationId,
    });
    return this.mapAppointment(created);
  }

  async getAppointment(tenantId: string, appointmentId: string) {
    await this.assertOpdEnabled(tenantId);
    return this.mapAppointment(await this.getAppointmentOrThrow(tenantId, appointmentId));
  }

  private async updateAppointmentState(
    tenantId: string,
    appointmentId: string,
    actorUserId: string,
    action: string,
    nextStatus: string,
    data: Record<string, any>,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const appt = await this.getAppointmentOrThrow(tenantId, appointmentId);
    this.assertCanTransition('appointment', appt.status, nextStatus);
    const updated = await (this.prisma as any).appointment.update({
      where: { id: appointmentId },
      data: { status: nextStatus, ...data },
      include: { opdVisits: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action,
      entityType: 'Appointment',
      entityId: appointmentId,
      before: { status: appt.status },
      after: { status: nextStatus, ...data },
      correlationId,
    });
    return this.mapAppointment(updated);
  }

  async rescheduleAppointment(
    tenantId: string,
    appointmentId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const appt = await this.getAppointmentOrThrow(tenantId, appointmentId);
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status)) {
      throw new ConflictException('Terminal states cannot be rescheduled');
    }
    const scheduledAt = parseDateOrThrow(body?.scheduledAt, 'scheduledAt');
    const durationMinutes = body?.durationMinutes == null
      ? Number(appt.durationMinutes ?? 15)
      : Number(body.durationMinutes);
    await this.assertAppointmentSlotAvailable(tenantId, appt.providerId, scheduledAt, durationMinutes, appointmentId);
    const updated = await (this.prisma as any).appointment.update({
      where: { id: appointmentId },
      data: {
        scheduledAt,
        durationMinutes,
        ...(body?.reason !== undefined ? { reason: body.reason } : {}),
      },
      include: { opdVisits: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.appointment.reschedule',
      entityType: 'Appointment',
      entityId: appointmentId,
      before: { scheduledAt: appt.scheduledAt, durationMinutes: appt.durationMinutes, status: appt.status },
      after: { scheduledAt, durationMinutes, status: appt.status },
      correlationId,
    });
    return this.mapAppointment(updated);
  }

  async checkInAppointment(tenantId: string, appointmentId: string, actorUserId: string, correlationId?: string) {
    return this.updateAppointmentState(
      tenantId,
      appointmentId,
      actorUserId,
      'opd.appointment.check_in',
      'CHECKED_IN',
      { checkedInAt: new Date() },
      correlationId,
    );
  }

  async startAppointmentConsultation(
    tenantId: string,
    appointmentId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    return this.updateAppointmentState(
      tenantId,
      appointmentId,
      actorUserId,
      'opd.appointment.start_consultation',
      'IN_CONSULTATION',
      { consultationStartedAt: new Date() },
      correlationId,
    );
  }

  async completeAppointment(
    tenantId: string,
    appointmentId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    const appt = await this.updateAppointmentState(
      tenantId,
      appointmentId,
      actorUserId,
      'opd.appointment.complete',
      'COMPLETED',
      { completedAt: new Date() },
      correlationId,
    );
    if (body?.visitId) {
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'opd.appointment.complete.link_visit',
        entityType: 'Appointment',
        entityId: appointmentId,
        after: { visitId: body.visitId },
        correlationId,
      });
    }
    return appt;
  }

  async cancelAppointment(
    tenantId: string,
    appointmentId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    return this.updateAppointmentState(
      tenantId,
      appointmentId,
      actorUserId,
      'opd.appointment.cancel',
      'CANCELLED',
      { cancelledAt: new Date(), cancelledReason: body?.reason ?? null },
      correlationId,
    );
  }

  async markNoShowAppointment(tenantId: string, appointmentId: string, actorUserId: string, correlationId?: string) {
    return this.updateAppointmentState(
      tenantId,
      appointmentId,
      actorUserId,
      'opd.appointment.mark_no_show',
      'NO_SHOW',
      { noShowMarkedAt: new Date() },
      correlationId,
    );
  }

  async listVisits(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const where: any = { tenantId };
    if (q?.providerId) where.providerId = q.providerId;
    if (q?.patientId) where.patientId = q.patientId;
    if (q?.appointmentId) where.appointmentId = q.appointmentId;
    if (q?.status) where.status = q.status;
    if (q?.createdFrom || q?.createdTo) {
      where.createdAt = {};
      if (q.createdFrom) where.createdAt.gte = new Date(q.createdFrom);
      if (q.createdTo) where.createdAt.lte = new Date(q.createdTo);
    }
    if (q?.search) {
      const s = String(q.search);
      where.OR = [
        { patient: { mrn: { contains: s, mode: 'insensitive' } } },
        { patient: { firstName: { contains: s, mode: 'insensitive' } } },
        { patient: { lastName: { contains: s, mode: 'insensitive' } } },
        { visitCode: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      (this.prisma as any).oPDVisit.findMany({
        where,
        include: { patient: true, provider: true, appointment: true, encounter: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).oPDVisit.count({ where }),
    ]);
    return {
      data: rows.map((r: any) => this.mapVisit(r)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createVisit(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    const patient = await (this.prisma as any).patient.findFirst({ where: { id: body?.patientId, tenantId } });
    if (!patient) throw new NotFoundException('Patient not found');

    let appointment: any = null;
    if (body?.appointmentId) {
      appointment = await (this.prisma as any).appointment.findFirst({
        where: { id: body.appointmentId, tenantId },
      });
      if (!appointment) throw new NotFoundException('OPD appointment not found');
      if (appointment.patientId !== body.patientId) {
        throw new ConflictException('Appointment patientId mismatch');
      }
    }

    const providerId = body?.providerId ?? appointment?.providerId;
    if (!providerId) throw new ConflictException('providerId is required');
    const provider = await (this.prisma as any).provider.findFirst({ where: { id: providerId, tenantId } });
    if (!provider) throw new NotFoundException('OPD provider not found');

    let encounterId = body?.encounterId;
    if (encounterId) {
      const enc = await (this.prisma as any).encounter.findFirst({ where: { id: encounterId, tenantId } });
      if (!enc) throw new NotFoundException('Encounter not found');
      if (enc.moduleType !== 'OPD') throw new ConflictException('Encounter is not an OPD encounter');
      if (enc.patientId !== body.patientId) throw new ConflictException('Encounter patientId mismatch');
    } else {
      const enc = await (this.prisma as any).encounter.create({
        data: {
          tenantId,
          patientId: body.patientId,
          moduleType: 'OPD',
          status: 'registered',
        } as any,
      });
      encounterId = enc.id;
    }

    if (body?.appointmentId) {
      const existingByAppt = await (this.prisma as any).oPDVisit.findFirst({
        where: { tenantId, appointmentId: body.appointmentId },
      });
      if (existingByAppt) throw new ConflictException('Visit already exists for appointment');
    }
    const existingByEncounter = await (this.prisma as any).oPDVisit.findFirst({
      where: { tenantId, encounterId },
    });
    if (existingByEncounter) throw new ConflictException('Visit already exists for encounter');

    const visit = await (this.prisma as any).oPDVisit.create({
      data: {
        tenantId,
        encounterId,
        patientId: body.patientId,
        providerId,
        appointmentId: body?.appointmentId ?? null,
        chiefComplaint: body?.notes ?? null,
        status: 'REGISTERED',
        createdById: actorUserId,
      },
      include: { patient: true, provider: true, appointment: true, encounter: true },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.visit.create',
      entityType: 'OPDVisit',
      entityId: visit.id,
      after: { ...body, encounterId },
      correlationId,
    });
    return this.mapVisit(visit);
  }

  async getVisit(tenantId: string, visitId: string) {
    await this.assertOpdEnabled(tenantId);
    return this.mapVisit(await this.getVisitOrThrow(tenantId, visitId));
  }

  private async updateVisitState(
    tenantId: string,
    visitId: string,
    actorUserId: string,
    action: string,
    nextStatus: string,
    data: Record<string, any>,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const visit = await this.getVisitOrThrow(tenantId, visitId);
    this.assertCanTransition('visit', visit.status, nextStatus);
    const updated = await (this.prisma as any).oPDVisit.update({
      where: { id: visitId },
      data: { status: nextStatus, ...data },
      include: { patient: true, provider: true, appointment: true, encounter: true },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action,
      entityType: 'OPDVisit',
      entityId: visitId,
      before: { status: visit.status },
      after: { status: nextStatus, ...data },
      correlationId,
    });
    return this.mapVisit(updated);
  }

  async markVisitWaiting(tenantId: string, visitId: string, actorUserId: string, correlationId?: string) {
    return this.updateVisitState(
      tenantId,
      visitId,
      actorUserId,
      'opd.visit.mark_waiting',
      'WAITING',
      { waitingAt: new Date() },
      correlationId,
    );
  }

  async startVisitConsultation(tenantId: string, visitId: string, actorUserId: string, correlationId?: string) {
    return this.updateVisitState(
      tenantId,
      visitId,
      actorUserId,
      'opd.visit.start_consultation',
      'IN_CONSULTATION',
      { consultationStartedAt: new Date() },
      correlationId,
    );
  }

  async completeVisit(tenantId: string, visitId: string, actorUserId: string, correlationId?: string) {
    return this.updateVisitState(
      tenantId,
      visitId,
      actorUserId,
      'opd.visit.complete',
      'COMPLETED',
      { completedAt: new Date() },
      correlationId,
    );
  }

  async cancelVisit(tenantId: string, visitId: string, body: any, actorUserId: string, correlationId?: string) {
    return this.updateVisitState(
      tenantId,
      visitId,
      actorUserId,
      'opd.visit.cancel',
      'CANCELLED',
      { cancelledAt: new Date(), cancelledReason: body?.reason ?? null },
      correlationId,
    );
  }
}
