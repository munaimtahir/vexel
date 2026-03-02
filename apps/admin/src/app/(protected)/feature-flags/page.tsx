'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { TenantScopeBanner } from '@/components/tenant-scope-banner';
import { ConfirmActionModal, DataTable } from '@vexel/ui-system';

type BuildStatus = 'built' | 'scaffold' | 'planned';
type FeatureStatus = 'implemented' | 'scaffold' | 'planned' | 'deprecated';
type ValueType = 'boolean' | 'enum';

type ModuleGroup = 'core' | 'lims' | 'documents' | 'opd' | 'rims';

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
}

const BUILD_BADGE: Record<BuildStatus, { label: string; color: string }> = {
  built: { label: 'Built', color: 'hsl(142 70% 45%)' },
  scaffold: { label: 'Scaffold', color: 'hsl(38 90% 50%)' },
  planned: { label: 'Planned', color: 'hsl(var(--muted-foreground))' },
};

const MODULE_LABELS: Record<ModuleGroup, string> = {
  core: 'Core',
  lims: 'LIMS',
  documents: 'Documents',
  opd: 'OPD (future)',
  rims: 'RIMS (future)',
};

const MODULE_DESCRIPTIONS: Record<ModuleGroup, string> = {
  core: 'Platform-wide foundational flags and module switches.',
  lims: 'Laboratory workflows, verification, and operator controls.',
  documents: 'Document publishing and print behavior.',
  opd: 'Outpatient feature gates reserved for future rollout.',
  rims: 'Radiology/Inpatient placeholders reserved for future modules.',
};

const CRITICAL_KEYS = new Set(['module.lims', 'module.printing', 'lims.verification.enabled']);

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
  const [pendingDisable, setPendingDisable] = useState<FlagDef | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    async function init() {
      const api = getApiClient(getToken() ?? undefined);
      const [meRes, tenantsRes, defsRes] = await Promise.all([
        api.GET('/me' as any, {}),
        api.GET('/tenants' as any, {}),
        api.GET('/feature-flags/definitions' as any, {}),
      ]);
      const myTenantId = (meRes.data as any)?.tenantId ?? '';
      const all: any[] = (tenantsRes.data as any)?.data ?? [];
      setTenants(all);
      const target = qTenantId ?? myTenantId;
      setTenantId(target || (all[0]?.id ?? ''));
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

  useEffect(() => {
    if (tenantId) loadFlags(tenantId);
  }, [tenantId]);

  async function performToggle(key: string, enabled: boolean) {
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

  async function handleToggle(def: FlagDef, nextEnabled: boolean) {
    const isCriticalDisable = !nextEnabled && (CRITICAL_KEYS.has(def.key) || def.key.startsWith('module.'));
    if (isCriticalDisable) {
      setPendingDisable(def);
      return;
    }
    await performToggle(def.key, nextEnabled);
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
    if (f?.variantJson) {
      try {
        return JSON.parse(f.variantJson);
      } catch {
        return null;
      }
    }
    return null;
  }

  const filtered = useMemo(() => {
    const byStatus = defs.filter((d) => d.status !== 'deprecated');
    if (!search.trim()) return byStatus;
    const q = search.toLowerCase();
    return byStatus.filter((d) => d.key.toLowerCase().includes(q) || d.label.toLowerCase().includes(q));
  }, [defs, search]);

  const grouped = useMemo(() => {
    const map: Record<ModuleGroup, FlagDef[]> = {
      core: [],
      lims: [],
      documents: [],
      opd: [],
      rims: [],
    };
    for (const def of filtered) {
      map[moduleGroupFor(def)].push(def);
    }
    return map;
  }, [filtered]);

  const selectedTenant = tenants.find((t) => t.id === tenantId);

  return (
    <div style={{ maxWidth: '1100px' }}>
      <ConfirmActionModal
        open={pendingDisable !== null}
        title="Disable Critical Feature Flag"
        description="This flag is marked critical and can impact module behavior immediately. Confirm disable action."
        actionPreview={pendingDisable ? `${pendingDisable.label} (${pendingDisable.key})` : undefined}
        confirmText="Disable"
        danger
        onConfirm={async () => {
          if (!pendingDisable) return;
          await performToggle(pendingDisable.key, false);
          setPendingDisable(null);
        }}
        onCancel={() => setPendingDisable(null)}
        loading={saving !== null}
      />

      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>Feature Flags</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '20px', fontSize: '14px' }}>
        Grouped operationally for rollout control. Planned flags stay visible but cannot be toggled.
      </p>

      {tenants.length > 1 && (
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Tenant:</label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', background: 'hsl(var(--card))' }}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {selectedTenant && <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))', padding: '2px 8px', borderRadius: '4px' }}>{selectedTenant.status}</span>}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <TenantScopeBanner
          mode="explicit"
          pageLabel="Feature Flags"
          tenantId={tenantId}
          tenantName={selectedTenant?.name}
          note="This page reads and writes /tenants/{tenantId}/feature-flags for the selected tenant."
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by key or label…"
          style={{ width: '100%', maxWidth: '380px', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
        />
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'hsl(var(--foreground))', color: 'hsl(var(--background))', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', zIndex: 9999, boxShadow: '0 4px 16px hsl(0 0% 0% / 0.2)' }}>
          ✓ {toast}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>Loading flags…</p>
      ) : (
        (Object.keys(grouped) as ModuleGroup[]).map((moduleKey) => {
          const moduleDefs = grouped[moduleKey];
          const isOpen = collapsed[moduleKey] !== true;
          return (
            <section key={moduleKey} style={{ marginBottom: '26px' }}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [moduleKey]: !isOpen }))}
                style={{ width: '100%', padding: '12px 14px', background: 'hsl(var(--muted) / 0.5)', border: '1px solid hsl(var(--border))', borderRadius: '8px 8px 0 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{MODULE_LABELS[moduleKey]}</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>{MODULE_DESCRIPTIONS[moduleKey]}</p>
                </div>
                <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>{isOpen ? '▲' : '▼'} {moduleDefs.length}</span>
              </button>

              {isOpen && (
                <div style={{ background: 'hsl(var(--card))', borderRadius: '0 0 8px 8px', border: '1px solid hsl(var(--border))', borderTop: 'none', overflow: 'hidden' }}>
                  <DataTable
                    data={moduleDefs}
                    emptyMessage="No flags in this group."
                    keyExtractor={(def) => def.key}
                    columns={[
                      {
                        key: 'feature',
                        header: 'Feature',
                        cell: (def) => {
                          const isPlanned = def.buildStatus === 'planned' || def.status === 'planned';
                          return (
                            <div style={{ opacity: isPlanned ? 0.65 : 1 }}>
                              <span style={{ fontWeight: 600 }}>{def.label}</span>
                              {isPlanned ? (
                                <span style={{ marginLeft: '6px', fontSize: '11px', background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', padding: '1px 6px', borderRadius: '4px' }}>
                                  Planned
                                </span>
                              ) : null}
                              {CRITICAL_KEYS.has(def.key) || def.key.startsWith('module.') ? (
                                <span style={{ marginLeft: '6px', fontSize: '11px', background: 'hsl(var(--status-warning-bg))', color: 'hsl(var(--status-warning-fg))', padding: '1px 6px', borderRadius: '4px' }}>
                                  Critical
                                </span>
                              ) : null}
                            </div>
                          );
                        },
                      },
                      {
                        key: 'key',
                        header: 'Key',
                        cell: (def) => <code style={{ background: 'hsl(var(--muted))', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{def.key}</code>,
                      },
                      {
                        key: 'description',
                        header: 'Description',
                        cell: (def) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{def.description}</span>,
                      },
                      {
                        key: 'build',
                        header: 'Build',
                        className: 'text-center',
                        cell: (def) => <BuildBadge status={def.buildStatus} />,
                      },
                      {
                        key: 'toggle',
                        header: 'On/Off',
                        className: 'text-center',
                        cell: (def) => {
                          const isPlanned = def.buildStatus === 'planned' || def.status === 'planned';
                          const val = getFlagValue(def.key, def.defaultValue);
                          const isEnum = def.valueType === 'enum';
                          const variantVal = isEnum ? getVariantValue(def.key) : null;
                          const currentMode = (variantVal as any)?.mode ?? 'separate';

                          return (
                            <div style={{ opacity: isPlanned ? 0.65 : 1 }}>
                              {isEnum ? (
                                <select
                                  value={currentMode}
                                  disabled={saving === def.key || isPlanned}
                                  onChange={(e) => handleVariantSave(def.key, JSON.stringify({ mode: e.target.value }))}
                                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid hsl(var(--border))', fontSize: '12px', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', cursor: isPlanned ? 'not-allowed' : 'pointer' }}
                                >
                                  {(def.enumOptions ?? []).map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              ) : (
                                <Toggle
                                  enabled={val}
                                  isSaving={saving === def.key}
                                  disabled={isPlanned}
                                  onToggle={() => !isPlanned && handleToggle(def, !val)}
                                />
                              )}
                            </div>
                          );
                        },
                      },
                    ]}
                  />
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function moduleGroupFor(def: FlagDef): ModuleGroup {
  if (def.app === 'lims' || def.key.startsWith('lims.') || def.key === 'module.lims') return 'lims';
  if (def.app === 'printing' || def.key.includes('print') || def.key.includes('document') || def.key === 'module.printing') return 'documents';
  if (def.app === 'opd' || def.key.startsWith('opd.') || def.key === 'module.opd') return 'opd';
  if (def.app === 'rad' || def.app === 'ipd' || def.key === 'module.rad' || def.key === 'module.ipd' || def.key.startsWith('rims.')) return 'rims';
  return 'core';
}

function BuildBadge({ status }: { status: BuildStatus }) {
  const { label, color } = BUILD_BADGE[status];
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: `${color}22`, color }}>{label}</span>;
}

function Toggle({ enabled, isSaving, disabled, onToggle }: { enabled: boolean; isSaving: boolean; disabled?: boolean; onToggle: () => void }) {
  const bg = disabled ? 'hsl(var(--border))' : enabled ? 'hsl(142 70% 45%)' : 'hsl(var(--border))';
  return (
    <button
      onClick={onToggle}
      disabled={isSaving || disabled}
      title={disabled ? 'No runtime effect — planned feature' : undefined}
      style={{ width: '44px', height: '24px', borderRadius: '12px', background: bg, border: 'none', cursor: (isSaving || disabled) ? (disabled ? 'not-allowed' : 'wait') : 'pointer', transition: 'background 0.2s', position: 'relative', opacity: disabled ? 0.5 : 1 }}
      aria-label="Toggle"
      aria-pressed={enabled}
    >
      <span style={{ position: 'absolute', top: '2px', left: enabled && !disabled ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'hsl(var(--card))', transition: 'left 0.2s', boxShadow: '0 1px 3px hsl(var(--foreground) / 0.2)' }} />
    </button>
  );
}
