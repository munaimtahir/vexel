import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    tenantId: string,
    opts: { page?: number; limit?: number; lastName?: string; mrn?: string; mobile?: string } = {},
  ) {
    const { lastName, mrn, mobile } = opts;
    const page = Number(opts.page ?? 1);
    const limit = Number(opts.limit ?? 20);
    const where: any = { tenantId };
    if (lastName) where.lastName = { contains: lastName, mode: 'insensitive' };
    if (mrn) where.mrn = mrn;
    if (mobile) where.mobile = mobile;

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.patient.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findByMobile(tenantId: string, mobile: string) {
    return this.prisma.patient.findFirst({ where: { tenantId, mobile } });
  }

  async generateMrn(tenantId: string): Promise<string> {
    const config = await this.prisma.tenantConfig.findUnique({ where: { tenantId } });
    const prefix = config?.registrationPrefix ?? 'PT';
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
    const count = await this.prisma.patient.count({
      where: { tenantId, createdAt: { gte: yearStart, lt: yearEnd } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}-${yy}-${seq}`;
  }

  async create(
    tenantId: string,
    body: {
      firstName: string;
      lastName: string;
      mrn?: string;
      dateOfBirth?: string;
      gender?: string;
      mobile?: string;
      cnic?: string;
      address?: string;
      ageYears?: number;
    },
    actorUserId: string,
    correlationId?: string,
  ) {
    const mrn = body.mrn ?? (await this.generateMrn(tenantId));
    const existing = await this.prisma.patient.findUnique({ where: { tenantId_mrn: { tenantId, mrn } } });
    if (existing) throw new ConflictException(`MRN '${mrn}' already exists in tenant`);

    const patient = await this.prisma.patient.create({
      data: {
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        mrn,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender,
        mobile: body.mobile,
        cnic: body.cnic,
        address: body.address,
        ageYears: body.ageYears,
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
