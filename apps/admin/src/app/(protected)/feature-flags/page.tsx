'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { TenantScopeBanner } from '@/components/tenant-scope-banner';

type BuildStatus = 'built' | 'scaffold' | 'planned';
type FeatureStatus = 'implemented' | 'scaffold' | 'planned' | 'deprecated';
type ValueType = 'boolean' | 'enum';

interface FlagDef {
  key: string;
  app: string;
  group: 'main-apps' | 'app-features';
  label: string;
  description: string;
  valueType: ValueType;
  status: FeatureStatus;
  buildStatus: BuildStatus;
  defaultValue: boolean;
  dependsOn?: string[];
  enumOptions?: string[];
}

interface FlagValue {
  key: string;
  enabled: boolean;
  variantJson?: string | null;
  description?: string;
}

const BUILD_BADGE: Record<BuildStatus, { label: string; color: string }> = {
  built:    { label: 'Built',    color: 'hsl(142 70% 45%)' },
  scaffold: { label: 'Scaffold', color: 'hsl(38 90% 50%)' },
  planned:  { label: 'Planned',  color: 'hsl(var(--muted-foreground))' },
};

const APP_LABELS: Record<string, string> = {
  lims: 'LIMS',
  opd: 'OPD',
  rad: 'Radiology',
  ipd: 'IPD',
  printing: 'Printing',
};

export default function FeatureFlagsPage() {
  const searchParams = useSearchParams();
  const qTenantId = searchParams.get('tenantId');

  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState<string>('');
  const [defs, setDefs] = useState<FlagDef[]>([]);
  const [flags, setFlags] = useState<FlagValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    async function init() {
      const api = getApiClient(getToken() ?? undefined);
      const meRes = await api.GET('/me');
      const myTenantId = (meRes.data as any)?.tenantId ?? '';
      const tenantsRes = await api.GET('/tenants');
      const all: any[] = (tenantsRes.data as any)?.data ?? [];
      setTenants(all);
      const target = qTenantId ?? myTenantId;
      setTenantId(target || (all[0]?.id ?? ''));

      // Load definitions (registry)
      // @ts-ignore
      const defsRes = await api.GET('/feature-flags/definitions');
      setDefs((defsRes.data as FlagDef[]) ?? []);
    }
    init();
  }, [qTenantId]);

  async function loadFlags(tid: string) {
    if (!tid) return;
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/tenants/{tenantId}/feature-flags' as any, { params: { path: { tenantId: tid } } });
    setFlags((data as FlagValue[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { if (tenantId) loadFlags(tenantId); }, [tenantId]);

  async function handleToggle(key: string, enabled: boolean) {
    if (saving) return;
    setSaving(key);
    const api = getApiClient(getToken() ?? undefined);
    const current = flags.find((f) => f.key === key);
    const body: any = { enabled };
    if (current?.variantJson) body.variantJson = current.variantJson;
    await api.PUT('/tenants/{tenantId}/feature-flags' as any, { params: { path: { tenantId } }, body: [{ key, ...body }] });
    await loadFlags(tenantId);
    setSaving(null);
    showToast(`${key} ${enabled ? 'enabled' : 'disabled'}`);
  }

  async function handleVariantSave(key: string, variantJson: string) {
    if (saving) return;
    setSaving(key);
    const api = getApiClient(getToken() ?? undefined);
    const current = flags.find((f) => f.key === key);
    const currentEnabled = current?.enabled ?? true;
    await api.PUT('/tenants/{tenantId}/feature-flags' as any, { params: { path: { tenantId } }, body: [{ key, enabled: currentEnabled, variantJson }] });
    await loadFlags(tenantId);
    setSaving(null);
    showToast(`${key} updated`);
  }

  function getFlagValue(key: string, defaultValue: boolean): boolean {
    const f = flags.find((x) => x.key === key);
    return f !== undefined ? f.enabled : defaultValue;
  }

  function getVariantValue(key: string): any {
    const f = flags.find((x) => x.key === key);
    if (f?.variantJson) { try { return JSON.parse(f.variantJson); } catch { /**/ } }
    return null;
  }

  // Filter defs by search
  const filtered = useMemo(() => {
    if (!search.trim()) return defs;
    const q = search.toLowerCase();
    return defs.filter((d) => d.key.toLowerCase().includes(q) || d.label.toLowerCase().includes(q));
  }, [defs, search]);

  const mainApps = filtered.filter((d) => d.group === 'main-apps');
  const appFeaturesByApp = useMemo(() => {
    const map: Record<string, FlagDef[]> = {};
    for (const d of filtered.filter((x) => x.group === 'app-features')) {
      if (!map[d.app]) map[d.app] = [];
      map[d.app].push(d);
    }
    return map;
  }, [filtered]);

  const selectedTenant = tenants.find((t) => t.id === tenantId);

  return (
    <div style={{ maxWidth: '960px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>Feature Flags</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '20px', fontSize: '14px' }}>
        Control which modules and features are active. Planned flags are listed for visibility but have no runtime effect yet.
      </p>

      {/* Tenant selector */}
      {tenants.length > 1 && (
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Tenant:</label>
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', background: 'hsl(var(--card))' }}>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {selectedTenant && <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))', padding: '2px 8px', borderRadius: '4px' }}>{selectedTenant.status}</span>}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <TenantScopeBanner mode="explicit" pageLabel="Feature Flags" tenantId={tenantId} tenantName={selectedTenant?.name}
          note="This page reads and writes /tenants/{tenantId}/feature-flags for the selected tenant." />
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by key or label…"
          style={{ width: '100%', maxWidth: '360px', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }} />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'hsl(var(--foreground))', color: 'hsl(var(--background))', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', zIndex: 9999, boxShadow: '0 4px 16px hsl(0 0% 0% / 0.2)' }}>
          ✓ {toast}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>Loading flags…</p>
      ) : (
        <>
          {/* ─── Section 1: Main Apps ─────────────────────────────────────────── */}
          <Section title="Main Apps" subtitle="Enable or disable entire modules. Disabling a module forces all its sub-features OFF.">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: 'hsl(var(--muted-foreground))', borderBottom: '1px solid hsl(var(--border))' }}>
                  <Th>App</Th><Th>Key</Th><Th>Description</Th><Th style={{ textAlign: 'center' }}>Build</Th><Th style={{ textAlign: 'center' }}>On/Off</Th>
                </tr>
              </thead>
              <tbody>
                {mainApps.map((def) => {
                  const val = getFlagValue(def.key, def.defaultValue);
                  return (
                    <tr key={def.key} style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                      <Td><strong>{def.label}</strong></Td>
                      <Td><code style={{ background: 'hsl(var(--muted))', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{def.key}</code></Td>
                      <Td style={{ color: 'hsl(var(--muted-foreground))' }}>{def.description}</Td>
                      <Td style={{ textAlign: 'center' }}><BuildBadge status={def.buildStatus} /></Td>
                      <Td style={{ textAlign: 'center' }}>
                        <Toggle enabled={val} isSaving={saving === def.key}
                          disabled={def.buildStatus === 'planned'}
                          onToggle={() => handleToggle(def.key, !val)} />
                      </Td>
                    </tr>
                  );
                })}
                {mainApps.length === 0 && <tr><td colSpan={5} style={{ padding: '12px', color: 'hsl(var(--muted-foreground))' }}>No results.</td></tr>}
              </tbody>
            </table>
          </Section>

          {/* ─── Section 2: App Features ──────────────────────────────────────── */}
          <Section title="App Features" subtitle="Per-module feature toggles. Planned features are visible but disabled — toggling has no runtime effect.">
            {Object.entries(appFeaturesByApp).map(([app, appDefs]) => {
              const isOpen = collapsed[app] !== true;
              return (
                <div key={app} style={{ marginBottom: '16px', border: '1px solid hsl(var(--border))', borderRadius: '8px', overflow: 'hidden' }}>
                  <button onClick={() => setCollapsed((c) => ({ ...c, [app]: !isOpen }))}
                    style={{ width: '100%', padding: '12px 16px', background: 'hsl(var(--muted) / 0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    <span>{APP_LABELS[app] ?? app}</span>
                    <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>{isOpen ? '▲' : '▼'} {appDefs.length} feature{appDefs.length !== 1 ? 's' : ''}</span>
                  </button>
                  {isOpen && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ color: 'hsl(var(--muted-foreground))', borderBottom: '1px solid hsl(var(--border))' }}>
                          <Th>Feature</Th><Th>Key</Th><Th>Description</Th><Th style={{ textAlign: 'center' }}>Build</Th><Th style={{ textAlign: 'center' }}>On/Off</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {appDefs.map((def) => {
                          const isPlanned = def.buildStatus === 'planned' || def.status === 'planned';
                          const val = getFlagValue(def.key, def.defaultValue);
                          const isEnum = def.valueType === 'enum';
                          const variantVal = isEnum ? getVariantValue(def.key) : null;
                          const currentMode = (variantVal as any)?.mode ?? 'separate';

                          return (
                            <tr key={def.key} style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)', opacity: isPlanned ? 0.65 : 1 }}>
                              <Td>
                                <span style={{ fontWeight: 500 }}>{def.label}</span>
                                {isPlanned && <span style={{ marginLeft: '6px', fontSize: '11px', background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', padding: '1px 6px', borderRadius: '4px' }}>TODO</span>}
                              </Td>
                              <Td><code style={{ background: 'hsl(var(--muted))', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{def.key}</code></Td>
                              <Td style={{ color: 'hsl(var(--muted-foreground))' }}>
                                {def.description}
                                {isPlanned && <span style={{ display: 'block', fontSize: '11px', marginTop: '2px', color: 'hsl(var(--muted-foreground))' }}>⚠ No runtime effect yet</span>}
                              </Td>
                              <Td style={{ textAlign: 'center' }}><BuildBadge status={def.buildStatus} /></Td>
                              <Td style={{ textAlign: 'center' }}>
                                {isEnum ? (
                                  <select value={currentMode} disabled={saving === def.key || isPlanned}
                                    onChange={(e) => handleVariantSave(def.key, JSON.stringify({ mode: e.target.value }))}
                                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid hsl(var(--border))', fontSize: '12px', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', cursor: isPlanned ? 'not-allowed' : 'pointer' }}>
                                    {(def.enumOptions ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                ) : (
                                  <Toggle enabled={val} isSaving={saving === def.key}
                                    disabled={isPlanned}
                                    onToggle={() => !isPlanned && handleToggle(def.key, !val)} />
                                )}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
            {Object.keys(appFeaturesByApp).length === 0 && <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>No results.</p>}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>{title}</h2>
      <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '14px' }}>{subtitle}</p>
      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', overflow: 'hidden' }}>
        {children}
      </div>
    </section>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: '12px', ...style }}>{children}</th>;
}

function Td({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '10px 14px', verticalAlign: 'middle', ...style }}>{children}</td>;
}

function BuildBadge({ status }: { status: BuildStatus }) {
  const { label, color } = BUILD_BADGE[status];
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: `${color}22`, color }}>{label}</span>
  );
}

function Toggle({ enabled, isSaving, disabled, onToggle }: { enabled: boolean; isSaving: boolean; disabled?: boolean; onToggle: () => void }) {
  const bg = disabled ? 'hsl(var(--border))' : enabled ? 'hsl(142 70% 45%)' : 'hsl(var(--border))';
  return (
    <button onClick={onToggle} disabled={isSaving || disabled}
      title={disabled ? 'No runtime effect — planned feature' : undefined}
      style={{ width: '44px', height: '24px', borderRadius: '12px', background: bg, border: 'none', cursor: (isSaving || disabled) ? (disabled ? 'not-allowed' : 'wait') : 'pointer', transition: 'background 0.2s', position: 'relative', opacity: disabled ? 0.5 : 1 }}
      aria-label={`Toggle`} aria-pressed={enabled}>
      <span style={{ position: 'absolute', top: '2px', left: enabled && !disabled ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'hsl(var(--card))', transition: 'left 0.2s', boxShadow: '0 1px 3px hsl(var(--foreground) / 0.2)' }} />
    </button>
  );
}
