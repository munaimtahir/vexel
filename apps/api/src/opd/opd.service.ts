import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function parseBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new ConflictException(`Invalid time format '${value}', expected HH:mm`);
  }
  return h * 60 + m;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function buildCode(prefix: string, seq: number): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${prefix}-${yy}${mm}${dd}-${String(seq).padStart(3, '0')}`;
}

const APPOINTMENT_TERMINAL = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
const VISIT_TERMINAL = ['COMPLETED', 'CANCELLED'];

@Injectable()
export class OpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertOpdEnabled(tenantId: string) {
    const flag = await (this.prisma as any).tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key: 'module.opd' } },
    });
    if (!flag?.enabled) {
      throw new ForbiddenException('module.opd feature is disabled for this tenant');
    }
  }

  private async getProviderOrThrow(tenantId: string, providerId: string) {
    const provider = await (this.prisma as any).provider.findFirst({
      where: { id: providerId, tenantId },
    });
    if (!provider) throw new NotFoundException('OPD provider not found');
    return provider;
  }

  private mapProvider(provider: any) {
    return {
      id: provider.id,
      tenantId: provider.tenantId,
      code: provider.code ?? null,
      name: provider.displayName,
      title: provider.qualification ?? null,
      specialty: provider.specialty ?? null,
      consultationFee: provider.consultationFee != null ? Number(provider.consultationFee) : null,
      isActive: provider.isActive,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  private mapSchedule(schedule: any) {
    return {
      id: schedule.id,
      tenantId: schedule.tenantId,
      providerId: schedule.providerId,
      dayOfWeek: schedule.weekday,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      slotMinutes: schedule.slotMinutes,
      maxAppointments: null,
      location: null,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }

  private mapAppointment(a: any) {
    return {
      id: a.id,
      tenantId: a.tenantId,
      patientId: a.patientId,
      providerId: a.providerId,
      appointmentCode: a.appointmentCode ?? null,
      status: a.status,
      scheduledAt: a.scheduledAt,
      durationMinutes: a.durationMinutes,
      reason: a.reason ?? null,
      notes: a.notes ?? null,
      checkedInAt: a.checkedInAt ?? null,
      consultationStartedAt: a.consultationStartedAt ?? null,
      completedAt: a.completedAt ?? null,
      cancelledAt: a.cancelledAt ?? null,
      cancelledReason: a.cancelledReason ?? null,
      noShowMarkedAt: a.noShowMarkedAt ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  private mapVisit(v: any) {
    return {
      id: v.id,
      tenantId: v.tenantId,
      patientId: v.patientId,
      providerId: v.providerId ?? null,
      appointmentId: v.appointmentId ?? null,
      encounterId: v.encounterId,
      visitCode: v.visitCode ?? null,
      status: v.status,
      chiefComplaint: v.chiefComplaint ?? null,
      queueNumber: v.queueNumber ?? null,
      waitingAt: v.waitingAt ?? null,
      consultationStartedAt: v.consultationStartedAt ?? null,
      completedAt: v.completedAt ?? null,
      cancelledAt: v.cancelledAt ?? null,
      cancelledReason: v.cancelledReason ?? null,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  private mapVitals(v: any) {
    return {
      id: v.id,
      visitId: v.visitId,
      recordedAt: v.recordedAt,
      heightCm: v.heightCm != null ? Number(v.heightCm) : null,
      weightKg: v.weightKg != null ? Number(v.weightKg) : null,
      bmi: v.bmi != null ? Number(v.bmi) : null,
      temperatureC: v.temperatureC != null ? Number(v.temperatureC) : null,
      pulseBpm: v.pulseBpm ?? null,
      systolicBp: v.systolicBp ?? null,
      diastolicBp: v.diastolicBp ?? null,
      respiratoryRate: v.respiratoryRate ?? null,
      spo2Pct: v.spo2Pct != null ? Number(v.spo2Pct) : null,
      bloodGlucoseMgDl: v.bloodGlucoseMgDl != null ? Number(v.bloodGlucoseMgDl) : null,
      notes: v.notes ?? null,
    };
  }

  private mapClinicalNote(n: any) {
    return {
      id: n.id,
      tenantId: n.tenantId,
      visitId: n.visitId,
      providerId: n.providerId,
      status: n.status,
      subjectiveJson: n.subjectiveJson ?? null,
      objectiveJson: n.objectiveJson ?? null,
      assessmentJson: n.assessmentJson ?? null,
      planJson: n.planJson ?? null,
      diagnosisText: n.diagnosisText ?? null,
      signedAt: n.signedAt ?? null,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  }

  private mapPrescription(p: any) {
    return {
      id: p.id,
      tenantId: p.tenantId,
      visitId: p.visitId,
      providerId: p.providerId,
      status: p.status,
      notes: p.notes ?? null,
      items: (p.items ?? []).map((i: any) => ({
        id: i.id,
        sortOrder: i.sortOrder,
        medicationText: i.medicationText,
        dosageText: i.dosageText ?? null,
        frequencyText: i.frequencyText ?? null,
        durationText: i.durationText ?? null,
        instructions: i.instructions ?? null,
      })),
      signedAt: p.signedAt ?? null,
      printedAt: p.printedAt ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private mapInvoice(inv: any) {
    return {
      id: inv.id,
      tenantId: inv.tenantId,
      patientId: inv.patientId,
      visitId: inv.opdVisitId ?? null,
      appointmentId: inv.opdVisit?.appointmentId ?? null,
      invoiceCode: inv.invoiceCode ?? null,
      status: inv.status,
      currency: inv.currency,
      subtotalAmount: Number(inv.subtotalAmount),
      discountAmount: Number(inv.discountAmount),
      grandTotal: Number(inv.totalAmount),
      amountPaid: Number(inv.amountPaid),
      balanceDue: Number(inv.amountDue),
      issuedAt: inv.issuedAt ?? null,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      lines: (inv.lines ?? []).map((l: any) => ({
        id: l.id,
        sortOrder: l.sortOrder,
        lineType: l.lineType,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountAmount: Number(l.discountAmount),
        lineTotal: Number(l.lineTotal),
      })),
    };
  }

  private mapPayment(p: any) {
    return {
      id: p.id,
      tenantId: p.tenantId,
      invoiceId: p.invoiceId,
      paymentCode: p.paymentCode ?? null,
      status: p.status,
      method: p.method,
      amount: Number(p.amount),
      receivedAt: p.receivedAt,
      receivedById: p.receivedById ?? null,
      referenceNo: p.referenceNo ?? null,
      notes: p.notes ?? null,
    };
  }

  private async assertScheduleNoOverlap(
    tenantId: string,
    providerId: string,
    candidate: { weekday: number; startTime: string; endTime: string },
    excludeId?: string,
  ) {
    const startMin = timeToMinutes(candidate.startTime);
    const endMin = timeToMinutes(candidate.endTime);
    if (endMin <= startMin) throw new ConflictException('endTime must be after startTime');

    const existing = await (this.prisma as any).providerSchedule.findMany({
      where: {
        tenantId,
        providerId,
        weekday: candidate.weekday,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    for (const s of existing) {
      if (overlaps(startMin, endMin, timeToMinutes(s.startTime), timeToMinutes(s.endTime))) {
        throw new ConflictException('Overlapping provider schedule conflict');
      }
    }
  }

  // ─── Providers ────────────────────────────────────────────────────────────

  async listProviders(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const isActive = parseBool(q?.isActive);
    const search = typeof q?.search === 'string' ? q.search.trim() : '';
    const where: any = { tenantId };
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { specialty: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).provider.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).provider.count({ where }),
    ]);
    return {
      data: data.map((p: any) => this.mapProvider(p)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createProvider(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    try {
      const provider = await (this.prisma as any).provider.create({
        data: {
          tenantId,
          code: body?.code ?? null,
          displayName: body?.name,
          qualification: body?.title ?? null,
          specialty: body?.specialty ?? null,
          consultationFee: body?.consultationFee != null ? body.consultationFee : null,
          isActive: body?.isActive ?? true,
        },
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'opd.provider.create',
        entityType: 'Provider',
        entityId: provider.id,
        after: body,
        correlationId,
      });
      return this.mapProvider(provider);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Provider code conflict');
      throw err;
    }
  }

  async getProvider(tenantId: string, providerId: string) {
    await this.assertOpdEnabled(tenantId);
    return this.mapProvider(await this.getProviderOrThrow(tenantId, providerId));
  }

  async updateProvider(
    tenantId: string,
    providerId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const existing = await this.getProviderOrThrow(tenantId, providerId);
    try {
      const provider = await (this.prisma as any).provider.update({
        where: { id: providerId },
        data: {
          ...(body?.code !== undefined ? { code: body.code || null } : {}),
          ...(body?.name !== undefined ? { displayName: body.name } : {}),
          ...(body?.title !== undefined ? { qualification: body.title || null } : {}),
          ...(body?.specialty !== undefined ? { specialty: body.specialty || null } : {}),
          ...(body?.isActive !== undefined ? { isActive: !!body.isActive } : {}),
          ...(body?.consultationFee !== undefined ? { consultationFee: body.consultationFee ?? null } : {}),
        },
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'opd.provider.update',
        entityType: 'Provider',
        entityId: provider.id,
        before: this.mapProvider(existing),
        after: body,
        correlationId,
      });
      return this.mapProvider(provider);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Provider code conflict');
      throw err;
    }
  }

  async deleteProvider(
    tenantId: string,
    providerId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const provider = await this.getProviderOrThrow(tenantId, providerId);
    const activeAppointments = await (this.prisma as any).appointment.count({
      where: {
        tenantId,
        providerId,
        scheduledAt: { gte: new Date() },
        status: { in: ['BOOKED', 'CHECKED_IN', 'IN_CONSULTATION'] },
      },
    });
    if (activeAppointments > 0) {
      throw new ConflictException('Provider has active future appointments and cannot be deleted');
    }
    await (this.prisma as any).provider.delete({ where: { id: providerId } });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.provider.delete',
      entityType: 'Provider',
      entityId: providerId,
      before: this.mapProvider(provider),
      correlationId,
    });
  }

  // ─── Provider Schedules ───────────────────────────────────────────────────

  async listProviderSchedules(tenantId: string, providerId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    await this.getProviderOrThrow(tenantId, providerId);
    const isActive = parseBool(q?.isActive);
    const where: any = { tenantId, providerId };
    if (typeof isActive === 'boolean') where.isActive = isActive;
    const data = await (this.prisma as any).providerSchedule.findMany({
      where,
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    return { data: data.map((s: any) => this.mapSchedule(s)) };
  }

  async createProviderSchedule(
    tenantId: string,
    providerId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    await this.getProviderOrThrow(tenantId, providerId);
    await this.assertScheduleNoOverlap(tenantId, providerId, {
      weekday: Number(body.dayOfWeek),
      startTime: body.startTime,
      endTime: body.endTime,
    });
    try {
      const schedule = await (this.prisma as any).providerSchedule.create({
        data: {
          tenantId,
          providerId,
          weekday: Number(body.dayOfWeek),
          startTime: body.startTime,
          endTime: body.endTime,
          slotMinutes: Number(body.slotMinutes),
          isActive: body?.isActive ?? true,
        },
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'opd.provider_schedule.create',
        entityType: 'ProviderSchedule',
        entityId: schedule.id,
        after: body,
        correlationId,
      });
      return this.mapSchedule(schedule);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Overlapping schedule conflict for provider');
      throw err;
    }
  }

  async updateProviderSchedule(
    tenantId: string,
    providerId: string,
    scheduleId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    await this.getProviderOrThrow(tenantId, providerId);
    const existing = await (this.prisma as any).providerSchedule.findFirst({
      where: { id: scheduleId, tenantId, providerId },
    });
    if (!existing) throw new NotFoundException('Provider schedule not found');
    const next = {
      weekday: existing.weekday,
      startTime: body?.startTime ?? existing.startTime,
      endTime: body?.endTime ?? existing.endTime,
    };
    await this.assertScheduleNoOverlap(tenantId, providerId, next, scheduleId);
    const schedule = await (this.prisma as any).providerSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(body?.startTime !== undefined ? { startTime: body.startTime } : {}),
        ...(body?.endTime !== undefined ? { endTime: body.endTime } : {}),
        ...(body?.slotMinutes !== undefined ? { slotMinutes: Number(body.slotMinutes) } : {}),
        ...(body?.isActive !== undefined ? { isActive: !!body.isActive } : {}),
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.provider_schedule.update',
      entityType: 'ProviderSchedule',
      entityId: schedule.id,
      before: this.mapSchedule(existing),
      after: body,
      correlationId,
    });
    return this.mapSchedule(schedule);
  }

  async deleteProviderSchedule(
    tenantId: string,
    providerId: string,
    scheduleId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    await this.getProviderOrThrow(tenantId, providerId);
    const schedule = await (this.prisma as any).providerSchedule.findFirst({
      where: { id: scheduleId, tenantId, providerId },
    });
    if (!schedule) throw new NotFoundException('Provider schedule not found');

    const future = new Date();
    const appointments = await (this.prisma as any).appointment.findMany({
      where: {
        tenantId,
        providerId,
        scheduledAt: { gte: future },
        status: { in: ['BOOKED', 'CHECKED_IN', 'IN_CONSULTATION'] },
      },
      select: { id: true, scheduledAt: true },
      take: 100,
    });
    const sStart = timeToMinutes(schedule.startTime);
    const sEnd = timeToMinutes(schedule.endTime);
    const hasConflict = appointments.some((a: any) => {
      const dt = new Date(a.scheduledAt);
      const dow = dt.getDay();
      if (dow !== schedule.weekday) return false;
      const mins = dt.getHours() * 60 + dt.getMinutes();
      return mins >= sStart && mins < sEnd;
    });
    if (hasConflict) {
      throw new ConflictException('Schedule cannot be deleted due to booked appointments');
    }

    await (this.prisma as any).providerSchedule.delete({ where: { id: scheduleId } });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.provider_schedule.delete',
      entityType: 'ProviderSchedule',
      entityId: scheduleId,
      before: this.mapSchedule(schedule),
      correlationId,
    });
  }

  // ─── Provider Availability ────────────────────────────────────────────────

  async getProviderAvailability(tenantId: string, providerId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const provider = await this.getProviderOrThrow(tenantId, providerId);
    const fromDate = String(q?.fromDate ?? '');
    const toDate = String(q?.toDate ?? '');
    if (!fromDate || !toDate) throw new ConflictException('fromDate and toDate are required');
    const includeBooked = parseBool(q?.includeBooked) ?? true;

    const from = new Date(`${fromDate}T00:00:00.000Z`);
    const to = new Date(`${toDate}T23:59:59.999Z`);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
      throw new ConflictException('Invalid date range');
    }

    const schedules = await (this.prisma as any).providerSchedule.findMany({
      where: { tenantId, providerId, isActive: true },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    const appointments = await (this.prisma as any).appointment.findMany({
      where: {
        tenantId,
        providerId,
        scheduledAt: { gte: from, lte: to },
        status: { in: ['BOOKED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED'] },
      },
      select: { id: true, scheduledAt: true, durationMinutes: true },
    });

    const slots: any[] = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
      const dow = d.getUTCDay();
      const daySchedules = schedules.filter((s: any) => s.weekday === dow);
      for (const schedule of daySchedules) {
        const start = timeToMinutes(schedule.startTime);
        const end = timeToMinutes(schedule.endTime);
        for (let cursor = start; cursor + schedule.slotMinutes <= end; cursor += schedule.slotMinutes) {
          const slotStart = new Date(Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            Math.floor(cursor / 60),
            cursor % 60,
            0,
            0,
          ));
          const slotEnd = new Date(slotStart.getTime() + schedule.slotMinutes * 60000);
          const booking = appointments.find((a: any) => {
            const aStart = new Date(a.scheduledAt);
            const aEnd = new Date(aStart.getTime() + Number(a.durationMinutes ?? schedule.slotMinutes) * 60000);
            return slotStart < aEnd && aStart < slotEnd;
          });
          const slot = {
            providerId,
            startAt: slotStart.toISOString(),
            endAt: slotEnd.toISOString(),
            status: booking ? 'BOOKED' : 'AVAILABLE',
            scheduleId: schedule.id,
            appointmentId: booking?.id ?? null,
          };
          if (includeBooked || slot.status !== 'BOOKED') slots.push(slot);
        }
      }
    }

    return {
      provider: this.mapProvider(provider),
      fromDate,
      toDate,
      slots,
    };
  }

  // ─── Appointments ─────────────────────────────────────────────────────────

  async listAppointments(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const search = typeof q?.search === 'string' ? q.search.trim() : '';
    const where: any = { tenantId };
    if (q?.status) where.status = q.status;
    if (q?.providerId) where.providerId = q.providerId;
    if (q?.patientId) where.patientId = q.patientId;
    if (q?.fromDate || q?.toDate) {
      where.scheduledAt = {};
      if (q?.fromDate) where.scheduledAt.gte = new Date(`${q.fromDate}T00:00:00.000Z`);
      if (q?.toDate) where.scheduledAt.lte = new Date(`${q.toDate}T23:59:59.999Z`);
    }
    if (search) {
      where.OR = [
        { appointmentCode: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).appointment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
      (this.prisma as any).appointment.count({ where }),
    ]);
    return {
      data: data.map((a: any) => this.mapAppointment(a)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createAppointment(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);

    const patient = await (this.prisma as any).patient.findFirst({
      where: { id: body.patientId, tenantId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    if (body.providerId) {
      await this.getProviderOrThrow(tenantId, body.providerId);
    }

    const scheduledAt = new Date(body.scheduledAt);
    if (isNaN(scheduledAt.getTime())) throw new ConflictException('Invalid scheduledAt date');

    if (body.providerId) {
      const durationMinutes = Number(body.durationMinutes ?? 30);
      const slotEnd = new Date(scheduledAt.getTime() + durationMinutes * 60000);
      const conflicting = await (this.prisma as any).appointment.findFirst({
        where: {
          tenantId,
          providerId: body.providerId,
          status: { in: ['BOOKED', 'CHECKED_IN', 'IN_CONSULTATION'] },
          scheduledAt: { lt: slotEnd },
          AND: [{ scheduledAt: { gte: scheduledAt } }],
        },
      });
      if (conflicting) throw new ConflictException('Appointment slot already booked for this provider');
    }

    const seq = (await (this.prisma as any).appointment.count({ where: { tenantId } })) + 1;
    const appointmentCode = buildCode('APT', seq);

    const appointment = await (this.prisma as any).appointment.create({
      data: {
        tenantId,
        patientId: body.patientId,
        providerId: body.providerId ?? null,
        appointmentCode,
        status: 'BOOKED',
        scheduledAt,
        durationMinutes: Number(body.durationMinutes ?? 30),
        reason: body.reason ?? null,
        notes: body.notes ?? null,
        bookedById: actorUserId,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.appointment.create',
      entityType: 'Appointment',
      entityId: appointment.id,
      after: body,
      correlationId,
    });
    return this.mapAppointment(appointment);
  }

  async getAppointment(tenantId: string, appointmentId: string) {
    await this.assertOpdEnabled(tenantId);
    const a = await (this.prisma as any).appointment.findFirst({
      where: { id: appointmentId, tenantId },
    });
    if (!a) throw new NotFoundException('Appointment not found');
    return this.mapAppointment(a);
  }

  async rescheduleAppointment(
    tenantId: string,
    appointmentId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const a = await (this.prisma as any).appointment.findFirst({
      where: { id: appointmentId, tenantId },
    });
    if (!a) throw new NotFoundException('Appointment not found');
    if (!['BOOKED', 'CHECKED_IN'].includes(a.status)) {
      throw new ConflictException(`Appointment in status ${a.status} cannot be rescheduled`);
    }
    const scheduledAt = new Date(body.scheduledAt);
    if (isNaN(scheduledAt.getTime())) throw new ConflictException('Invalid scheduledAt date');

    const updated = await (this.prisma as any).appointment.update({
      where: { id: appointmentId },
      data: {
        scheduledAt,
        ...(body.durationMinutes != null ? { durationMinutes: Number(body.durationMinutes) } : {}),
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.appointment.reschedule',
      entityType: 'Appointment',
      entityId: appointmentId,
      before: this.mapAppointment(a),
      after: body,
      correlationId,
    });
    return this.mapAppointment(updated);
  }

  async checkInAppointment(
    tenantId: string,
    appointmentId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const a = await (this.prisma as any).appointment.findFirst({
      where: { id: appointmentId, tenantId },
    });
    if (!a) throw new NotFoundException('Appointment not found');
    if (a.status !== 'BOOKED') {
      throw new ConflictException(`Cannot check in appointment in status ${a.status}`);
    }
    const updated = await (this.prisma as any).appointment.update({
      where: { id: appointmentId },
      data: { status: 'CHECKED_IN', checkedInAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.appointment.check-in',
      entityType: 'Appointment',
      entityId: appointmentId,
      correlationId,
    });
    return this.mapAppointment(updated);
  }

  async startAppointmentConsultation(
    tenantId: string,
    appointmentId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const a = await (this.prisma as any).appointment.findFirst({
      where: { id: appointmentId, tenantId },
    });
    if (!a) throw new NotFoundException('Appointment not found');
    if (a.status !== 'CHECKED_IN') {
      throw new ConflictException(`Cannot start consultation for appointment in status ${a.status}`);
    }
    const updated = await (this.prisma as any).appointment.update({
      where: { id: appointmentId },
      data: { status: 'IN_CONSULTATION', consultationStartedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.appointment.start-consultation',
      entityType: 'Appointment',
      entityId: appointmentId,
      correlationId,
    });
    return this.mapAppointment(updated);
  }

  async completeAppointment(
    tenantId: string,
    appointmentId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const a = await (this.prisma as any).appointment.findFirst({
      where: { id: appointmentId, tenantId },
    });
    if (!a) throw new NotFoundException('Appointment not found');
    if (a.status !== 'IN_CONSULTATION') {
      throw new ConflictException(`Cannot complete appointment in status ${a.status}`);
    }
    const updated = await (this.prisma as any).appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.appointment.complete',
      entityType: 'Appointment',
      entityId: appointmentId,
      correlationId,
    });
    return this.mapAppointment(updated);
  }

  async cancelAppointment(
    tenantId: string,
    appointmentId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const a = await (this.prisma as any).appointment.findFirst({
      where: { id: appointmentId, tenantId },
    });
    if (!a) throw new NotFoundException('Appointment not found');
    if (APPOINTMENT_TERMINAL.includes(a.status)) {
      throw new ConflictException(`Appointment already in terminal status ${a.status}`);
    }
    const updated = await (this.prisma as any).appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledReason: body?.reason ?? null,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.appointment.cancel',
      entityType: 'Appointment',
      entityId: appointmentId,
      before: this.mapAppointment(a),
      after: body,
      correlationId,
    });
    return this.mapAppointment(updated);
  }

  async markNoShowAppointment(
    tenantId: string,
    appointmentId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const a = await (this.prisma as any).appointment.findFirst({
      where: { id: appointmentId, tenantId },
    });
    if (!a) throw new NotFoundException('Appointment not found');
    if (a.status !== 'BOOKED') {
      throw new ConflictException(`Cannot mark no-show for appointment in status ${a.status}`);
    }
    const updated = await (this.prisma as any).appointment.update({
      where: { id: appointmentId },
      data: { status: 'NO_SHOW', noShowMarkedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.appointment.no-show',
      entityType: 'Appointment',
      entityId: appointmentId,
      correlationId,
    });
    return this.mapAppointment(updated);
  }

  // ─── Visits ───────────────────────────────────────────────────────────────

  async listVisits(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const search = typeof q?.search === 'string' ? q.search.trim() : '';
    const where: any = { tenantId };
    if (q?.status) where.status = q.status;
    if (q?.providerId) where.providerId = q.providerId;
    if (q?.patientId) where.patientId = q.patientId;
    if (q?.appointmentId) where.appointmentId = q.appointmentId;
    if (search) {
      where.OR = [
        { visitCode: { contains: search, mode: 'insensitive' } },
        { chiefComplaint: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).oPDVisit.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).oPDVisit.count({ where }),
    ]);
    return {
      data: data.map((v: any) => this.mapVisit(v)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createVisit(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    const patient = await (this.prisma as any).patient.findFirst({
      where: { id: body.patientId, tenantId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    let encounterId = body.encounterId ?? null;
    if (!encounterId) {
      const encounter = await (this.prisma as any).encounter.create({
        data: {
          tenantId,
          patientId: body.patientId,
          moduleType: 'OPD',
          status: 'registered',
        },
      });
      encounterId = encounter.id;
    }

    const seq = (await (this.prisma as any).oPDVisit.count({ where: { tenantId } })) + 1;
    const visitCode = buildCode('VIS', seq);

    const visit = await (this.prisma as any).oPDVisit.create({
      data: {
        tenantId,
        patientId: body.patientId,
        providerId: body.providerId ?? null,
        appointmentId: body.appointmentId ?? null,
        encounterId,
        visitCode,
        status: 'REGISTERED',
        chiefComplaint: body.chiefComplaint ?? null,
        createdById: actorUserId,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.visit.create',
      entityType: 'OPDVisit',
      entityId: visit.id,
      after: body,
      correlationId,
    });
    return this.mapVisit(visit);
  }

  async getVisit(tenantId: string, visitId: string) {
    await this.assertOpdEnabled(tenantId);
    const v = await (this.prisma as any).oPDVisit.findFirst({
      where: { id: visitId, tenantId },
    });
    if (!v) throw new NotFoundException('OPD visit not found');
    return this.mapVisit(v);
  }

  private async getVisitOrThrow(tenantId: string, visitId: string) {
    const v = await (this.prisma as any).oPDVisit.findFirst({
      where: { id: visitId, tenantId },
    });
    if (!v) throw new NotFoundException('OPD visit not found');
    return v;
  }

  async markVisitWaiting(
    tenantId: string,
    visitId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const v = await this.getVisitOrThrow(tenantId, visitId);
    if (v.status !== 'REGISTERED') {
      throw new ConflictException(`Cannot mark waiting for visit in status ${v.status}`);
    }
    const updated = await (this.prisma as any).oPDVisit.update({
      where: { id: visitId },
      data: { status: 'WAITING', waitingAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.visit.mark-waiting',
      entityType: 'OPDVisit',
      entityId: visitId,
      correlationId,
    });
    return this.mapVisit(updated);
  }

  async startVisitConsultation(
    tenantId: string,
    visitId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const v = await this.getVisitOrThrow(tenantId, visitId);
    if (v.status !== 'WAITING') {
      throw new ConflictException(`Cannot start consultation for visit in status ${v.status}`);
    }
    const updated = await (this.prisma as any).oPDVisit.update({
      where: { id: visitId },
      data: { status: 'IN_CONSULTATION', consultationStartedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.visit.start-consultation',
      entityType: 'OPDVisit',
      entityId: visitId,
      correlationId,
    });
    return this.mapVisit(updated);
  }

  async completeVisit(
    tenantId: string,
    visitId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const v = await this.getVisitOrThrow(tenantId, visitId);
    if (v.status !== 'IN_CONSULTATION') {
      throw new ConflictException(`Cannot complete visit in status ${v.status}`);
    }
    const updated = await (this.prisma as any).oPDVisit.update({
      where: { id: visitId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.visit.complete',
      entityType: 'OPDVisit',
      entityId: visitId,
      correlationId,
    });
    return this.mapVisit(updated);
  }

  async cancelVisit(
    tenantId: string,
    visitId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const v = await this.getVisitOrThrow(tenantId, visitId);
    if (VISIT_TERMINAL.includes(v.status)) {
      throw new ConflictException(`Visit already in terminal status ${v.status}`);
    }
    const updated = await (this.prisma as any).oPDVisit.update({
      where: { id: visitId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledReason: body?.reason ?? null,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.visit.cancel',
      entityType: 'OPDVisit',
      entityId: visitId,
      before: this.mapVisit(v),
      after: body,
      correlationId,
    });
    return this.mapVisit(updated);
  }

  // ─── Vitals ───────────────────────────────────────────────────────────────

  async listVisitVitals(tenantId: string, visitId: string) {
    await this.assertOpdEnabled(tenantId);
    await this.getVisitOrThrow(tenantId, visitId);
    const data = await (this.prisma as any).oPDVitals.findMany({
      where: { visitId, tenantId },
      orderBy: { recordedAt: 'desc' },
    });
    return { data: data.map((v: any) => this.mapVitals(v)) };
  }

  async recordVisitVitals(
    tenantId: string,
    visitId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    await this.getVisitOrThrow(tenantId, visitId);

    let bmi: number | null = null;
    if (body.heightCm != null && body.weightKg != null) {
      const hM = Number(body.heightCm) / 100;
      bmi = Math.round((Number(body.weightKg) / (hM * hM)) * 10) / 10;
    }

    const vitals = await (this.prisma as any).oPDVitals.create({
      data: {
        tenantId,
        visitId,
        recordedAt: new Date(),
        heightCm: body.heightCm ?? null,
        weightKg: body.weightKg ?? null,
        bmi,
        temperatureC: body.temperatureC ?? null,
        pulseBpm: body.pulseBpm ?? null,
        systolicBp: body.systolicBp ?? null,
        diastolicBp: body.diastolicBp ?? null,
        respiratoryRate: body.respiratoryRate ?? null,
        spo2Pct: body.spo2Pct ?? null,
        bloodGlucoseMgDl: body.bloodGlucoseMgDl ?? null,
        notes: body.notes ?? null,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.vitals.record',
      entityType: 'OPDVitals',
      entityId: vitals.id,
      after: body,
      correlationId,
    });
    return this.mapVitals(vitals);
  }

  // ─── Clinical Note ────────────────────────────────────────────────────────

  async getClinicalNote(tenantId: string, visitId: string) {
    await this.assertOpdEnabled(tenantId);
    await this.getVisitOrThrow(tenantId, visitId);
    const note = await (this.prisma as any).oPDClinicalNote.findFirst({
      where: { visitId, tenantId },
    });
    if (!note) throw new NotFoundException('Clinical note not found');
    return this.mapClinicalNote(note);
  }

  async upsertClinicalNote(
    tenantId: string,
    visitId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    await this.getVisitOrThrow(tenantId, visitId);
    const existing = await (this.prisma as any).oPDClinicalNote.findFirst({
      where: { visitId, tenantId },
    });
    if (existing?.status === 'SIGNED') {
      throw new ConflictException('Clinical note is already signed and cannot be modified');
    }

    let note: any;
    if (existing) {
      note = await (this.prisma as any).oPDClinicalNote.update({
        where: { id: existing.id },
        data: {
          providerId: body.providerId ?? existing.providerId,
          subjectiveJson: body.subjectiveJson !== undefined ? body.subjectiveJson : existing.subjectiveJson,
          objectiveJson: body.objectiveJson !== undefined ? body.objectiveJson : existing.objectiveJson,
          assessmentJson: body.assessmentJson !== undefined ? body.assessmentJson : existing.assessmentJson,
          planJson: body.planJson !== undefined ? body.planJson : existing.planJson,
          diagnosisText: body.diagnosisText !== undefined ? body.diagnosisText : existing.diagnosisText,
        },
      });
    } else {
      note = await (this.prisma as any).oPDClinicalNote.create({
        data: {
          tenantId,
          visitId,
          providerId: body.providerId,
          status: 'DRAFT',
          subjectiveJson: body.subjectiveJson ?? null,
          objectiveJson: body.objectiveJson ?? null,
          assessmentJson: body.assessmentJson ?? null,
          planJson: body.planJson ?? null,
          diagnosisText: body.diagnosisText ?? null,
        },
      });
    }
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.clinical_note.upsert',
      entityType: 'OPDClinicalNote',
      entityId: note.id,
      after: body,
      correlationId,
    });
    return this.mapClinicalNote(note);
  }

  async signClinicalNote(
    tenantId: string,
    visitId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    await this.getVisitOrThrow(tenantId, visitId);
    const note = await (this.prisma as any).oPDClinicalNote.findFirst({
      where: { visitId, tenantId },
    });
    if (!note) throw new NotFoundException('Clinical note not found');
    if (note.status === 'SIGNED') {
      throw new ConflictException('Clinical note is already signed');
    }
    const updated = await (this.prisma as any).oPDClinicalNote.update({
      where: { id: note.id },
      data: { status: 'SIGNED', signedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.clinical_note.sign',
      entityType: 'OPDClinicalNote',
      entityId: note.id,
      correlationId,
    });
    return this.mapClinicalNote(updated);
  }

  // ─── Prescription ─────────────────────────────────────────────────────────

  async getPrescription(tenantId: string, visitId: string) {
    await this.assertOpdEnabled(tenantId);
    await this.getVisitOrThrow(tenantId, visitId);
    const rx = await (this.prisma as any).oPDPrescription.findFirst({
      where: { visitId, tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!rx) throw new NotFoundException('Prescription not found');
    return this.mapPrescription(rx);
  }

  async upsertPrescription(
    tenantId: string,
    visitId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    await this.getVisitOrThrow(tenantId, visitId);
    const existing = await (this.prisma as any).oPDPrescription.findFirst({
      where: { visitId, tenantId },
      include: { items: true },
    });
    if (existing && ['SIGNED', 'PRINTED'].includes(existing.status)) {
      throw new ConflictException(`Prescription is already ${existing.status} and cannot be modified`);
    }

    const items: any[] = (body.items ?? []).map((item: any, idx: number) => ({
      tenantId,
      sortOrder: idx + 1,
      medicationText: item.medicationText,
      dosageText: item.dosageText ?? null,
      frequencyText: item.frequencyText ?? null,
      durationText: item.durationText ?? null,
      instructions: item.instructions ?? null,
    }));

    let rx: any;
    if (existing) {
      await (this.prisma as any).oPDPrescriptionItem.deleteMany({
        where: { prescriptionId: existing.id },
      });
      rx = await (this.prisma as any).oPDPrescription.update({
        where: { id: existing.id },
        data: {
          providerId: body.providerId ?? existing.providerId,
          notes: body.notes !== undefined ? body.notes : existing.notes,
          items: { create: items },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    } else {
      rx = await (this.prisma as any).oPDPrescription.create({
        data: {
          tenantId,
          visitId,
          providerId: body.providerId,
          status: 'DRAFT',
          notes: body.notes ?? null,
          items: { create: items },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    }
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.prescription.upsert',
      entityType: 'OPDPrescription',
      entityId: rx.id,
      after: body,
      correlationId,
    });
    return this.mapPrescription(rx);
  }

  async signPrescription(
    tenantId: string,
    visitId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    await this.getVisitOrThrow(tenantId, visitId);
    const rx = await (this.prisma as any).oPDPrescription.findFirst({
      where: { visitId, tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!rx) throw new NotFoundException('Prescription not found');
    if (rx.status !== 'DRAFT') {
      throw new ConflictException(`Prescription is already ${rx.status}`);
    }
    const updated = await (this.prisma as any).oPDPrescription.update({
      where: { id: rx.id },
      data: { status: 'SIGNED', signedAt: new Date() },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.prescription.sign',
      entityType: 'OPDPrescription',
      entityId: rx.id,
      correlationId,
    });
    return this.mapPrescription(updated);
  }

  async markPrescriptionPrinted(
    tenantId: string,
    visitId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    await this.getVisitOrThrow(tenantId, visitId);
    const rx = await (this.prisma as any).oPDPrescription.findFirst({
      where: { visitId, tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!rx) throw new NotFoundException('Prescription not found');
    if (rx.status !== 'SIGNED') {
      throw new ConflictException(`Prescription must be SIGNED before marking printed; current status: ${rx.status}`);
    }
    const updated = await (this.prisma as any).oPDPrescription.update({
      where: { id: rx.id },
      data: { status: 'PRINTED', printedAt: new Date() },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.prescription.mark-printed',
      entityType: 'OPDPrescription',
      entityId: rx.id,
      correlationId,
    });
    return this.mapPrescription(updated);
  }

  // ─── Billing / Invoices ───────────────────────────────────────────────────

  async listInvoices(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const search = typeof q?.search === 'string' ? q.search.trim() : '';
    const where: any = { tenantId };
    if (q?.status) where.status = q.status;
    if (q?.patientId) where.patientId = q.patientId;
    if (q?.visitId) where.opdVisitId = q.visitId;
    if (search) {
      where.OR = [{ invoiceCode: { contains: search, mode: 'insensitive' } }];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { lines: { orderBy: { sortOrder: 'asc' } }, opdVisit: { select: { appointmentId: true } } },
      }),
      (this.prisma as any).invoice.count({ where }),
    ]);
    return {
      data: data.map((inv: any) => this.mapInvoice(inv)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createInvoice(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    const patient = await (this.prisma as any).patient.findFirst({
      where: { id: body.patientId, tenantId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const lines: any[] = (body.lines ?? []).map((l: any, idx: number) => ({
      tenantId,
      sortOrder: idx + 1,
      lineType: l.lineType ?? 'SERVICE',
      description: l.description,
      quantity: Number(l.quantity ?? 1),
      unitPrice: Number(l.unitPrice),
      discountAmount: Number(l.discountAmount ?? 0),
      lineTotal: Number(l.quantity ?? 1) * Number(l.unitPrice) - Number(l.discountAmount ?? 0),
    }));

    const subtotalAmount = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
    const discountAmount = lines.reduce((acc, l) => acc + Number(l.discountAmount), 0);
    const totalAmount = subtotalAmount - discountAmount;

    const seq = (await (this.prisma as any).invoice.count({ where: { tenantId } })) + 1;
    const invoiceCode = buildCode('INV', seq);

    const invoice = await (this.prisma as any).invoice.create({
      data: {
        tenantId,
        patientId: body.patientId,
        opdVisitId: body.visitId ?? null,
        invoiceCode,
        status: 'DRAFT',
        currency: body.currency ?? 'PKR',
        subtotalAmount,
        discountAmount,
        totalAmount,
        amountPaid: 0,
        amountDue: totalAmount,
        createdById: actorUserId,
        lines: { create: lines },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, opdVisit: { select: { appointmentId: true } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.invoice.create',
      entityType: 'Invoice',
      entityId: invoice.id,
      after: body,
      correlationId,
    });
    return this.mapInvoice(invoice);
  }

  async getInvoice(tenantId: string, invoiceId: string) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, opdVisit: { select: { appointmentId: true } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return this.mapInvoice(inv);
  }

  async listInvoicePayments(tenantId: string, invoiceId: string) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    const data = await (this.prisma as any).payment.findMany({
      where: { invoiceId, tenantId },
      orderBy: { receivedAt: 'desc' },
    });
    return { data: data.map((p: any) => this.mapPayment(p)) };
  }

  async issueInvoice(
    tenantId: string,
    invoiceId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, opdVisit: { select: { appointmentId: true } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status !== 'DRAFT') {
      throw new ConflictException(`Invoice cannot be issued from status ${inv.status}`);
    }
    const updated = await (this.prisma as any).invoice.update({
      where: { id: invoiceId },
      data: { status: 'ISSUED', issuedAt: new Date() },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, opdVisit: { select: { appointmentId: true } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.invoice.issue',
      entityType: 'Invoice',
      entityId: invoiceId,
      correlationId,
    });
    return this.mapInvoice(updated);
  }

  async voidInvoice(
    tenantId: string,
    invoiceId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, opdVisit: { select: { appointmentId: true } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'PAID') throw new ConflictException('Paid invoice cannot be voided');
    if (inv.status === 'VOID') throw new ConflictException('Invoice is already voided');
    const updated = await (this.prisma as any).invoice.update({
      where: { id: invoiceId },
      data: { status: 'VOID', voidedAt: new Date(), voidReason: body?.reason ?? null },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, opdVisit: { select: { appointmentId: true } } },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.invoice.void',
      entityType: 'Invoice',
      entityId: invoiceId,
      before: this.mapInvoice(inv),
      after: body,
      correlationId,
    });
    return this.mapInvoice(updated);
  }

  async recordPayment(
    tenantId: string,
    invoiceId: string,
    body: any,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (!['ISSUED', 'PARTIALLY_PAID'].includes(inv.status)) {
      throw new ConflictException(`Cannot record payment for invoice in status ${inv.status}`);
    }
    const amount = Number(body.amount);
    if (amount <= 0) throw new ConflictException('Payment amount must be positive');

    const seq = (await (this.prisma as any).payment.count({ where: { tenantId } })) + 1;
    const paymentCode = buildCode('PAY', seq);

    const payment = await (this.prisma as any).payment.create({
      data: {
        tenantId,
        invoiceId,
        paymentCode,
        status: 'POSTED',
        method: body.method,
        amount,
        receivedAt: new Date(),
        receivedById: actorUserId,
        referenceNo: body.referenceNo ?? null,
        note: body.notes ?? null,
      },
    });

    const newAmountPaid = Number(inv.amountPaid) + amount;
    const newAmountDue = Number(inv.totalAmount) - newAmountPaid;
    const newStatus = newAmountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    await (this.prisma as any).invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: newAmountPaid, amountDue: Math.max(0, newAmountDue), status: newStatus },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.payment.record',
      entityType: 'Payment',
      entityId: payment.id,
      after: body,
      correlationId,
    });
    return this.mapPayment(payment);
  }

  async generateReceipt(
    tenantId: string,
    invoiceId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertOpdEnabled(tenantId);
    const inv = await (this.prisma as any).invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'opd.receipt.generate',
      entityType: 'Invoice',
      entityId: invoiceId,
      correlationId,
    });
    return { invoiceId, message: 'Receipt generation queued', status: 'QUEUED' };
  }
}
