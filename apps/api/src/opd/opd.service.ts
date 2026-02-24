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
      consultationFee: null,
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
}
