import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// Valid transitions: fromStatus → allowed toStatuses
const VALID_TRANSITIONS: Record<string, string[]> = {
  registered: ['lab_ordered', 'cancelled'],
  lab_ordered: ['specimen_collected', 'cancelled'],
  specimen_collected: ['resulted', 'cancelled'],
  resulted: ['verified', 'cancelled'],
  verified: [],
  cancelled: [],
};

@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getEncounterOrThrow(tenantId: string, id: string) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id, tenantId },
      include: {
        patient: true,
        labOrders: {
          include: { specimen: true, result: true, test: true },
        },
      },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');
    return encounter;
  }

  async list(tenantId: string, opts: { page?: number; limit?: number; status?: string; patientId?: string } = {}) {
    const { page = 1, limit = 20, status, patientId } = opts;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;

    const [data, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        include: { patient: true, labOrders: { include: { specimen: true, result: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.encounter.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async register(tenantId: string, body: { patientId: string }, actorUserId: string, correlationId?: string) {
    // Verify patient exists in tenant
    const patient = await this.prisma.patient.findFirst({ where: { id: body.patientId, tenantId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const encounter = await this.prisma.encounter.create({
      data: { tenantId, patientId: body.patientId, status: 'registered' },
      include: { patient: true, labOrders: true },
    });

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.register', entityType: 'Encounter', entityId: encounter.id, after: { patientId: body.patientId, status: 'registered' }, correlationId });
    return encounter;
  }

  async getById(tenantId: string, id: string) {
    return this.getEncounterOrThrow(tenantId, id);
  }

  async orderLab(
    tenantId: string,
    encounterId: string,
    body: { testId: string; priority?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    const encounter = await this.getEncounterOrThrow(tenantId, encounterId);

    if (!['registered', 'lab_ordered'].includes(encounter.status)) {
      throw new ConflictException(`Cannot order lab for encounter in status '${encounter.status}'`);
    }

    // Verify test exists in tenant catalog
    const test = await this.prisma.catalogTest.findFirst({ where: { id: body.testId, tenantId } });
    if (!test) throw new NotFoundException('Catalog test not found');

    const newStatus = 'lab_ordered';
    const [labOrder, updatedEncounter] = await this.prisma.$transaction([
      this.prisma.labOrder.create({
        data: {
          tenantId,
          encounterId,
          testId: body.testId,
          priority: body.priority ?? 'routine',
          status: 'ordered',
        },
      }),
      this.prisma.encounter.update({
        where: { id: encounterId },
        data: { status: newStatus },
        include: { patient: true, labOrders: { include: { specimen: true, result: true } } },
      }),
    ]);

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.order-lab', entityType: 'Encounter', entityId: encounterId, before: { status: encounter.status }, after: { status: newStatus, labOrderId: labOrder.id }, correlationId });
    return updatedEncounter;
  }

  async collectSpecimen(
    tenantId: string,
    encounterId: string,
    body: { labOrderId: string; barcode: string; type: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    const encounter = await this.getEncounterOrThrow(tenantId, encounterId);

    if (!VALID_TRANSITIONS[encounter.status]?.includes('specimen_collected')) {
      throw new ConflictException(`Cannot collect specimen for encounter in status '${encounter.status}'`);
    }

    const labOrder = await this.prisma.labOrder.findFirst({ where: { id: body.labOrderId, encounterId, tenantId } });
    if (!labOrder) throw new NotFoundException('Lab order not found in this encounter');

    const [, updatedEncounter] = await this.prisma.$transaction([
      this.prisma.specimen.create({
        data: {
          tenantId,
          labOrderId: body.labOrderId,
          barcode: body.barcode,
          type: body.type,
          status: 'collected',
          collectedAt: new Date(),
        },
      }),
      this.prisma.labOrder.update({ where: { id: body.labOrderId }, data: { status: 'specimen_collected' } }),
      this.prisma.encounter.update({
        where: { id: encounterId },
        data: { status: 'specimen_collected' },
        include: { patient: true, labOrders: { include: { specimen: true, result: true } } },
      }),
    ]).then(([_spec, _order, enc]) => [_spec, enc]);

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.collect-specimen', entityType: 'Encounter', entityId: encounterId, before: { status: encounter.status }, after: { status: 'specimen_collected', barcode: body.barcode }, correlationId });
    return updatedEncounter;
  }

  async enterResult(
    tenantId: string,
    encounterId: string,
    body: { labOrderId: string; value: string; unit?: string; referenceRange?: string; flag?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    const encounter = await this.getEncounterOrThrow(tenantId, encounterId);

    if (!VALID_TRANSITIONS[encounter.status]?.includes('resulted')) {
      throw new ConflictException(`Cannot enter result for encounter in status '${encounter.status}'`);
    }

    const labOrder = await this.prisma.labOrder.findFirst({ where: { id: body.labOrderId, encounterId, tenantId } });
    if (!labOrder) throw new NotFoundException('Lab order not found in this encounter');

    const [, updatedEncounter] = await this.prisma.$transaction([
      this.prisma.labResult.create({
        data: {
          tenantId,
          labOrderId: body.labOrderId,
          value: body.value,
          unit: body.unit,
          referenceRange: body.referenceRange,
          flag: body.flag,
          resultedBy: actorUserId,
        },
      }),
      this.prisma.labOrder.update({ where: { id: body.labOrderId }, data: { status: 'resulted' } }),
      this.prisma.encounter.update({
        where: { id: encounterId },
        data: { status: 'resulted' },
        include: { patient: true, labOrders: { include: { specimen: true, result: true } } },
      }),
    ]).then(([_res, _order, enc]) => [_res, enc]);

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.result', entityType: 'Encounter', entityId: encounterId, before: { status: encounter.status }, after: { status: 'resulted', labOrderId: body.labOrderId }, correlationId });
    return updatedEncounter;
  }

  async verify(tenantId: string, encounterId: string, actorUserId: string, correlationId?: string) {
    const encounter = await this.getEncounterOrThrow(tenantId, encounterId);

    if (encounter.status !== 'resulted') {
      throw new ConflictException(`Cannot verify encounter in status '${encounter.status}' (must be 'resulted')`);
    }

    // Mark all resulted lab orders as verified
    const updatedEncounter = await this.prisma.$transaction(async (tx) => {
      await tx.labOrder.updateMany({ where: { encounterId, tenantId, status: 'resulted' }, data: { status: 'verified' } });
      await tx.labResult.updateMany({ where: { labOrder: { encounterId } }, data: { verifiedAt: new Date(), verifiedBy: actorUserId } });
      return tx.encounter.update({
        where: { id: encounterId },
        data: { status: 'verified' },
        include: { patient: true, labOrders: { include: { specimen: true, result: true } } },
      });
    });

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.verify', entityType: 'Encounter', entityId: encounterId, before: { status: 'resulted' }, after: { status: 'verified' }, correlationId });
    return updatedEncounter;
  }

  async cancel(tenantId: string, encounterId: string, actorUserId: string, correlationId?: string) {
    const encounter = await this.getEncounterOrThrow(tenantId, encounterId);

    if (!VALID_TRANSITIONS[encounter.status]?.includes('cancelled')) {
      throw new ConflictException(`Cannot cancel encounter in status '${encounter.status}'`);
    }

    const updatedEncounter = await this.prisma.encounter.update({
      where: { id: encounterId },
      data: { status: 'cancelled' },
      include: { patient: true, labOrders: { include: { specimen: true, result: true } } },
    });

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.cancel', entityType: 'Encounter', entityId: encounterId, before: { status: encounter.status }, after: { status: 'cancelled' }, correlationId });
    return updatedEncounter;
  }
}
