import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, opts: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 20, status } = opts;
    const where: any = { tenantId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, tenantId: true, email: true, firstName: true,
          lastName: true, status: true, createdAt: true,
          userRoles: { include: { role: { select: { name: true } } } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u) => ({
        ...u,
        roles: u.userRoles.map((ur) => ur.role.name),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return { ...user, roles: user.userRoles.map((ur) => ur.role.name), passwordHash: undefined };
  }

  async create(
    tenantId: string,
    body: { email: string; firstName: string; lastName: string; password: string; roles?: string[] },
    actorUserId: string,
    correlationId?: string,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: body.email } },
    });
    if (existing) throw new ConflictException('Email already in use within tenant');

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await this.prisma.user.create({
      data: { tenantId, email: body.email, firstName: body.firstName, lastName: body.lastName, passwordHash },
      include: { userRoles: { include: { role: true } } },
    });

    await this.audit.log({
      tenantId, actorUserId, action: 'user.create',
      entityType: 'User', entityId: user.id,
      after: { email: user.email, firstName: user.firstName, lastName: user.lastName },
      correlationId,
    });

    return { ...user, roles: [], passwordHash: undefined };
  }

  async update(
    tenantId: string, userId: string,
    body: { firstName?: string; lastName?: string; status?: string },
    actorUserId: string, correlationId?: string,
  ) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const before = { firstName: user.firstName, lastName: user.lastName, status: user.status };

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: body,
        include: { userRoles: { include: { role: true } } },
      });
      // Revoke all refresh tokens if user is being disabled
      if (body.status === 'disabled') {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return u;
    });

    await this.audit.log({
      tenantId, actorUserId, action: 'user.update',
      entityType: 'User', entityId: userId,
      before, after: body, correlationId,
    });

    return { ...updated, roles: updated.userRoles.map((ur) => ur.role.name), passwordHash: undefined };
  }

  async getRoles(tenantId: string, userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, user: { tenantId } },
      include: { role: { include: { rolePermissions: true } } },
    });
    return userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      permissions: ur.role.rolePermissions.map((rp) => rp.permission),
    }));
  }

  async setRoles(
    tenantId: string, userId: string,
    roleIds: string[],
    actorUserId: string,
    actorIsSuperAdmin: boolean,
    correlationId?: string,
  ) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const rolesBeingAssigned = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, tenantId },
      include: { rolePermissions: true },
    });

    if (!actorIsSuperAdmin) {
      const privilegedPerms = ['admin.super', 'role.create', 'role.delete'];
      const hasPrivileged = rolesBeingAssigned.some((r) =>
        r.rolePermissions.some((rp) => privilegedPerms.includes(rp.permission)),
      );
      if (hasPrivileged) {
        throw new ForbiddenException('Only super-admins can assign privileged roles');
      }
    }

    const before = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { name: true } } },
    });

    await this.prisma.userRole.deleteMany({ where: { userId } });
    await this.prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId, grantedBy: actorUserId })),
    });

    await this.audit.log({
      tenantId, actorUserId, action: 'role.assign',
      entityType: 'User', entityId: userId,
      before: { roles: before.map((ur) => ur.role.name) },
      after: { roleIds },
      correlationId,
    });

    return this.getRoles(tenantId, userId);
  }
}
