import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ALL_PERMISSIONS } from '../rbac/permissions';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: { rolePermissions: true },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id, name: r.name, description: r.description,
      isSystem: r.isSystem, createdAt: r.createdAt,
      permissions: r.rolePermissions.map((rp) => rp.permission),
    }));
  }

  async create(
    tenantId: string,
    body: { name: string; description?: string; permissions?: string[] },
    actorUserId: string, correlationId?: string,
  ) {
    const existing = await this.prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name: body.name } },
    });
    if (existing) throw new ConflictException('Role name already exists in tenant');

    const permissions = (body.permissions ?? []).filter((p) => ALL_PERMISSIONS.includes(p as any));
    const role = await this.prisma.role.create({
      data: {
        tenantId, name: body.name, description: body.description,
        rolePermissions: { create: permissions.map((p) => ({ permission: p })) },
      },
      include: { rolePermissions: true },
    });

    await this.audit.log({
      tenantId, actorUserId, action: 'role.create',
      entityType: 'Role', entityId: role.id,
      after: { name: role.name, permissions }, correlationId,
    });

    return { ...role, permissions: role.rolePermissions.map((rp) => rp.permission) };
  }

  async update(
    tenantId: string, roleId: string,
    body: { name?: string; description?: string; permissions?: string[] },
    actorUserId: string, correlationId?: string,
  ) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException('Role not found');

    const before = await this.prisma.rolePermission.findMany({ where: { roleId } });

    await this.prisma.$transaction(async (tx) => {
      if (body.permissions !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        const permissions = body.permissions.filter((p) => ALL_PERMISSIONS.includes(p as any));
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId, permission: p })),
        });
      }
      if (body.name || body.description !== undefined) {
        await tx.role.update({
          where: { id: roleId },
          data: { name: body.name, description: body.description },
        });
      }
    });

    await this.audit.log({
      tenantId, actorUserId, action: 'role.update',
      entityType: 'Role', entityId: roleId,
      before: { permissions: before.map((rp) => rp.permission) },
      after: body, correlationId,
    });

    const updated = await this.prisma.role.findUnique({
      where: { id: roleId }, include: { rolePermissions: true },
    });
    return { ...updated, permissions: updated?.rolePermissions.map((rp) => rp.permission) };
  }

  async delete(
    tenantId: string,
    roleId: string,
    actorUserId: string,
    correlationId?: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
      include: { rolePermissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ConflictException('System roles cannot be deleted');

    const userRoleCount = await this.prisma.userRole.count({ where: { roleId } });

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { roleId } });
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.role.delete({ where: { id: roleId } });
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: 'role.delete',
      entityType: 'Role',
      entityId: roleId,
      before: { name: role.name, permissions: role.rolePermissions.map((rp) => rp.permission) },
      after: { deleted: true, removedUserAssignments: userRoleCount },
      correlationId,
    });
  }

  listPermissions() {
    return ALL_PERMISSIONS;
  }
}
