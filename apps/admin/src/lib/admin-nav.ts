import { hasAnyPermission, type CurrentAdminUser } from '@/lib/rbac';

export type AdminNavItem = {
  href: string;
  label: string;
  icon?: string;
  requiredPermissions?: string[];
  children?: Array<{
    href: string;
    label: string;
    requiredPermissions?: string[];
  }>;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'D' },
  { href: '/tenants', label: 'Tenants', icon: 'T', requiredPermissions: ['tenant.read'] },
  {
    href: '/tenant-settings',
    label: 'Tenant Back Office',
    icon: 'TB',
    requiredPermissions: ['tenant.read', 'branding.read', 'feature_flag.read'],
    children: [
      { href: '/tenant-settings', label: 'Overview', requiredPermissions: ['tenant.read'] },
      { href: '/tenant-settings/users', label: 'Users', requiredPermissions: ['user.read'] },
      { href: '/tenant-settings/roles', label: 'Roles', requiredPermissions: ['role.read'] },
      { href: '/tenant-settings/catalog', label: 'Catalog', requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/tenant-settings/documents', label: 'Documents', requiredPermissions: ['document.generate', 'document.publish'] },
      { href: '/branding', label: 'Branding & Config', requiredPermissions: ['branding.read'] },
      { href: '/feature-flags', label: 'Feature Flags', requiredPermissions: ['feature_flag.read'] },
    ],
  },
  {
    href: '/users',
    label: 'Users & Roles',
    icon: 'U',
    requiredPermissions: ['user.read', 'role.read'],
    children: [
      { href: '/users', label: 'Users', requiredPermissions: ['user.read'] },
      { href: '/roles', label: 'Roles', requiredPermissions: ['role.read'] },
    ],
  },
  {
    href: '/catalog',
    label: 'Catalog',
    icon: 'C',
    requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'],
    children: [
      { href: '/catalog/tests', label: 'Tests', requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/catalog/parameters', label: 'Parameters', requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/catalog/panels', label: 'Panels', requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/catalog/reference-ranges', label: 'Reference Ranges', requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/catalog/import-export', label: 'Import / Export', requiredPermissions: ['catalog.read', 'catalog.manage'] },
    ],
  },
  {
    href: '/patients',
    label: 'Patients',
    icon: 'P',
    requiredPermissions: ['patient.manage', 'encounter.manage'],
    children: [
      { href: '/patients', label: 'Patients', requiredPermissions: ['patient.manage'] },
      { href: '/encounters', label: 'Encounters', requiredPermissions: ['encounter.manage'] },
    ],
  },
  { href: '/documents', label: 'Documents', icon: 'Doc', requiredPermissions: ['document.generate', 'document.publish'] },
  { href: '/audit', label: 'Audit Log', icon: 'A', requiredPermissions: ['audit.read'] },
  { href: '/jobs', label: 'Jobs', icon: 'J', requiredPermissions: ['job.read'] },
  { href: '/system/health', label: 'System Health', icon: 'H' },
];

export const ADMIN_OPD_NAV_ITEMS: AdminNavItem[] = [
  { href: '/opd', label: 'OPD Admin', icon: 'OPD', requiredPermissions: ['tenant.read'] },
  {
    href: '/opd/providers',
    label: 'Providers',
    icon: 'PR',
    requiredPermissions: ['module.admin'],
  },
  {
    href: '/opd/schedules',
    label: 'Schedules',
    icon: 'SC',
    requiredPermissions: ['module.admin'],
  },
  {
    href: '/opd/feature-flags',
    label: 'Feature Flags',
    icon: 'FF',
    requiredPermissions: ['feature_flag.read', 'tenant.read'],
  },
];

function filterVisible(items: AdminNavItem[], user: CurrentAdminUser): AdminNavItem[] {
  return items.flatMap((item) => {
    const visibleChildren = (item.children ?? []).filter((child) => hasAnyPermission(user, child.requiredPermissions));
    const parentVisible = hasAnyPermission(user, item.requiredPermissions);

    if (!parentVisible && visibleChildren.length === 0) return [];

    return [{ ...item, children: visibleChildren.length ? visibleChildren : undefined }];
  });
}

export function getVisibleAdminNav(user: CurrentAdminUser): AdminNavItem[] {
  return filterVisible(ADMIN_NAV_ITEMS, user);
}

export function getVisibleAdminOpdNav(user: CurrentAdminUser): AdminNavItem[] {
  return filterVisible(ADMIN_OPD_NAV_ITEMS, user);
}
