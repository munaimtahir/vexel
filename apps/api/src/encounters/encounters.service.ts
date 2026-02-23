import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';

// Valid transitions: fromStatus → allowed toStatuses
const VALID_TRANSITIONS: Record<string, string[]> = {
  registered: ['lab_ordered', 'cancelled'],
  lab_ordered: ['specimen_collected', 'cancelled'],
  specimen_collected: ['specimen_received', 'resulted', 'cancelled'],
  specimen_received: ['resulted', 'cancelled'],
  resulted: ['verified', 'cancelled'],
  verified: [],
  cancelled: [],
};

@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documentsService: DocumentsService,
  ) {}

  /** Throws ForbiddenException if module.lims is not enabled for the tenant. */
  private async assertLimsEnabled(tenantId: string) {
    const flag = await this.prisma.tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key: 'module.lims' } },
    });
    if (!flag?.enabled) {
      throw new ForbiddenException('module.lims feature is disabled for this tenant');
    }
  }

  private async getEncounterOrThrow(tenantId: string, id: string) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id, tenantId },
      include: {
        patient: true,
        labOrders: {
          include: { specimen: true, results: true, test: true },
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
        include: { patient: true, labOrders: { include: { specimen: true, results: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.encounter.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async register(tenantId: string, body: { patientId: string }, actorUserId: string, correlationId?: string) {
    await this.assertLimsEnabled(tenantId);
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
    body: { testId?: string; tests?: Array<{ code: string }>; priority?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertLimsEnabled(tenantId);
    const encounter = await this.getEncounterOrThrow(tenantId, encounterId);

    if (!['registered', 'lab_ordered'].includes(encounter.status)) {
      throw new ConflictException(`Cannot order lab for encounter in status '${encounter.status}'`);
    }

    // Resolve test: support { testId } OR { tests: [{ code }] }
    let resolvedTestId: string;
    if (body.testId) {
      const test = await this.prisma.catalogTest.findFirst({ where: { id: body.testId, tenantId } });
      if (!test) throw new NotFoundException('Catalog test not found');
      resolvedTestId = test.id;
    } else if (body.tests?.length) {
      const code = body.tests[0].code;
      const test = await this.prisma.catalogTest.findFirst({ where: { code, tenantId } });
      if (!test) throw new NotFoundException(`Catalog test not found: ${code}`);
      resolvedTestId = test.id;
    } else {
      throw new NotFoundException('No test specified');
    }

    const newStatus = 'lab_ordered';
    const [labOrder, updatedEncounter] = await this.prisma.$transaction([
      this.prisma.labOrder.create({
        data: {
          tenant: { connect: { id: tenantId } },
          encounter: { connect: { id: encounterId } },
          test: { connect: { id: resolvedTestId } },
          priority: body.priority ?? 'routine',
          status: 'ordered',
        },
      }),
      this.prisma.encounter.update({
        where: { id: encounterId },
        data: { status: newStatus },
        include: { patient: true, labOrders: { include: { specimen: true, results: true } } },
      }),
    ]);

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.order-lab', entityType: 'Encounter', entityId: encounterId, before: { status: encounter.status }, after: { status: newStatus, labOrderId: labOrder.id }, correlationId });

    // Generate encounterCode if not already set on encounter
    if (!updatedEncounter.encounterCode) {
      try {
        const tenantConfig = await this.prisma.tenantConfig.findUnique({ where: { tenantId } });
        const prefix = tenantConfig?.orderPrefix ?? 'VX';
        const now = new Date();
        const yymm = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const count = await this.prisma.labOrder.count({
          where: { tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
        });
        const seq = String(count).padStart(3, '0');
        const encounterCode = `${prefix}L-${yymm}-${seq}`;
        await this.prisma.encounter.update({
          where: { id: encounterId },
          data: { encounterCode },
        });
        (updatedEncounter as any).encounterCode = encounterCode;
      } catch (err) {
        console.error('[encounters] Failed to generate encounterCode:', (err as Error).message);
      }
    }

    // Auto-create SpecimenItem for the test's specimenType
    try {
      const catalogTest = await this.prisma.catalogTest.findUnique({ where: { id: resolvedTestId } });
      if (catalogTest?.specimenType) {
        await this.prisma.specimenItem.upsert({
          where: {
            tenantId_encounterId_catalogSpecimenType: {
              tenantId,
              encounterId,
              catalogSpecimenType: catalogTest.specimenType,
            },
          },
          create: {
            tenantId,
            encounterId,
            catalogSpecimenType: catalogTest.specimenType,
            status: 'PENDING',
          },
          update: {},
        });
      }
    } catch (err) {
      console.error('[encounters] Failed to auto-create SpecimenItem:', (err as Error).message);
    }

    // Auto-generate RECEIPT document after order finalization (non-fatal)
    try {
      const test = await this.prisma.catalogTest.findUnique({ where: { id: resolvedTestId } });
      const patient = (updatedEncounter as any).patient;
      const receiptPayload = {
        receiptNumber: `RCP-${labOrder.id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString(),
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
        patientMrn: patient?.mrn ?? '',
        items: [{
          description: test?.name ?? 'Lab Test',
          quantity: 1,
          unitPrice: 0,
          total: 0,
        }],
        subtotal: 0,
        tax: 0,
        grandTotal: 0,
        encounterId,
      };
      await this.documentsService.generateDocument(
        tenantId,
        'RECEIPT',
        receiptPayload as unknown as Record<string, unknown>,
        encounterId,
        'ENCOUNTER',
        actorUserId,
        correlationId ?? crypto.randomUUID(),
      );
    } catch (err) {
      // Non-fatal: receipt generation failure must not block order placement
      console.error('[encounters] Failed to auto-generate receipt after order-lab:', (err as Error).message);
    }

    return updatedEncounter;
  }

  async collectSpecimen(
    tenantId: string,
    encounterId: string,
    body: { labOrderId?: string; barcode?: string; type?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertLimsEnabled(tenantId);
    const encounter = await this.getEncounterOrThrow(tenantId, encounterId);

    if (!VALID_TRANSITIONS[encounter.status]?.includes('specimen_collected')) {
      throw new ConflictException(`Cannot collect specimen for encounter in status '${encounter.status}'`);
    }

    // If no labOrderId provided, find the first ordered lab order
    const labOrderId = body.labOrderId ?? (
      await this.prisma.labOrder.findFirst({ where: { encounterId, tenantId, status: 'ordered' } })
    )?.id;
    if (!labOrderId) throw new NotFoundException('Lab order not found in this encounter');

    const barcode = body.barcode ?? `BC-${Date.now()}`;
    const specimenType = body.type ?? 'blood';

    const [, updatedEncounter] = await this.prisma.$transaction([
      this.prisma.specimen.create({
        data: {
          tenantId,
          labOrderId,
          barcode,
          type: specimenType,
          status: 'collected',
          collectedAt: new Date(),
        },
      }),
      this.prisma.labOrder.update({ where: { id: labOrderId }, data: { status: 'specimen_collected' } }),
      this.prisma.encounter.update({
        where: { id: encounterId },
        data: { status: 'specimen_collected' },
        include: { patient: true, labOrders: { include: { specimen: true, results: true } } },
      }),
    ]).then(([_spec, _order, enc]) => [_spec, enc]);

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.collect-specimen', entityType: 'Encounter', entityId: encounterId, before: { status: encounter.status }, after: { status: 'specimen_collected', barcode }, correlationId });
    return updatedEncounter;
  }

  async receiveSpecimen(
    tenantId: string,
    encounterId: string,
    body: { labOrderId?: string; receivedAt?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertLimsEnabled(tenantId);
    const encounter = await this.getEncounterOrThrow(tenantId, encounterId);

    if (!VALID_TRANSITIONS[encounter.status]?.includes('specimen_received')) {
      throw new ConflictException(`Cannot receive specimen for encounter in status '${encounter.status}'`);
    }

    const specimen = await this.prisma.specimen.findFirst({
      where: { labOrder: { encounterId, tenantId }, tenantId },
    });
    if (!specimen) throw new NotFoundException('No specimen found for this encounter');

    const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();

    const [, updatedEncounter] = await this.prisma.$transaction([
      this.prisma.specimen.update({
        where: { id: specimen.id },
        data: { status: 'received', receivedAt },
      }),
      this.prisma.encounter.update({
        where: { id: encounterId },
        data: { status: 'specimen_received' },
        include: { patient: true, labOrders: { include: { specimen: true, results: true } } },
      }),
    ]);

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.receive-specimen', entityType: 'Encounter', entityId: encounterId, before: { status: encounter.status }, after: { status: 'specimen_received', receivedAt: receivedAt.toISOString() }, correlationId });
    return updatedEncounter;
  }

  async enterResult(
    tenantId: string,
    encounterId: string,
    body: { labOrderId: string; value: string; unit?: string; referenceRange?: string; flag?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    await this.assertLimsEnabled(tenantId);
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
          enteredById: actorUserId,
        },
      }),
      this.prisma.labOrder.update({ where: { id: body.labOrderId }, data: { status: 'resulted' } }),
      this.prisma.encounter.update({
        where: { id: encounterId },
        data: { status: 'resulted' },
        include: { patient: true, labOrders: { include: { specimen: true, results: true } } },
      }),
    ]).then(([_res, _order, enc]) => [_res, enc]);

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.result', entityType: 'Encounter', entityId: encounterId, before: { status: encounter.status }, after: { status: 'resulted', labOrderId: body.labOrderId }, correlationId });
    return updatedEncounter;
  }

  async verify(tenantId: string, encounterId: string, actorUserId: string, correlationId?: string) {
    await this.assertLimsEnabled(tenantId);
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
        include: { patient: true, labOrders: { include: { specimen: true, results: true } } },
      });
    });

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.verify', entityType: 'Encounter', entityId: encounterId, before: { status: 'resulted' }, after: { status: 'verified' }, correlationId });

    // Auto-generate and publish lab report PDF
    try {
      await this.documentsService.generateFromEncounter(
        tenantId,
        encounterId,
        actorUserId,
        correlationId ?? crypto.randomUUID(),
      );
    } catch (err) {
      // Non-fatal: document generation failure should not block verification
      console.error('[encounters] Failed to auto-generate document after verify:', (err as Error).message);
    }

    return updatedEncounter;
  }

  async cancel(tenantId: string, encounterId: string, actorUserId: string, correlationId?: string) {
    await this.assertLimsEnabled(tenantId);
    const encounter = await this.getEncounterOrThrow(tenantId, encounterId);

    if (!VALID_TRANSITIONS[encounter.status]?.includes('cancelled')) {
      throw new ConflictException(`Cannot cancel encounter in status '${encounter.status}'`);
    }

    const updatedEncounter = await this.prisma.encounter.update({
      where: { id: encounterId },
      data: { status: 'cancelled' },
      include: { patient: true, labOrders: { include: { specimen: true, results: true } } },
    });

    await this.audit.log({ tenantId, actorUserId, action: 'encounter.cancel', entityType: 'Encounter', entityId: encounterId, before: { status: encounter.status }, after: { status: 'cancelled' }, correlationId });
    return updatedEncounter;
  }
}
