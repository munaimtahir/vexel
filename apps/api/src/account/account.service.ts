import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Permission } from '../rbac/permissions';

type AuthUser = {
  userId: string;
  email: string;
  tenantId: string;
  roles?: string[];
  permissions?: string[];
  isSuperAdmin?: boolean;
};

type AdminNavSection = {
  key: string;
  label: string;
  href: string;
  requiredAny: string[];
};

const ADMIN_NAV_ORDER: AdminNavSection[] = [
  { key: 'account', label: 'My Account', href: '/account', requiredAny: [] },
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', requiredAny: ['admin.dashboard.read', 'tenant.read'] },
  { key: 'catalog', label: 'Catalog', href: '/catalog', requiredAny: ['admin.catalog.read', 'admin.catalog.write', 'catalog.read', 'catalog.manage', 'catalog.write'] },
  { key: 'audit', label: 'Audit Log', href: '/audit', requiredAny: ['admin.audit.read', 'audit.read'] },
  { key: 'jobs', label: 'Jobs', href: '/jobs', requiredAny: ['admin.jobs.read', 'admin.jobs.retry', 'job.read', 'job.retry'] },
  { key: 'users', label: 'Users', href: '/users', requiredAny: ['admin.users.read', 'admin.users.write', 'user.read', 'user.create', 'user.update', 'user.disable'] },
  { key: 'roles', label: 'Roles', href: '/roles', requiredAny: ['admin.roles.read', 'admin.roles.write', 'role.read', 'role.create', 'role.update', 'role.delete', 'role.assign'] },
  { key: 'tenants', label: 'Tenants', href: '/tenants', requiredAny: ['admin.tenants.read', 'admin.tenants.write', 'tenant.read', 'tenant.create', 'tenant.update'] },
  { key: 'featureFlags', label: 'Feature Flags', href: '/feature-flags', requiredAny: ['admin.feature_flags.read', 'admin.feature_flags.write', 'feature_flag.read', 'feature_flag.set'] },
];

const ADMIN_LANDING_PRIORITY = [
  '/dashboard',
  '/catalog',
  '/audit',
  '/jobs',
  '/users',
  '/roles',
  '/tenants',
  '/feature-flags',
];

const LEGACY_ADMIN_ACCESS_PERMISSIONS = [
  'tenant.read',
  'tenant.create',
  'tenant.update',
  'user.read',
  'user.create',
  'user.update',
  'user.disable',
  'role.read',
  'role.create',
  'role.update',
  'role.delete',
  'role.assign',
  'feature_flag.read',
  'feature_flag.set',
  'catalog.read',
  'catalog.manage',
  'catalog.write',
  'audit.read',
  'job.read',
  'job.retry',
  'ops.view',
  'branding.read',
  'branding.write',
];

function hasAnyPermission(grantedPermissions: string[], requiredAny: string[]): boolean {
  if (requiredAny.length === 0) return true;
  const grantedSet = new Set(grantedPermissions);
  return requiredAny.some((permission) => grantedSet.has(permission));
}

function toDisplayName(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMe(user: AuthUser) {
    const dbUser = await this.prisma.user.findFirst({
      where: { id: user.userId, tenantId: user.tenantId, status: 'active' },
      include: {
        tenant: { select: { name: true } },
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });
    if (!dbUser) throw new UnauthorizedException('User not found');

    return {
      userId: dbUser.id,
      email: dbUser.email,
      displayName: toDisplayName(dbUser.firstName, dbUser.lastName) || dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      tenantId: dbUser.tenantId,
      tenantName: dbUser.tenant?.name ?? null,
      roles: dbUser.userRoles.map((userRole) => userRole.role.name),
      permissions: user.permissions ?? [],
      isSuperAdmin: Boolean(user.isSuperAdmin),
    };
  }

  async updateMe(user: AuthUser, body: { displayName: string }, correlationId?: string) {
    const displayName = body.displayName?.trim().replace(/\s+/g, ' ');
    if (!displayName) throw new BadRequestException('Display name is required');

    const current = await this.prisma.user.findFirst({
      where: { id: user.userId, tenantId: user.tenantId, status: 'active' },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!current) throw new UnauthorizedException('User not found');

    const parts = displayName.split(' ');
    const firstName = parts.shift() ?? current.firstName;
    const derivedLastName = parts.join(' ').trim();
    const lastName = derivedLastName || current.lastName || 'User';

    await this.prisma.user.update({
      where: { id: current.id },
      data: { firstName, lastName },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      action: 'account.profile.update_self',
      entityType: 'User',
      entityId: user.userId,
      before: {
        displayName: toDisplayName(current.firstName, current.lastName),
        firstName: current.firstName,
        lastName: current.lastName,
      },
      after: { displayName, firstName, lastName },
      correlationId,
    });

    return this.getMe(user);
  }

  async changePassword(
    user: AuthUser,
    body: { currentPassword: string; newPassword: string },
    correlationId?: string,
  ) {
    const currentPassword = body.currentPassword?.trim();
    const newPassword = body.newPassword?.trim();
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Current and new password are required');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const dbUser = await this.prisma.user.findFirst({
      where: { id: user.userId, tenantId: user.tenantId, status: 'active' },
      select: { id: true, passwordHash: true },
    });
    if (!dbUser) throw new UnauthorizedException('User not found');

    const validCurrent = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!validCurrent) throw new BadRequestException('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: dbUser.id }, data: { passwordHash: newHash } });
      await tx.refreshToken.updateMany({
        where: { userId: dbUser.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      action: 'account.password.change_self',
      entityType: 'User',
      entityId: user.userId,
      metadata: { revokeRefreshTokens: true },
      correlationId,
    });

    return { ok: true, message: 'Password updated successfully' };
  }

  getAdminNavigationSummary(user: AuthUser) {
    const grantedPermissions = user.permissions ?? [];
    const isSuperAdmin = Boolean(user.isSuperAdmin);

    const sections = ADMIN_NAV_ORDER.map((section) => ({
      key: section.key,
      label: section.label,
      href: section.href,
      allowed: isSuperAdmin || hasAnyPermission(grantedPermissions, section.requiredAny),
    }));

    const hasAnyAdminPermission = isSuperAdmin
      || grantedPermissions.some((permission) => permission.startsWith('admin.'));
    const hasLegacyAdminAccess = hasAnyPermission(grantedPermissions, LEGACY_ADMIN_ACCESS_PERMISSIONS);
    const hasAdminAppAccess = isSuperAdmin
      || grantedPermissions.includes(Permission.ADMIN_APP_ACCESS)
      || hasAnyAdminPermission
      || hasLegacyAdminAccess;
    const landingPath = hasAdminAppAccess
      ? (ADMIN_LANDING_PRIORITY.find((href) => sections.find((section) => section.href === href)?.allowed) ?? '/account')
      : '/account';

    return {
      hasAdminAppAccess,
      hasAnyAdminPermission,
      landingPath,
      sections,
    };
  }

  getAdminLanding(user: AuthUser) {
    return { landingPath: this.getAdminNavigationSummary(user).landingPath };
  }
}
