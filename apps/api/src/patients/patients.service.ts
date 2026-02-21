import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, opts: { page?: number; limit?: number; lastName?: string; mrn?: string } = {}) {
    const { page = 1, limit = 20, lastName, mrn } = opts;
    const where: any = { tenantId };
    if (lastName) where.lastName = { contains: lastName, mode: 'insensitive' };
    if (mrn) where.mrn = mrn;

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { lastName: 'asc' } }),
      this.prisma.patient.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(
    tenantId: string,
    body: { firstName: string; lastName: string; mrn: string; dateOfBirth?: string; gender?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    const existing = await this.prisma.patient.findUnique({ where: { tenantId_mrn: { tenantId, mrn: body.mrn } } });
    if (existing) throw new ConflictException(`MRN '${body.mrn}' already exists in tenant`);

    const patient = await this.prisma.patient.create({
      data: {
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        mrn: body.mrn,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender,
      },
    });

    await this.audit.log({ tenantId, actorUserId, action: 'patient.create', entityType: 'Patient', entityId: patient.id, after: body, correlationId });
    return patient;
  }

  async getById(tenantId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id, tenantId } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(
    tenantId: string,
    id: string,
    body: { firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string },
    actorUserId: string,
    correlationId?: string,
  ) {
    const patient = await this.prisma.patient.findFirst({ where: { id, tenantId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const updated = await this.prisma.patient.update({
      where: { id },
      data: {
        ...body,
        dateOfBirth: body.dateOfBirth !== undefined ? (body.dateOfBirth ? new Date(body.dateOfBirth) : null) : undefined,
      },
    });

    await this.audit.log({ tenantId, actorUserId, action: 'patient.update', entityType: 'Patient', entityId: id, before: patient, after: body, correlationId });
    return updated;
  }
}
