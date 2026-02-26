import {
  LayoutDashboard, Users, ShieldCheck, FlaskConical, UserRound, FileText,
  Palette, ToggleLeft, ClipboardList, Briefcase, ScrollText, Activity,
  Building2, Stethoscope, CalendarDays, type LucideIcon,
} from 'lucide-react';
import { hasAnyPermission, type CurrentAdminUser } from '@/lib/rbac';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: string;       // Section header rendered above this item
  requiredPermissions?: string[];
  children?: Array<{
    href: string;
    label: string;
    requiredPermissions?: string[];
  }>;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    section: 'Overview',
  },

  // ─── Operations ─────────────────────────────────────────────────────
  {
    href: '/patients',
    label: 'Patients',
    icon: UserRound,
    section: 'Operations',
    requiredPermissions: ['patient.manage'],
  },
  {
    href: '/encounters',
    label: 'Encounters',
    icon: ClipboardList,
    requiredPermissions: ['encounter.manage'],
  },
  {
    href: '/documents',
    label: 'Documents',
    icon: FileText,
    requiredPermissions: ['document.generate', 'document.publish'],
  },

  // ─── LIMS ────────────────────────────────────────────────────────────
  {
    href: '/catalog',
    label: 'Catalog',
    icon: FlaskConical,
    section: 'LIMS',
    requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'],
    children: [
      { href: '/catalog',                  label: 'Overview',          requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/catalog/tests',            label: 'Tests',             requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/catalog/parameters',       label: 'Parameters',        requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/catalog/panels',           label: 'Panels',            requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/catalog/reference-ranges', label: 'Reference Ranges',  requiredPermissions: ['catalog.read', 'catalog.manage', 'catalog.write'] },
      { href: '/catalog/import-export',    label: 'Import / Export',   requiredPermissions: ['catalog.read', 'catalog.manage'] },
    ],
  },

  // ─── Settings ────────────────────────────────────────────────────────
  {
    href: '/tenants',
    label: 'Tenants',
    icon: Building2,
    section: 'Settings',
    requiredPermissions: ['tenant.read'],
  },
  {
    href: '/users',
    label: 'Users & Roles',
    icon: Users,
    requiredPermissions: ['user.read', 'role.read'],
    children: [
      { href: '/users', label: 'Users', requiredPermissions: ['user.read'] },
      { href: '/roles', label: 'Roles', requiredPermissions: ['role.read'] },
    ],
  },
  {
    href: '/branding',
    label: 'Branding',
    icon: Palette,
    requiredPermissions: ['branding.read'],
  },
  {
    href: '/feature-flags',
    label: 'Feature Flags',
    icon: ToggleLeft,
    requiredPermissions: ['feature_flag.read'],
  },

  // ─── System ──────────────────────────────────────────────────────────
  {
    href: '/audit',
    label: 'Audit Log',
    icon: ScrollText,
    section: 'System',
    requiredPermissions: ['audit.read'],
  },
  {
    href: '/jobs',
    label: 'Jobs',
    icon: Briefcase,
    requiredPermissions: ['job.read'],
  },
  {
    href: '/system/health',
    label: 'System Health',
    icon: Activity,
  },
];

export const ADMIN_OPD_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/opd',
    label: 'OPD Overview',
    icon: Stethoscope,
    section: 'OPD',
    requiredPermissions: ['tenant.read'],
  },
  {
    href: '/opd/providers',
    label: 'Providers',
    icon: UserRound,
    requiredPermissions: ['module.admin'],
  },
  {
    href: '/opd/schedules',
    label: 'Schedules',
    icon: CalendarDays,
    requiredPermissions: ['module.admin'],
  },
  {
    href: '/feature-flags',
    label: 'Feature Flags',
    icon: ToggleLeft,
    section: 'Settings',
    requiredPermissions: ['feature_flag.read'],
  },
];

function filterVisible(items: AdminNavItem[], user: CurrentAdminUser): AdminNavItem[] {
  return items.flatMap((item) => {
    const visibleChildren = (item.children ?? []).filter((child) =>
      hasAnyPermission(user, child.requiredPermissions),
    );
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
