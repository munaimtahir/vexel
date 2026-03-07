export type AdminCapability = {
  key: string;
  href: string;
  permissionAny: string[];
};

export const ADMIN_CAPABILITIES: AdminCapability[] = [
  { key: 'account', href: '/account', permissionAny: [] },
  { key: 'dashboard', href: '/dashboard', permissionAny: ['admin.dashboard.read', 'tenant.read'] },
  { key: 'catalog', href: '/catalog', permissionAny: ['admin.catalog.read', 'admin.catalog.write', 'catalog.read', 'catalog.manage', 'catalog.write'] },
  { key: 'audit', href: '/audit', permissionAny: ['admin.audit.read', 'audit.read'] },
  { key: 'jobs', href: '/jobs', permissionAny: ['admin.jobs.read', 'admin.jobs.retry', 'job.read', 'job.retry'] },
  { key: 'users', href: '/users', permissionAny: ['admin.users.read', 'admin.users.write', 'user.read', 'user.create', 'user.update', 'user.disable'] },
  { key: 'roles', href: '/roles', permissionAny: ['admin.roles.read', 'admin.roles.write', 'role.read', 'role.create', 'role.update', 'role.delete', 'role.assign'] },
  { key: 'tenants', href: '/tenants', permissionAny: ['admin.tenants.read', 'admin.tenants.write', 'tenant.read', 'tenant.create', 'tenant.update'] },
  { key: 'feature-flags', href: '/feature-flags', permissionAny: ['admin.feature_flags.read', 'admin.feature_flags.write', 'feature_flag.read', 'feature_flag.set'] },
];

export function hasAnyPermission(permissions: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  const granted = new Set(permissions);
  return required.some((permission) => granted.has(permission));
}

export function resolveAdminLanding(permissions: string[] = [], isSuperAdmin = false): string {
  const legacyAdminAccessPermissions = [
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
  const hasAnyAdminPermission = isSuperAdmin
    || permissions.some((permission) => permission.startsWith('admin.'));
  const hasLegacyAdminAccess = hasAnyPermission(permissions, legacyAdminAccessPermissions);
  const hasAdminAppAccess = isSuperAdmin
    || permissions.includes('admin.app.access')
    || hasAnyAdminPermission
    || hasLegacyAdminAccess;
  if (!hasAdminAppAccess) return '/account';

  // Super-admin always lands on dashboard regardless of explicit capability permissions
  if (isSuperAdmin) return '/dashboard';

  const priority = ['/dashboard', '/catalog', '/audit', '/jobs', '/users', '/roles', '/tenants', '/feature-flags'];
  for (const href of priority) {
    const capability = ADMIN_CAPABILITIES.find((item) => item.href === href);
    if (capability && hasAnyPermission(permissions, capability.permissionAny)) return href;
  }
  return '/account';
}
