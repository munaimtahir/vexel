'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { hasAnyPermission } from '@/lib/rbac';
import { useCurrentUser } from '@/lib/use-auth';
import { PermissionGuard } from '@/components/permission-guard';

type TenantSummary = {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'trial' | string;
  domains?: Array<string | { domain?: string }>;
};

type FeatureFlag = {
  key: string;
  enabled: boolean;
  variantJson?: string | null;
  description?: string;
};

type TenantConfig = Record<string, string>;

const CONFIG_FIELDS = [
  { key: 'brandName', label: 'Brand Name' },
  { key: 'logoUrl', label: 'Logo URL' },
  { key: 'primaryColor', label: 'Primary Color' },
  { key: 'headerText', label: 'App Header Text' },
  { key: 'footerText', label: 'App Footer Text' },
  { key: 'reportHeader', label: 'Report Header' },
  { key: 'reportFooter', label: 'Report Footer' },
] as const;

const CORE_FLAG_KEYS = [
  'module.lims',
  'module.opd',
  'lims.auto_verify',
  'lims.verification.enabled',
  'lims.operator.verificationPages.enabled',
];

function badgeClasses(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800 border border-green-200';
  if (status === 'trial') return 'bg-amber-100 text-amber-800 border border-amber-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
}

function parseDomains(input: string) {
  return input.split(',').map((d) => d.trim()).filter(Boolean);
}

function formatDomains(domains?: TenantSummary['domains']) {
  return (domains ?? []).map((d) => typeof d === 'string' ? d : (d?.domain ?? '')).filter(Boolean).join(', ');
}

function getFlagLabel(key: string) {
  return key.replace(/^module\./, '').replace(/^lims\./, 'LIMS ').replaceAll('.', ' ');
}

export default function TenantSettingsPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const api = useMemo(() => getApiClient(getToken() ?? undefined), []);

  const canReadTenants = hasAnyPermission(user, ['tenant.read']);
  const canUpdateTenants = hasAnyPermission(user, ['tenant.update']);
  const canReadBranding = hasAnyPermission(user, ['branding.read']);
  const canWriteBranding = hasAnyPermission(user, ['branding.write']);
  const canReadFlags = hasAnyPermission(user, ['feature_flag.read']);
  const canSetFlags = hasAnyPermission(user, ['feature_flag.set']);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [tenantForm, setTenantForm] = useState({ name: '', domains: '', status: 'trial' });
  const [config, setConfig] = useState<TenantConfig>({});
  const [flags, setFlags] = useState<FeatureFlag[]>([]);

  const [savingTenant, setSavingTenant] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingFlagKey, setSavingFlagKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canAccessPage = canReadTenants || canReadBranding || canReadFlags;

  async function loadTenantsAndDefault() {
    const meRes = await api.GET('/me');
    const myTenantId = (meRes.data as any)?.tenantId ?? '';

    let tenantList: TenantSummary[] = [];
    if (canReadTenants) {
      const tenantsRes = await api.GET('/tenants');
      tenantList = (tenantsRes.data?.data ?? []) as TenantSummary[];
    }

    setTenants(tenantList);
    const fallbackTenantId = tenantList[0]?.id ?? myTenantId ?? '';
    const nextTenantId = myTenantId && tenantList.some((t) => t.id === myTenantId) ? myTenantId : fallbackTenantId;
    setTenantId(nextTenantId);
    return nextTenantId;
  }

  async function loadTenantSectionData(targetTenantId: string) {
    if (!targetTenantId) return;

    const tasks: Promise<unknown>[] = [];

    if (canReadTenants) {
      tasks.push(
        api.GET('/tenants/{tenantId}' as any, { params: { path: { tenantId: targetTenantId } } }).then(({ data }) => {
          const tenant = data as TenantSummary;
          setTenantForm({
            name: tenant?.name ?? '',
            domains: formatDomains(tenant?.domains),
            status: tenant?.status ?? 'trial',
          });
        }),
      );
    }

    if (canReadBranding) {
      tasks.push(
        api.GET('/tenants/{tenantId}/config' as any, { params: { path: { tenantId: targetTenantId } } }).then(({ data }) => {
          setConfig((data ?? {}) as TenantConfig);
        }),
      );
    }

    if (canReadFlags) {
      tasks.push(
        api.GET('/tenants/{tenantId}/feature-flags' as any, { params: { path: { tenantId: targetTenantId } } }).then(({ data }) => {
          setFlags(((data as any[]) ?? []) as FeatureFlag[]);
        }),
      );
    }

    await Promise.all(tasks);
  }

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const target = tenantId || await loadTenantsAndDefault();
      if (target) await loadTenantSectionData(target);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load tenant settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userLoading) return;
    if (!canAccessPage) {
      setLoading(false);
      return;
    }
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, canAccessPage]);

  useEffect(() => {
    if (!tenantId || userLoading || !canAccessPage) return;
    loadTenantSectionData(tenantId).catch((e: any) => setError(e?.message ?? 'Failed to load tenant data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function pushNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2500);
  }

  async function saveTenant() {
    if (!tenantId || !canUpdateTenants) return;
    setSavingTenant(true);
    setError(null);
    try {
      await api.PATCH('/tenants/{tenantId}' as any, {
        params: { path: { tenantId } },
        body: {
          name: tenantForm.name,
          domains: parseDomains(tenantForm.domains),
          status: tenantForm.status,
        },
      });
      pushNotice('Tenant details saved');
      if (canReadTenants) {
        const tenantsRes = await api.GET('/tenants');
        setTenants((tenantsRes.data?.data ?? []) as TenantSummary[]);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save tenant details');
    } finally {
      setSavingTenant(false);
    }
  }

  async function saveConfig() {
    if (!tenantId || !canWriteBranding) return;
    setSavingConfig(true);
    setError(null);
    try {
      await api.PATCH('/tenants/{tenantId}/config' as any, {
        params: { path: { tenantId } },
        body: config,
      });
      pushNotice('Branding/config saved');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save branding/config');
    } finally {
      setSavingConfig(false);
    }
  }

  async function toggleFlag(flag: FeatureFlag) {
    if (!tenantId || !canSetFlags) return;
    setSavingFlagKey(flag.key);
    setError(null);
    try {
      await api.PUT('/tenants/{tenantId}/feature-flags' as any, {
        params: { path: { tenantId } },
        body: [{ key: flag.key, enabled: !flag.enabled, ...(flag.variantJson ? { variantJson: flag.variantJson } : {}) }],
      });
      const { data } = await api.GET('/tenants/{tenantId}/feature-flags' as any, { params: { path: { tenantId } } });
      setFlags((((data as any[]) ?? []) as FeatureFlag[]));
      pushNotice(`Flag updated: ${flag.key}`);
    } catch (e: any) {
      setError(e?.message ?? `Failed to update ${flag.key}`);
    } finally {
      setSavingFlagKey(null);
    }
  }

  const selectedTenant = tenants.find((t) => t.id === tenantId);
  const visibleFlags = flags.filter((f) => CORE_FLAG_KEYS.includes(f.key)).sort((a, b) => a.key.localeCompare(b.key));
  const effectiveTenantName = selectedTenant?.name || tenantForm.name || 'Current Tenant';

  if (userLoading || loading) {
    return <div className="p-2 text-sm text-slate-600">Loading tenant back office...</div>;
  }

  return (
    <PermissionGuard anyOf={['tenant.read', 'branding.read', 'feature_flag.read']} user={user} loading={userLoading}>
      <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tenant Back Office</h1>
            <p className="mt-1 text-sm text-slate-600">
              Tenant-scoped configuration and feature controls. Operational workflows remain in Operator.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 hover:bg-slate-100" href="/tenants">Tenants</Link>
            <Link className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 hover:bg-slate-100" href={tenantId ? `/branding?tenantId=${tenantId}` : '/branding'}>Branding</Link>
            <Link className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 hover:bg-slate-100" href={tenantId ? `/feature-flags?tenantId=${tenantId}` : '/feature-flags'}>Feature Flags</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tenant Scope</h2>
              <p className="text-sm text-slate-600">Select which tenant to configure in this section.</p>
            </div>
            {selectedTenant && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClasses(selectedTenant.status)}`}>
                {selectedTenant.status}
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Tenant</span>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={tenants.length === 0}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">RBAC Summary</div>
              <div className="mt-2 text-sm text-slate-700">
                {[
                  canReadTenants && 'Tenant Read',
                  canUpdateTenants && 'Tenant Update',
                  canReadBranding && 'Branding Read',
                  canWriteBranding && 'Branding Write',
                  canReadFlags && 'Flags Read',
                  canSetFlags && 'Flags Set',
                ].filter(Boolean).join(' • ') || 'No tenant settings permissions'}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Tenant Modules</h2>
          <p className="mt-1 text-sm text-slate-600">Quick links for tenant-specific back-office areas.</p>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Explicit tenant selection from this page currently applies to `Branding & Config` and `Feature Flags`.
            The Users, Roles, Catalog, and Documents pages are tenant-scoped by current authenticated tenant/host and do not switch by `tenantId` query param.
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <Link href={tenantId ? `/tenant-settings/users?tenantId=${tenantId}` : '/tenant-settings/users'} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">Users</Link>
            <Link href={tenantId ? `/tenant-settings/roles?tenantId=${tenantId}` : '/tenant-settings/roles'} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">Roles</Link>
            <Link href={tenantId ? `/tenant-settings/catalog?tenantId=${tenantId}` : '/tenant-settings/catalog'} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">Catalog & Pricing</Link>
            <Link href={tenantId ? `/tenant-settings/documents?tenantId=${tenantId}` : '/tenant-settings/documents'} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">Documents</Link>
          </div>
        </section>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {canReadTenants && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tenant Details</h2>
              <p className="text-sm text-slate-600">Name, domains, and status for {effectiveTenantName}.</p>
            </div>
            {canUpdateTenants && (
              <button
                type="button"
                onClick={saveTenant}
                disabled={savingTenant || !tenantId}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingTenant ? 'Saving...' : 'Save Tenant'}
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Tenant Name</span>
              <input
                value={tenantForm.name}
                onChange={(e) => setTenantForm((v) => ({ ...v, name: e.target.value }))}
                disabled={!canUpdateTenants}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
              <select
                value={tenantForm.status}
                onChange={(e) => setTenantForm((v) => ({ ...v, status: e.target.value }))}
                disabled={!canUpdateTenants}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
              >
                <option value="active">active</option>
                <option value="trial">trial</option>
                <option value="suspended">suspended</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Domains (comma-separated)</span>
            <input
              value={tenantForm.domains}
              onChange={(e) => setTenantForm((v) => ({ ...v, domains: e.target.value }))}
              disabled={!canUpdateTenants}
              placeholder="clinic.example.com, app.example.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
            />
          </label>
        </section>
      )}

      {canReadBranding && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Branding & Config</h2>
              <p className="text-sm text-slate-600">Tenant branding, report header/footer, and UI labels.</p>
            </div>
            {canWriteBranding && (
              <button
                type="button"
                onClick={saveConfig}
                disabled={savingConfig || !tenantId}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingConfig ? 'Saving...' : 'Save Branding'}
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {CONFIG_FIELDS.map((field) => (
              <label className="block" key={field.key}>
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{field.label}</span>
                <input
                  value={config[field.key] ?? ''}
                  onChange={(e) => setConfig((v) => ({ ...v, [field.key]: e.target.value }))}
                  disabled={!canWriteBranding}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {canReadFlags && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Core Feature Flags</h2>
              <p className="text-sm text-slate-600">
                Tenant-scoped module and workflow toggles. Use the full page for advanced variants.
              </p>
            </div>
            <Link
              href={tenantId ? `/feature-flags?tenantId=${tenantId}` : '/feature-flags'}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Open Full Feature Flags
            </Link>
          </div>

          <div className="mt-4 grid gap-3">
            {visibleFlags.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No core flags found for this tenant.
              </div>
            )}
            {visibleFlags.map((flag) => (
              <div key={flag.key} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">{getFlagLabel(flag.key)}</div>
                  <code className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{flag.key}</code>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFlag(flag)}
                  disabled={!canSetFlags || savingFlagKey === flag.key}
                  aria-pressed={flag.enabled}
                  className={`relative h-7 w-14 rounded-full transition ${
                    flag.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                      flag.enabled ? 'left-8' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </PermissionGuard>
  );
}
