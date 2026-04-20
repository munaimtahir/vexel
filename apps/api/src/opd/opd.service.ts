import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';

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
    private readonly documents: DocumentsService,
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
      encounterId: inv.encounterId ?? null,
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

  private async assertOpdFeatureEnabled(tenantId: string, key: string) {
    const flag = await (this.prisma as any).tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!flag?.enabled) {
      throw new ForbiddenException(`${key} feature is disabled for this tenant`);
    }
  }

  private mapKmvpDoctor(d: any) {
    return {
      id: d.id,
      tenantId: d.tenantId,
      code: d.code,
      displayName: d.displayName,
      specialtyName: d.specialtyName,
      consultationFee: Number(d.consultationFee),
      currency: d.currency,
      isActive: d.isActive,
      sortOrder: d.sortOrder,
      designation: d.designation ?? null,
      degrees: d.degrees ?? null,
      pmdcNumber: d.pmdcNumber ?? null,
      phcNumber: d.phcNumber ?? null,
      clinicName: d.clinicName ?? null,
      clinicAddress: d.clinicAddress ?? null,
      clinicPhone: d.clinicPhone ?? null,
      signatureLabel: d.signatureLabel ?? null,
      signatureUrl: d.signatureUrl ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  private mapKmvpEncounter(e: any) {
    return {
      id: e.id,
      tenantId: e.tenantId,
      patientId: e.patientId,
      encounterId: e.encounterId,
      doctorId: e.doctorId,
      status: e.status,
      visitCode: e.visitCode,
      chiefComplaint: e.chiefComplaint ?? null,
      diagnosis: e.diagnosis ?? null,
      advice: e.advice ?? null,
      followUp: e.followUp ?? null,
      investigations: e.investigations ?? null,
      remarks: e.remarks ?? null,
      paymentStatus: e.paymentStatus ?? null,
      cancelledAt: e.cancelledAt ?? null,
      cancelledReason: e.cancelledReason ?? null,
      completedAt: e.completedAt ?? null,
      createdAt: e.createdAt,
      publishedAt: e.publishedAt ?? null,
      updatedAt: e.updatedAt,
    };
  }

  private async withCommandIdempotency<T>(
    tenantId: string,
    commandName: string,
    idempotencyKey: string | undefined,
    requestJson: Record<string, unknown>,
    executor: () => Promise<T>,
  ): Promise<T> {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      return executor();
    }
    const key = idempotencyKey.trim();
    const existing = await (this.prisma as any).opdCommandLog.findFirst({
      where: { tenantId, commandName, idempotencyKey: key },
    });
    if (existing?.responseJson != null) {
      return existing.responseJson as T;
    }
    const result = await executor();
    try {
      await (this.prisma as any).opdCommandLog.create({
        data: {
          tenantId,
          commandName,
          idempotencyKey: key,
          requestJson,
          responseJson: result as any,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const deduped = await (this.prisma as any).opdCommandLog.findFirst({
          where: { tenantId, commandName, idempotencyKey: key },
        });
        if (deduped?.responseJson != null) return deduped.responseJson as T;
      }
      throw err;
    }
    return result;
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
        encounterId: body.encounterId ?? null,
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

  // ─── OPD KMVP Doctor Master ───────────────────────────────────────────────

  async listDoctors(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const where: any = { tenantId };
    if (q?.isActive !== undefined) {
      const b = parseBool(q.isActive);
      if (b !== undefined) where.isActive = b;
    }
    const search = typeof q?.search === 'string' ? q.search.trim() : '';
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { specialtyName: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { clinicName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).opdDoctor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      }),
      (this.prisma as any).opdDoctor.count({ where }),
    ]);
    return {
      data: data.map((d: any) => this.mapKmvpDoctor(d)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getDoctor(tenantId: string, doctorId: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    const d = await (this.prisma as any).opdDoctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!d) throw new NotFoundException('OPD doctor not found');
    return this.mapKmvpDoctor(d);
  }

  async createDoctor(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    if (!body?.code?.trim() || !body?.displayName?.trim() || !body?.specialtyName?.trim()) {
      throw new BadRequestException('code, displayName, and specialtyName are required');
    }
    if (body.consultationFee == null || Number(body.consultationFee) < 0) {
      throw new BadRequestException('consultationFee must be a non-negative number');
    }
    try {
      const d = await (this.prisma as any).opdDoctor.create({
        data: {
          tenantId,
          code: body.code.trim(),
          displayName: body.displayName.trim(),
          specialtyName: body.specialtyName.trim(),
          consultationFee: Number(body.consultationFee),
          currency: (body.currency ?? 'PKR').toUpperCase(),
          isActive: body.isActive !== undefined ? !!body.isActive : true,
          sortOrder: Number(body.sortOrder ?? 0),
          designation: body.designation != null ? String(body.designation).trim() : null,
          degrees: body.degrees != null ? String(body.degrees).trim() : null,
          pmdcNumber: body.pmdcNumber != null ? String(body.pmdcNumber).trim() : null,
          phcNumber: body.phcNumber != null ? String(body.phcNumber).trim() : null,
          clinicName: body.clinicName != null ? String(body.clinicName).trim() : null,
          clinicAddress: body.clinicAddress != null ? String(body.clinicAddress).trim() : null,
          clinicPhone: body.clinicPhone != null ? String(body.clinicPhone).trim() : null,
          signatureLabel: body.signatureLabel != null ? String(body.signatureLabel).trim() : null,
          signatureUrl: body.signatureUrl != null ? String(body.signatureUrl).trim() : null,
        },
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'opd.doctor.created',
        entityType: 'OpdDoctor',
        entityId: d.id,
        after: this.mapKmvpDoctor(d),
        correlationId,
      });
      return this.mapKmvpDoctor(d);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Doctor code already exists in tenant');
      throw err;
    }
  }

  async updateDoctor(tenantId: string, doctorId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    const existing = await (this.prisma as any).opdDoctor.findFirst({ where: { id: doctorId, tenantId } });
    if (!existing) throw new NotFoundException('OPD doctor not found');
    try {
      const updated = await (this.prisma as any).opdDoctor.update({
        where: { id: doctorId },
        data: {
          ...(body.code !== undefined ? { code: String(body.code).trim() } : {}),
          ...(body.displayName !== undefined ? { displayName: String(body.displayName).trim() } : {}),
          ...(body.specialtyName !== undefined ? { specialtyName: String(body.specialtyName).trim() } : {}),
          ...(body.consultationFee !== undefined ? { consultationFee: Number(body.consultationFee) } : {}),
          ...(body.currency !== undefined ? { currency: String(body.currency).toUpperCase() } : {}),
          ...(body.isActive !== undefined ? { isActive: !!body.isActive } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
          ...(body.designation !== undefined ? { designation: body.designation != null ? String(body.designation).trim() : null } : {}),
          ...(body.degrees !== undefined ? { degrees: body.degrees != null ? String(body.degrees).trim() : null } : {}),
          ...(body.pmdcNumber !== undefined ? { pmdcNumber: body.pmdcNumber != null ? String(body.pmdcNumber).trim() : null } : {}),
          ...(body.phcNumber !== undefined ? { phcNumber: body.phcNumber != null ? String(body.phcNumber).trim() : null } : {}),
          ...(body.clinicName !== undefined ? { clinicName: body.clinicName != null ? String(body.clinicName).trim() : null } : {}),
          ...(body.clinicAddress !== undefined ? { clinicAddress: body.clinicAddress != null ? String(body.clinicAddress).trim() : null } : {}),
          ...(body.clinicPhone !== undefined ? { clinicPhone: body.clinicPhone != null ? String(body.clinicPhone).trim() : null } : {}),
          ...(body.signatureLabel !== undefined ? { signatureLabel: body.signatureLabel != null ? String(body.signatureLabel).trim() : null } : {}),
          ...(body.signatureUrl !== undefined ? { signatureUrl: body.signatureUrl != null ? String(body.signatureUrl).trim() : null } : {}),
        },
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'opd.doctor.updated',
        entityType: 'OpdDoctor',
        entityId: doctorId,
        before: this.mapKmvpDoctor(existing),
        after: this.mapKmvpDoctor(updated),
        correlationId,
      });
      return this.mapKmvpDoctor(updated);
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('Doctor code already exists in tenant');
      throw err;
    }
  }

  // ─── OPD KMVP Encounters / Commands ───────────────────────────────────────

  async listEncounters(tenantId: string, q: any) {
    await this.assertOpdEnabled(tenantId);
    const page = Number(q?.page ?? 1);
    const limit = Number(q?.limit ?? 20);
    const where: any = { tenantId };
    if (q?.status) where.status = q.status;
    if (q?.doctorId) where.doctorId = q.doctorId;
    if (q?.patientId) where.patientId = q.patientId;
    const search = typeof q?.search === 'string' ? q.search.trim() : '';
    if (search) {
      where.OR = [{ visitCode: { contains: search, mode: 'insensitive' } }];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).opdEncounter.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).opdEncounter.count({ where }),
    ]);
    return {
      data: data.map((e: any) => this.mapKmvpEncounter(e)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getEncounter(tenantId: string, encounterId: string) {
    await this.assertOpdEnabled(tenantId);
    const e = await (this.prisma as any).opdEncounter.findFirst({
      where: { id: encounterId, tenantId },
      include: {
        vitals: { orderBy: { enteredAt: 'desc' } },
        notes: true,
        prescriptions: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!e) throw new NotFoundException('OPD encounter not found');
    return {
      ...this.mapKmvpEncounter(e),
      vitals: (e.vitals ?? []).map((v: any) => ({
        id: v.id,
        bpSystolic: v.bpSystolic,
        bpDiastolic: v.bpDiastolic,
        pulse: v.pulse,
        temperatureC: v.temperatureC != null ? Number(v.temperatureC) : null,
        respRate: v.respRate,
        spo2: v.spo2,
        weightKg: v.weightKg != null ? Number(v.weightKg) : null,
        heightCm: v.heightCm != null ? Number(v.heightCm) : null,
        bmi: v.bmi != null ? Number(v.bmi) : null,
        enteredBy: v.enteredBy ?? null,
        enteredAt: v.enteredAt,
      })),
      notes:
        e.notes?.[0] != null
          ? {
              historyNotes: e.notes[0].historyNotes ?? null,
              examNotes: e.notes[0].examNotes ?? null,
              assessment: e.notes[0].assessment ?? null,
              plan: e.notes[0].plan ?? null,
              advice: e.notes[0].advice ?? null,
              diagnosis: e.notes[0].diagnosis ?? null,
              followUp: e.notes[0].followUp ?? null,
              investigations: e.notes[0].investigations ?? null,
              remarks: e.notes[0].remarks ?? null,
              updatedAt: e.notes[0].updatedAt,
            }
          : null,
      prescription:
        e.prescriptions?.[0] != null
          ? {
              id: e.prescriptions[0].id,
              publishedDocumentId: e.prescriptions[0].publishedDocumentId ?? null,
              items: (e.prescriptions[0].items ?? []).map((i: any) => ({
                id: i.id,
                drugName: i.drugName,
                genericName: i.genericName ?? null,
                strength: i.strength ?? null,
                dose: i.dose ?? null,
                frequency: i.frequency ?? null,
                duration: i.duration ?? null,
                route: i.route ?? null,
                instructions: i.instructions ?? null,
                sortOrder: i.sortOrder,
              })),
            }
          : null,
    };
  }

  async createRegistration(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.doctorProfiles');
    if (!body?.patientId || !body?.doctorId) {
      throw new BadRequestException('patientId and doctorId are required');
    }
    return this.withCommandIdempotency(
      tenantId,
      'CreateOpdRegistration',
      body?.idempotencyKey,
      body,
      async () => {
        const patient = await (this.prisma as any).patient.findFirst({
          where: { id: body.patientId, tenantId },
        });
        if (!patient) throw new NotFoundException('Patient not found');
        const doctor = await (this.prisma as any).opdDoctor.findFirst({
          where: { id: body.doctorId, tenantId, isActive: true },
        });
        if (!doctor) throw new NotFoundException('Active OPD doctor not found');

        const encounter = await (this.prisma as any).encounter.create({
          data: {
            tenantId,
            patientId: body.patientId,
            moduleType: 'OPD',
            status: 'registered',
          },
        });
        const seq = (await (this.prisma as any).opdEncounter.count({ where: { tenantId } })) + 1;
        const opd = await (this.prisma as any).opdEncounter.create({
          data: {
            tenantId,
            patientId: body.patientId,
            encounterId: encounter.id,
            doctorId: body.doctorId,
            status: 'DRAFT',
            visitCode: buildCode('OPD', seq),
            paymentStatus: body.immediatePaymentAmount != null && Number(body.immediatePaymentAmount) > 0 ? 'PAID' : 'UNPAID',
          },
        });

        const line = {
          description: `Consultation - ${doctor.displayName}`,
          quantity: 1,
          unitPrice: Number(doctor.consultationFee),
          discountAmount: 0,
        };
        const inv = await this.createInvoice(
          tenantId,
          {
            patientId: body.patientId,
            visitId: null,
            encounterId: encounter.id,
            currency: doctor.currency,
            lines: [line],
          },
          actorUserId,
          correlationId,
        );
        if (body.immediatePaymentAmount != null && Number(body.immediatePaymentAmount) > 0) {
          await this.issueInvoice(tenantId, inv.id, actorUserId, correlationId);
          await this.recordPayment(
            tenantId,
            inv.id,
            {
              amount: Number(body.immediatePaymentAmount),
              method: body.immediatePaymentMethod ?? 'CASH',
              referenceNo: body.immediatePaymentReferenceNo ?? null,
              notes: body.immediatePaymentNotes ?? null,
            },
            actorUserId,
            correlationId,
          );
        }
        const result = {
          opdEncounter: this.mapKmvpEncounter(opd),
          invoiceId: inv.id,
        };
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.registration.created',
          entityType: 'OpdEncounter',
          entityId: opd.id,
          after: result,
          correlationId,
        });
        return result;
      },
    );
  }

  async recordIntake(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'opd.intake');
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    if (!body?.chiefComplaint || !String(body.chiefComplaint).trim()) {
      throw new BadRequestException('chiefComplaint is required');
    }
    return this.withCommandIdempotency(
      tenantId,
      'RecordOpdIntake',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        if (e.status !== 'DRAFT') {
          throw new ConflictException(`Invalid transition ${e.status} -> READY_FOR_PRINT`);
        }

        const hasMeaningfulVitals =
          body.bpSystolic != null ||
          body.bpDiastolic != null ||
          body.pulse != null ||
          body.temperatureC != null ||
          body.respRate != null ||
          body.spo2 != null ||
          body.weightKg != null ||
          body.heightCm != null;
        if (!hasMeaningfulVitals) {
          throw new BadRequestException('At least one meaningful vital input is required');
        }

        const height = body.heightCm != null ? Number(body.heightCm) : null;
        const weight = body.weightKg != null ? Number(body.weightKg) : null;
        let bmi: number | null = null;
        if (height && weight) {
          const hm = height / 100;
          bmi = hm > 0 ? Math.round((weight / (hm * hm)) * 10) / 10 : null;
        }
        await (this.prisma as any).opdVital.create({
          data: {
            tenantId,
            opdEncounterId: e.id,
            bpSystolic: body.bpSystolic ?? null,
            bpDiastolic: body.bpDiastolic ?? null,
            pulse: body.pulse ?? null,
            temperatureC: body.temperatureC ?? null,
            respRate: body.respRate ?? null,
            spo2: body.spo2 ?? null,
            weightKg: body.weightKg ?? null,
            heightCm: body.heightCm ?? null,
            bmi,
            enteredBy: actorUserId,
            enteredAt: new Date(),
          },
        });
        const updated = await (this.prisma as any).opdEncounter.update({
          where: { id: e.id },
          data: {
            chiefComplaint: String(body.chiefComplaint).trim(),
            status: 'READY_FOR_PRINT',
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : null,
            advice: body.advice != null ? String(body.advice).trim() : null,
            followUp: body.followUp != null ? String(body.followUp).trim() : null,
            investigations: body.investigations != null ? String(body.investigations).trim() : null,
            remarks: body.remarks != null ? String(body.remarks).trim() : null,
          },
        });
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.intake.recorded',
          entityType: 'OpdEncounter',
          entityId: e.id,
          after: this.mapKmvpEncounter(updated),
          correlationId,
        });
        return { opdEncounter: this.mapKmvpEncounter(updated) };
      },
    );
  }

  async publishPrescription(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.prescription');
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    const items = Array.isArray(body?.prescriptionItems) ? body.prescriptionItems : [];
    if (items.length < 1) throw new BadRequestException('At least one prescription item is required');
    return this.withCommandIdempotency(
      tenantId,
      'PublishOpdPrescription',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
          include: {
            patient: true,
            doctor: true,
            vitals: { orderBy: { enteredAt: 'desc' }, take: 1 },
          },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        if (e.status !== 'READY_FOR_PRINT') {
          throw new ConflictException(`Invalid transition ${e.status} -> COMPLETED`);
        }
        const historyNotes = String(body.historyNotes ?? '').trim();
        const examNotes = String(body.examNotes ?? '').trim();
        const assessment = String(body.assessment ?? '').trim();
        const plan = String(body.plan ?? '').trim();
        const advice = String(body.advice ?? '').trim();
        const followUp = String(body.followUp ?? '').trim();
        const investigations = String(body.investigations ?? '').trim();
        const remarks = String(body.remarks ?? '').trim();
        if (!historyNotes || !examNotes || !assessment || !plan || !advice) {
          throw new BadRequestException('historyNotes, examNotes, assessment, plan, and advice are required');
        }

        const note = await (this.prisma as any).opdNote.upsert({
          where: { tenantId_opdEncounterId: { tenantId, opdEncounterId: e.id } },
          create: {
            tenantId,
            opdEncounterId: e.id,
            historyNotes,
            examNotes,
            assessment,
            plan,
            advice,
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : null,
            followUp: followUp || null,
            investigations: investigations || null,
            remarks: remarks || null,
          },
          update: {
            historyNotes,
            examNotes,
            assessment,
            plan,
            advice,
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : null,
            followUp: followUp || null,
            investigations: investigations || null,
            remarks: remarks || null,
          },
        });
        const prescription = await (this.prisma as any).opdEncounterPrescription.upsert({
          where: { tenantId_opdEncounterId: { tenantId, opdEncounterId: e.id } },
          create: { tenantId, opdEncounterId: e.id },
          update: {},
        });
        await (this.prisma as any).opdPrescriptionItemKmvp.deleteMany({
          where: { tenantId, opdPrescriptionId: prescription.id },
        });
        await (this.prisma as any).opdPrescriptionItemKmvp.createMany({
          data: items.map((i: any, idx: number) => ({
            tenantId,
            opdPrescriptionId: prescription.id,
            drugName: String(i.drugName ?? '').trim(),
            genericName: i.genericName ? String(i.genericName).trim() : null,
            strength: i.strength ? String(i.strength).trim() : null,
            dose: i.dose ? String(i.dose).trim() : null,
            frequency: i.frequency ? String(i.frequency).trim() : null,
            duration: i.duration ? String(i.duration).trim() : null,
            route: i.route ? String(i.route).trim() : null,
            instructions: i.instructions ? String(i.instructions).trim() : null,
            sortOrder: idx + 1,
          })),
        });

        const vitals = e.vitals?.[0];
        const payload = {
          payload_version: 'v1',
          templateVersion: 'v2',
          documentFamily: 'opd.prescription.consultants_place.v2',
          patient: {
            mrn: e.patient.mrn,
            firstName: e.patient.firstName,
            lastName: e.patient.lastName,
            gender: e.patient.gender ?? null,
            dateOfBirth: e.patient.dateOfBirth?.toISOString() ?? null,
            mobile: e.patient.mobile ?? null,
          },
          visitCode: e.visitCode,
          doctor: {
            fullName: e.doctor.displayName,
            specialty: e.doctor.specialtyName,
            designation: e.doctor.designation ?? null,
            degrees: e.doctor.degrees ?? null,
            pmdcNumber: e.doctor.pmdcNumber ?? null,
            phcNumber: e.doctor.phcNumber ?? null,
            clinicName: e.doctor.clinicName ?? null,
            clinicAddress: e.doctor.clinicAddress ?? null,
            clinicPhone: e.doctor.clinicPhone ?? null,
            signatureLabel: e.doctor.signatureLabel ?? null,
            signatureUrl: e.doctor.signatureUrl ?? null,
          },
          visitDateTime: e.createdAt.toISOString(),
          majorComplaint: e.chiefComplaint ?? null,
          diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : (e.diagnosis ?? null),
          vitals: vitals
            ? {
                bpSystolic: vitals.bpSystolic,
                bpDiastolic: vitals.bpDiastolic,
                pulse: vitals.pulse,
                temperatureC: vitals.temperatureC != null ? Number(vitals.temperatureC) : null,
                respRate: vitals.respRate,
                spo2: vitals.spo2,
                weightKg: vitals.weightKg != null ? Number(vitals.weightKg) : null,
                heightCm: vitals.heightCm != null ? Number(vitals.heightCm) : null,
                bmi: vitals.bmi != null ? Number(vitals.bmi) : null,
              }
            : null,
          notes: {
            historyNotes: note.historyNotes,
            examNotes: note.examNotes,
            assessment: note.assessment,
            plan: note.plan,
            advice: note.advice,
            followUp: note.followUp ?? null,
            investigations: note.investigations ?? null,
            remarks: note.remarks ?? null,
          },
          prescriptionItems: items,
        };

        const docResult = await this.documents.generateDocument(
          tenantId,
          'OPD_PRESCRIPTION',
          payload,
          e.id,
          'OPD_ENCOUNTER',
          actorUserId,
          correlationId ?? '',
        );
        const updatedEncounter = await (this.prisma as any).opdEncounter.update({
          where: { id: e.id },
          data: {
            status: 'COMPLETED',
            publishedAt: new Date(),
            completedAt: new Date(),
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : e.diagnosis,
            advice: advice,
            followUp: followUp || null,
            investigations: investigations || null,
            remarks: remarks || null,
          },
        });
        await (this.prisma as any).opdEncounterPrescription.update({
          where: { id: prescription.id },
          data: { publishedDocumentId: docResult.document.id },
        });
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.prescription.published',
          entityType: 'OpdEncounter',
          entityId: e.id,
          after: { documentId: docResult.document.id, status: updatedEncounter.status },
          correlationId,
        });
        return {
          opdEncounter: this.mapKmvpEncounter(updatedEncounter),
          documentId: docResult.document.id,
        };
      },
    );
  }

  async getEncounterPrescriptionDocument(tenantId: string, opdEncounterId: string) {
    await this.assertOpdEnabled(tenantId);
    const prescription = await (this.prisma as any).opdEncounterPrescription.findFirst({
      where: { tenantId, opdEncounterId },
    });
    if (!prescription?.publishedDocumentId) {
      throw new NotFoundException('Prescription document not found');
    }
    const doc = await this.documents.getDocument(tenantId, prescription.publishedDocumentId);
    return doc;
  }

  async downloadEncounterPrescriptionDocument(tenantId: string, opdEncounterId: string) {
    const doc = await this.getEncounterPrescriptionDocument(tenantId, opdEncounterId);
    const bytes = await this.documents.downloadDocument(tenantId, doc.id);
    return { document: doc, bytes };
  }

  async getEncounterReceiptDocument(tenantId: string, opdEncounterId: string) {
    await this.assertOpdEnabled(tenantId);
    const doc = await this.prisma.document.findFirst({
      where: {
        tenantId,
        type: 'OPD_INVOICE_RECEIPT',
        sourceType: 'OPD_ENCOUNTER',
        sourceRef: opdEncounterId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!doc) throw new NotFoundException('OPD receipt document not found');
    return doc;
  }

  async downloadEncounterReceiptDocument(tenantId: string, opdEncounterId: string) {
    const doc = await this.getEncounterReceiptDocument(tenantId, opdEncounterId);
    const bytes = await this.documents.downloadDocument(tenantId, doc.id);
    return { document: doc, bytes };
  }

  async finalizeEncounter(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    return this.withCommandIdempotency(
      tenantId,
      'FinalizeOpdEncounter',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        if (e.status !== 'READY_FOR_PRINT') {
          throw new ConflictException(`Invalid transition ${e.status} -> COMPLETED`);
        }
        const updated = await (this.prisma as any).opdEncounter.update({
          where: { id: e.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            diagnosis: body.diagnosis != null ? String(body.diagnosis).trim() : e.diagnosis,
            advice: body.advice != null ? String(body.advice).trim() : e.advice,
            followUp: body.followUp != null ? String(body.followUp).trim() : e.followUp,
            investigations: body.investigations != null ? String(body.investigations).trim() : e.investigations,
            remarks: body.remarks != null ? String(body.remarks).trim() : e.remarks,
          },
        });
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.encounter.finalized',
          entityType: 'OpdEncounter',
          entityId: e.id,
          before: this.mapKmvpEncounter(e),
          after: this.mapKmvpEncounter(updated),
          correlationId,
        });
        return { opdEncounter: this.mapKmvpEncounter(updated) };
      },
    );
  }

  async cancelEncounter(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    const reason = String(body?.reason ?? '').trim();
    if (!reason) throw new BadRequestException('reason is required');
    return this.withCommandIdempotency(
      tenantId,
      'CancelOpdEncounter',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        if (['CANCELLED', 'COMPLETED'].includes(e.status)) {
          throw new ConflictException(`Invalid transition ${e.status} -> CANCELLED`);
        }
        const updated = await (this.prisma as any).opdEncounter.update({
          where: { id: e.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledReason: reason,
          },
        });
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.encounter.cancelled',
          entityType: 'OpdEncounter',
          entityId: e.id,
          before: this.mapKmvpEncounter(e),
          after: this.mapKmvpEncounter(updated),
          correlationId,
        });
        return { opdEncounter: this.mapKmvpEncounter(updated) };
      },
    );
  }

  async generateEncounterReceipt(tenantId: string, body: any, actorUserId: string, correlationId?: string) {
    await this.assertOpdEnabled(tenantId);
    await this.assertOpdFeatureEnabled(tenantId, 'module.opd.receipt');
    if (!body?.opdEncounterId) throw new BadRequestException('opdEncounterId is required');
    return this.withCommandIdempotency(
      tenantId,
      'GenerateOpdEncounterReceipt',
      body?.idempotencyKey,
      body,
      async () => {
        const e = await (this.prisma as any).opdEncounter.findFirst({
          where: { id: body.opdEncounterId, tenantId },
          include: {
            patient: true,
            doctor: true,
          },
        });
        if (!e) throw new NotFoundException('OPD encounter not found');
        const inv = await (this.prisma as any).invoice.findFirst({
          where: { tenantId, encounterId: e.encounterId },
          include: { lines: { orderBy: { sortOrder: 'asc' } }, payments: { orderBy: { receivedAt: 'desc' } } },
        });
        if (!inv) throw new NotFoundException('OPD encounter invoice not found');

        const payload = {
          payload_version: 'v1',
          templateVersion: 'v2',
          documentFamily: 'opd.receipt.v2',
          invoiceCode: inv.invoiceCode,
          issuedAt: inv.issuedAt?.toISOString() ?? inv.createdAt.toISOString(),
          patientName: `${e.patient.firstName} ${e.patient.lastName}`.trim(),
          patientMrn: e.patient.mrn ?? null,
          patientPhone: e.patient.mobile ?? null,
          status: inv.status,
          visitId: e.id,
          sourceRef: e.id,
          providerName: e.doctor.displayName,
          lines: (inv.lines ?? []).map((line: any) => ({
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            discountAmount: Number(line.discountAmount),
            lineTotal: Number(line.lineTotal),
          })),
          subtotalAmount: Number(inv.subtotalAmount),
          discountAmount: Number(inv.discountAmount),
          totalAmount: Number(inv.totalAmount),
          paidAmount: Number(inv.amountPaid),
          balanceAmount: Number(inv.amountDue),
          paymentMethod: inv.payments?.[0]?.method ?? null,
          referenceNo: inv.payments?.[0]?.referenceNo ?? null,
        };

        const generated = await this.documents.generateDocument(
          tenantId,
          'OPD_INVOICE_RECEIPT',
          payload,
          e.id,
          'OPD_ENCOUNTER',
          actorUserId,
          correlationId ?? '',
        );
        await this.audit.log({
          tenantId,
          actorUserId,
          action: 'opd.receipt.generated',
          entityType: 'OpdEncounter',
          entityId: e.id,
          after: { documentId: generated.document.id },
          correlationId,
        });
        return { opdEncounter: this.mapKmvpEncounter(e), documentId: generated.document.id };
      },
    );
  }
}
