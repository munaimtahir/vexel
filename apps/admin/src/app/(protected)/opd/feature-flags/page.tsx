'use client';

import { useEffect, useMemo, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Tenant = { id: string; name: string; status?: string };
type FeatureFlag = { key: string; enabled: boolean; variantJson?: string | null; description?: string | null };

const OPD_FLAG_HINTS: Record<string, string> = {
  'module.opd': 'Enable OPD module surfaces for the tenant.',
};

export default function OpdFeatureFlagsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [loadingTenantContext, setLoadingTenantContext] = useState(true);

  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(false);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function loadTenantsAndDefault() {
    setLoadingTenantContext(true);
    const api = getApiClient(getToken() ?? undefined);
    const [meRes, tenantsRes] = await Promise.allSettled([api.GET('/me'), api.GET('/tenants')]);
    const myTenantId =
      meRes.status === 'fulfilled' ? ((meRes.value.data as any)?.tenantId ?? '') : '';
    const tenantList =
      tenantsRes.status === 'fulfilled' ? ((((tenantsRes.value.data as any)?.data ?? []) as Tenant[])) : [];
    setTenants(tenantList);
    setTenantId((current) => current || myTenantId || tenantList[0]?.id || '');
    setLoadingTenantContext(false);
  }

  async function loadFlags(targetTenantId: string) {
    if (!targetTenantId) return;
    setLoadingFlags(true);
    setError('');
    const api = getApiClient(getToken() ?? undefined);
    const { data, error: flagsErr } = await api.GET('/tenants/{tenantId}/feature-flags' as any, {
      params: { path: { tenantId: targetTenantId } },
    });
    if (flagsErr) {
      setError((flagsErr as any)?.message ?? 'Failed to load feature flags');
      setFlags([]);
      setLoadingFlags(false);
      return;
    }
    setFlags(((data as any) ?? []) as FeatureFlag[]);
    setLoadingFlags(false);
  }

  useEffect(() => {
    void loadTenantsAndDefault();
  }, []);

  useEffect(() => {
    if (tenantId) {
      void loadFlags(tenantId);
    }
  }, [tenantId]);

  const opdFlags = useMemo(() => {
    return flags
      .filter((f) => f.key === 'module.opd' || f.key.startsWith('opd.'))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [flags]);

  async function toggleFlag(flag: FeatureFlag) {
    if (!tenantId) return;
    setSavingKey(flag.key);
    const api = getApiClient(getToken() ?? undefined);
    const body: any = { key: flag.key, enabled: !flag.enabled };
    if (flag.variantJson != null) body.variantJson = flag.variantJson;
    const { error: saveErr } = await api.PUT('/tenants/{tenantId}/feature-flags' as any, {
      params: { path: { tenantId } },
      body: [body],
    });
    if (saveErr) {
      setError((saveErr as any)?.message ?? `Failed to update ${flag.key}`);
      setSavingKey(null);
      return;
    }
    await loadFlags(tenantId);
    setSavingKey(null);
  }

  async function seedModuleFlag() {
    if (!tenantId) return;
    setSavingKey('module.opd');
    const api = getApiClient(getToken() ?? undefined);
    const { error: saveErr } = await api.PUT('/tenants/{tenantId}/feature-flags' as any, {
      params: { path: { tenantId } },
      body: [{ key: 'module.opd', enabled: true }],
    });
    if (saveErr) {
      setError((saveErr as any)?.message ?? 'Failed to create module.opd flag');
      setSavingKey(null);
      return;
    }
    await loadFlags(tenantId);
    setSavingKey(null);
  }

  const selectedTenant = tenants.find((t) => t.id === tenantId) ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">OPD Feature Flags</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tenant-scoped OPD flags only. This page does not expose appointment/visit/invoice command endpoints.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">Tenant</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={loadingTenantContext || tenants.length === 0}
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </label>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-foreground">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected Tenant</div>
            <div className="mt-1 font-medium text-slate-900">{selectedTenant?.name ?? '—'}</div>
            {selectedTenant?.status ? <div className="text-xs text-slate-500">{selectedTenant.status}</div> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">OPD Flags</h2>
          <div className="flex gap-2">
            <button onClick={() => tenantId && void loadFlags(tenantId)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-foreground">
              Refresh
            </button>
            <button onClick={() => void seedModuleFlag()} disabled={!tenantId || savingKey === 'module.opd'} className="rounded-md border border-border px-3 py-2 text-sm text-primary disabled:opacity-60">
              {savingKey === 'module.opd' ? 'Saving...' : 'Ensure module.opd'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-[hsl(var(--status-destructive-border))] bg-[hsl(var(--status-destructive-bg))] px-3 py-2 text-sm text-[hsl(var(--status-destructive-fg))]">{error}</div>
        ) : null}

        {loadingFlags ? (
          <p className="mt-4 text-sm text-slate-500">Loading flags...</p>
        ) : opdFlags.length === 0 ? (
          <div className="mt-4 rounded-md border border-[hsl(var(--status-warning-border))] bg-[hsl(var(--status-warning-bg))] px-3 py-2 text-sm text-[hsl(var(--status-warning-fg))]">
            No OPD-specific flags found for this tenant. Use <code className="rounded bg-white px-1 py-0.5 text-xs">Ensure module.opd</code> to seed the module flag.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {opdFlags.map((flag) => (
              <div key={flag.key} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <code className="rounded bg-white px-2 py-1 text-xs text-slate-800">{flag.key}</code>
                  <p className="mt-2 text-sm text-slate-600">
                    {OPD_FLAG_HINTS[flag.key] ?? flag.description ?? 'Tenant-scoped OPD feature flag'}
                  </p>
                  {flag.variantJson ? (
                    <p className="mt-1 break-all text-xs text-slate-500">variantJson: {flag.variantJson}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => void toggleFlag(flag)}
                  disabled={savingKey === flag.key}
                  className={`inline-flex min-w-28 items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${flag.enabled ? 'bg-primary text-white' : 'bg-slate-200 text-slate-800'} disabled:opacity-60`}
                >
                  {savingKey === flag.key ? 'Saving...' : flag.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
