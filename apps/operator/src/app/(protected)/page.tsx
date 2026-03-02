'use client';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { logout } from '@/lib/auth';
import { useCurrentUser, invalidateCurrentUserCache, type CurrentUser } from '@/hooks/use-current-user';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModuleDef = {
  id: string;
  label: string;
  description: string;
  icon: string;
  flagKey: string | null; // null = always check only permissions
  href: string;
  requiredPerms: string[]; // user needs at least ONE of these
};

// ─── Module registry ──────────────────────────────────────────────────────────

const MODULE_DEFS: ModuleDef[] = [
  {
    id: 'lims',
    label: 'Laboratory (LIMS)',
    description: 'Patient registrations, sample collection, results entry, verification, and reports.',
    icon: '🧪',
    flagKey: 'module.lims',
    href: '/lims/worklist',
    requiredPerms: ['encounter.manage', 'result.enter', 'catalog.read', 'patient.manage'],
  },
  {
    id: 'opd',
    label: 'OPD / Clinic',
    description: 'Outpatient consultations, appointments, prescriptions, and billing.',
    icon: '🏥',
    flagKey: 'module.opd',
    href: '/opd/worklist',
    requiredPerms: ['encounter.manage', 'patient.manage'],
  },
  {
    id: 'rad',
    label: 'Radiology (RIMS)',
    description: 'Radiology orders, imaging workflows, and reports.',
    icon: '🩻',
    flagKey: 'module.rad',
    href: '/rims/worklist',
    requiredPerms: ['encounter.manage'],
  },
];

const ADMIN_MODULE = {
  id: 'admin',
  label: 'Admin Panel',
  description: 'Tenant configuration, user management, roles, catalog, and feature flags.',
  icon: '⚙️',
  href: '/admin/',
  requiredPerms: ['admin.super', 'tenant.read', 'tenant.create', 'tenant.update', 'role.read'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasAnyPerm(userPerms: string[], required: string[]): boolean {
  return required.some((p) => userPerms.includes(p));
}

function displayName(user: CurrentUser): string {
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }
  // Fall back to the part before @ in email
  return user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function tenantLabel(tenantId: string): string {
  if (tenantId === 'system') return 'System Tenant';
  return tenantId;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OperatorLandingPage() {
  const router = useRouter();
  const { flags, loading: flagsLoading } = useFeatureFlags();
  const { user, loading: userLoading } = useCurrentUser();

  const loading = flagsLoading || userLoading;
  const userPerms: string[] = user?.permissions ?? [];
  const isAdmin = Boolean(user?.isSuperAdmin) || hasAnyPerm(userPerms, ADMIN_MODULE.requiredPerms);

  // Resolve module visibility: feature flag enabled AND user has required permission
  const modules = useMemo(() => {
    return MODULE_DEFS.map((mod) => {
      const flagEnabled = mod.flagKey ? Boolean(flags?.[mod.flagKey]) : true;
      const canAccess = user?.isSuperAdmin || hasAnyPerm(userPerms, mod.requiredPerms);
      const isFeatureActive = flagEnabled || Boolean(user?.isSuperAdmin);
      return { ...mod, flagEnabled: isFeatureActive, canAccess, visible: isFeatureActive && canAccess };
    });
  }, [flags, user, userPerms]);

  const activeModules = modules.filter((m) => m.visible);
  const comingSoonModules = modules.filter((m) => !m.visible && !m.flagEnabled);

  function handleLogout() {
    invalidateCurrentUserCache();
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted">
      {/* Top bar */}
      <header className="border-b border-border bg-card/95 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-extrabold text-primary-foreground tracking-tight">Vexel</span>
          <span className="text-muted-foreground text-sm hidden sm:inline">Health Platform</span>
        </div>
        {!userLoading && user && (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-foreground">{displayName(user)}</p>
              <p className="text-xs text-muted-foreground">{user.roles.join(', ')}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-sm font-bold text-primary">
              {displayName(user).charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-[hsl(var(--status-destructive-fg))] transition-colors px-2 py-1 rounded hover:bg-muted"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="mb-8">
          {!loading && user ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-1">
                {greeting()}, {displayName(user).split(' ')[0]}!
              </h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  🏢 {tenantLabel(user.tenantId)}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  {activeModules.length + (isAdmin ? 1 : 0)} module{activeModules.length + (isAdmin ? 1 : 0) !== 1 ? 's' : ''} active
                </span>
                {user.isSuperAdmin && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))] border border-[hsl(var(--status-warning-border))]">
                    ⭐ Super Admin
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
          )}
        </div>

        {/* Active modules */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-52 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {(activeModules.length > 0 || isAdmin) && (
              <>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Active Modules
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {activeModules.map((mod) => (
                    <button
                      key={mod.id}
                      onClick={() => router.push(mod.href)}
                      className={cn(
                        'text-left rounded-2xl p-6 border-2 transition-all duration-150 group',
                        'bg-muted/60 border-primary/40 hover:border-primary hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10 cursor-pointer',
                      )}
                    >
                      <div className="text-3xl mb-3">{mod.icon}</div>
                      <h3 className="text-base font-bold text-foreground mb-1.5">{mod.label}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-4">{mod.description}</p>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                        Open <span>→</span>
                      </span>
                    </button>
                  ))}

                  {/* Admin Panel card */}
                  {isAdmin && (
                    <button
                      onClick={() => window.open(ADMIN_MODULE.href, '_blank')}
                      className={cn(
                        'text-left rounded-2xl p-6 border-2 transition-all duration-150 group',
                        'bg-muted/60 border-[hsl(var(--status-warning-border))] hover:border-[hsl(var(--status-warning-fg))] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[hsl(var(--status-warning-bg))]/30 cursor-pointer',
                      )}
                    >
                      <div className="text-3xl mb-3">{ADMIN_MODULE.icon}</div>
                      <h3 className="text-base font-bold text-foreground mb-1.5">{ADMIN_MODULE.label}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-4">{ADMIN_MODULE.description}</p>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--status-warning-fg))] group-hover:gap-2.5 transition-all">
                        Open <span>→</span>
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* No access state */}
            {activeModules.length === 0 && !isAdmin && (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-4xl mb-4">🔒</p>
                <p className="text-base font-medium text-muted-foreground">No modules available</p>
                <p className="text-sm mt-1">Your account does not have access to any active modules. Contact your administrator.</p>
              </div>
            )}

            {/* Coming soon */}
            {comingSoonModules.length > 0 && (
              <>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Coming Soon
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {comingSoonModules.map((mod) => (
                    <div
                      key={mod.id}
                      className="rounded-2xl p-6 border-2 border-border bg-card/60 opacity-50 cursor-default"
                    >
                      <div className="text-3xl mb-3 grayscale">{mod.icon}</div>
                      <h3 className="text-base font-bold text-muted-foreground mb-1.5">{mod.label}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-4">{mod.description}</p>
                      <span className="inline-flex items-center px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                        Coming soon
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
