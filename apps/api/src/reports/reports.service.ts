import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PENDING_LAB_ORDER_STATUSES = ['ordered', 'specimen_collected', 'processing', 'resulted'];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(from?: string, to?: string) {
    const where: { gte?: Date; lte?: Date } = {};
    if (from) where.gte = new Date(from);
    if (to) where.lte = new Date(to);
    return Object.keys(where).length ? where : undefined;
  }

  async getRegistrationsReport(
    tenantId: string,
    filters: { from?: string; to?: string; page?: number; limit?: number },
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const createdAt = this.dateRange(filters.from, filters.to);

    const [data, total, dailyCounts] = await Promise.all([
      this.prisma.patient.findMany({
        where: { tenantId, ...(createdAt ? { createdAt } : {}) },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          mrn: true,
          firstName: true,
          lastName: true,
          gender: true,
          mobile: true,
          createdAt: true,
        },
      }),
      this.prisma.patient.count({ where: { tenantId, ...(createdAt ? { createdAt } : {}) } }),
      (() => {
        const conditions = [Prisma.sql`"tenant_id" = ${tenantId}`];
        if (filters.from) conditions.push(Prisma.sql`"created_at" >= ${new Date(filters.from)}`);
        if (filters.to) conditions.push(Prisma.sql`"created_at" <= ${new Date(filters.to)}`);
        return this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(Prisma.sql`
          SELECT date_trunc('day', "created_at") AS day, COUNT(*)::bigint AS count
          FROM "patients"
          WHERE ${Prisma.join(conditions, ' AND ')}
          GROUP BY day
          ORDER BY day DESC
        `);
      })(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      dailyCounts: dailyCounts.map((r) => ({ date: r.day, count: Number(r.count) })),
    };
  }

  async getPatientHistory(tenantId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, tenantId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const encounters = await this.prisma.encounter.findMany({
      where: { patientId, tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        labOrders: {
          select: {
            id: true,
            testNameSnapshot: true,
            status: true,
            resultStatus: true,
            payableAmount: true,
            amountPaid: true,
            dueAmount: true,
            createdAt: true,
          },
        },
      },
    });

    const encounterIds = encounters.map((e) => e.id);
    const documents = encounterIds.length
      ? await this.prisma.document.findMany({
          where: { tenantId, sourceType: 'ENCOUNTER', sourceRef: { in: encounterIds } },
          select: { id: true, type: true, status: true, sourceRef: true, publishedAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return {
      patient,
      encounters: encounters.map((e) => ({
        id: e.id,
        encounterCode: e.encounterCode,
        status: e.status,
        createdAt: e.createdAt,
        labOrders: e.labOrders,
        documents: documents.filter((d) => d.sourceRef === e.id),
      })),
      visitCount: encounters.length,
    };
  }

  async getWorklistStatusReport(tenantId: string) {
    const statusCounts = await this.prisma.labOrder.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });

    const pendingOrders = await this.prisma.labOrder.findMany({
      where: { tenantId, status: { in: PENDING_LAB_ORDER_STATUSES } },
      orderBy: { createdAt: 'asc' },
      include: {
        encounter: { include: { patient: true } },
      },
    });

    const now = Date.now();
    return {
      statusCounts: statusCounts.map((s) => ({ status: s.status, count: s._count._all })),
      pending: pendingOrders.map((o) => ({
        labOrderId: o.id,
        encounterId: o.encounterId,
        encounterCode: o.encounter.encounterCode,
        patientName: `${o.encounter.patient.firstName} ${o.encounter.patient.lastName}`,
        mrn: o.encounter.patient.mrn,
        testName: o.testNameSnapshot,
        status: o.status,
        resultStatus: o.resultStatus,
        createdAt: o.createdAt,
        ageHours: Math.round((now - o.createdAt.getTime()) / 3_600_000),
      })),
    };
  }

  async getEncounterTimeline(tenantId: string, encounterId: string) {
    const encounter = await this.prisma.encounter.findFirst({ where: { id: encounterId, tenantId } });
    if (!encounter) throw new NotFoundException('Encounter not found');

    const labOrderIds = (
      await this.prisma.labOrder.findMany({ where: { encounterId, tenantId }, select: { id: true } })
    ).map((o) => o.id);

    const events = await this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        OR: [
          { entityType: 'Encounter', entityId: encounterId },
          ...(labOrderIds.length ? [{ entityType: 'LabOrder', entityId: { in: labOrderIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
    });

    return {
      encounterId,
      encounterCode: encounter.encounterCode,
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        actor: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : null,
        actorEmail: e.actor?.email ?? null,
        before: e.before,
        after: e.after,
        createdAt: e.createdAt,
      })),
    };
  }

  async getStaffActivityReport(
    tenantId: string,
    filters: { actorUserId?: string; from?: string; to?: string },
  ) {
    const createdAt = this.dateRange(filters.from, filters.to);
    const events = await this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    const byActor = new Map<string, { actor: any; actionCounts: Record<string, number>; total: number }>();
    for (const e of events) {
      const key = e.actorUserId ?? 'system';
      if (!byActor.has(key)) {
        byActor.set(key, { actor: e.actor, actionCounts: {}, total: 0 });
      }
      const entry = byActor.get(key)!;
      entry.actionCounts[e.action] = (entry.actionCounts[e.action] ?? 0) + 1;
      entry.total += 1;
    }

    return {
      summary: Array.from(byActor.entries()).map(([actorUserId, v]) => ({
        actorUserId,
        actorName: v.actor ? `${v.actor.firstName} ${v.actor.lastName}` : 'System',
        actionCounts: v.actionCounts,
        total: v.total,
      })),
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        actorUserId: e.actorUserId,
        actorName: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : 'System',
        createdAt: e.createdAt,
      })),
    };
  }

  async getExceptionsReport(tenantId: string, filters: { from?: string; to?: string }) {
    const createdAt = this.dateRange(filters.from, filters.to);
    const events = await this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        action: { in: ['ENCOUNTER_RETURNED_FOR_CORRECTION', 'encounter.cancel'] },
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { firstName: true, lastName: true } } },
    });

    return {
      data: events.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        actorName: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : 'System',
        before: e.before,
        after: e.after,
        createdAt: e.createdAt,
      })),
    };
  }

  async getDailyCollectionReport(tenantId: string, date: string) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const transactions = await this.prisma.cashTransaction.findMany({
      where: {
        tenantId,
        type: { in: ['PAYMENT', 'DUE_RECEIVED'] },
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      include: { actor: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const byMode: Record<string, number> = {};
    let total = 0;
    for (const t of transactions) {
      const amt = Number(t.amount);
      byMode[t.paymentMode] = (byMode[t.paymentMode] ?? 0) + amt;
      total += amt;
    }

    return {
      date,
      total,
      byPaymentMode: byMode,
      transactions: transactions.map((t) => ({
        id: t.id,
        encounterId: t.encounterId,
        type: t.type,
        amount: Number(t.amount),
        paymentMode: t.paymentMode,
        actorName: t.actor ? `${t.actor.firstName} ${t.actor.lastName}` : null,
        createdAt: t.createdAt,
      })),
    };
  }

  async getOutstandingDuesReport(tenantId: string) {
    const orders = await this.prisma.labOrder.findMany({
      where: { tenantId, dueAmount: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
      include: { encounter: { include: { patient: true } } },
    });

    return {
      data: orders.map((o) => ({
        labOrderId: o.id,
        encounterId: o.encounterId,
        encounterCode: o.encounter.encounterCode,
        patientName: `${o.encounter.patient.firstName} ${o.encounter.patient.lastName}`,
        mrn: o.encounter.patient.mrn,
        testName: o.testNameSnapshot,
        payableAmount: o.payableAmount ? Number(o.payableAmount) : null,
        amountPaid: o.amountPaid ? Number(o.amountPaid) : null,
        dueAmount: o.dueAmount ? Number(o.dueAmount) : null,
        createdAt: o.createdAt,
      })),
      totalDue: orders.reduce((sum, o) => sum + (o.dueAmount ? Number(o.dueAmount) : 0), 0),
    };
  }

  async getDiscountsReport(tenantId: string, filters: { from?: string; to?: string }) {
    const createdAt = this.dateRange(filters.from, filters.to);
    const transactions = await this.prisma.cashTransaction.findMany({
      where: { tenantId, type: 'DISCOUNT', ...(createdAt ? { createdAt } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { firstName: true, lastName: true } }, encounter: { include: { patient: true } } },
    });

    return {
      data: transactions.map((t) => ({
        id: t.id,
        encounterId: t.encounterId,
        patientName: `${t.encounter.patient.firstName} ${t.encounter.patient.lastName}`,
        mrn: t.encounter.patient.mrn,
        amount: Number(t.amount),
        reason: t.reason,
        actorName: t.actor ? `${t.actor.firstName} ${t.actor.lastName}` : null,
        createdAt: t.createdAt,
      })),
      totalDiscounted: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
    };
  }
}
