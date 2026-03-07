'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

// ─── Graphical Scale Types ────────────────────────────────────────────────────
const COLOR_TOKENS = ['GOOD', 'CAUTION', 'BAD', 'INFO', 'NEUTRAL'] as const;
type ColorToken = typeof COLOR_TOKENS[number];

const TOKEN_LABELS: Record<ColorToken, { label: string; bg: string; text: string }> = {
  GOOD:    { label: 'Good (Green)',    bg: 'bg-green-100',  text: 'text-green-800' },
  CAUTION: { label: 'Caution (Amber)', bg: 'bg-amber-100',  text: 'text-amber-800' },
  BAD:     { label: 'Bad (Red)',       bg: 'bg-red-100',    text: 'text-red-800' },
  INFO:    { label: 'Info (Blue)',     bg: 'bg-blue-100',   text: 'text-blue-800' },
  NEUTRAL: { label: 'Neutral (Gray)',  bg: 'bg-gray-100',   text: 'text-gray-700' },
};

interface BandDef { label: string; min: number | null; max: number | null; colorToken: ColorToken; }
interface ScaleParam {
  key: string; label: string; unit: string;
  sourceMode: 'parameter_name_match'; sourceMatch: string;
  skipIfMissing: boolean; bands: BandDef[];
}
interface GraphicalScaleConfig {
  title: string; subtitle: string;
  showDemographics: boolean; showInterpretationSummary: boolean;
  scaleStyle: 'BAND_HIGHLIGHT' | 'VALUE_MARKER';
  parameters: ScaleParam[];
}

function emptyParam(): ScaleParam {
  return { key: '', label: '', unit: '', sourceMode: 'parameter_name_match', sourceMatch: '', skipIfMissing: false, bands: [
    { label: 'Low', min: null, max: 100, colorToken: 'CAUTION' },
    { label: 'Normal', min: 100, max: 200, colorToken: 'GOOD' },
    { label: 'High', min: 200, max: null, colorToken: 'BAD' },
  ]};
}

// ─── Band overlap validation ──────────────────────────────────────────────────
function validateBands(bands: BandDef[]): string[] {
  const errors: string[] = [];
  if (bands.length < 2) { errors.push('At least 2 bands required'); return errors; }
  const nullMins = bands.filter(b => b.min === null).length;
  const nullMaxs = bands.filter(b => b.max === null).length;
  if (nullMins > 1) errors.push('Only one band may have open low (min=null)');
  if (nullMaxs > 1) errors.push('Only one band may have open high (max=null)');
  for (let i = 0; i < bands.length; i++) {
    const a = bands[i];
    if (a.min !== null && a.max !== null && a.min >= a.max)
      errors.push(`Band "${a.label}": min must be less than max`);
    for (let j = i + 1; j < bands.length; j++) {
      const b = bands[j];
      const aLo = a.min ?? -Infinity, aHi = a.max ?? Infinity;
      const bLo = b.min ?? -Infinity, bHi = b.max ?? Infinity;
      if (aLo < bHi && bLo < aHi) errors.push(`Bands "${a.label}" and "${b.label}" overlap`);
    }
  }
  return errors;
}

function validateGraphicalConfig(cfg: GraphicalScaleConfig): string[] {
  const errors: string[] = [];
  if (!cfg.title) errors.push('Title is required');
  if (!cfg.parameters || cfg.parameters.length === 0) errors.push('At least one parameter required');
  const keys = cfg.parameters.map(p => p.key).filter(Boolean);
  const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupKeys.length) errors.push(`Duplicate parameter keys: ${dupKeys.join(', ')}`);
  cfg.parameters.forEach((p, idx) => {
    if (!p.key) errors.push(`Parameter #${idx + 1}: key is required`);
    if (!p.label) errors.push(`Parameter #${idx + 1}: label is required`);
    if (!p.sourceMatch) errors.push(`Parameter #${idx + 1}: source match is required`);
    validateBands(p.bands).forEach(e => errors.push(`Parameter "${p.label || idx + 1}": ${e}`));
  });
  return errors;
}

// ─── Graphical Scale Editor Component ────────────────────────────────────────
function GraphicalScaleEditor({ config, onChange, readOnly }: {
  config: GraphicalScaleConfig;
  onChange: (cfg: GraphicalScaleConfig) => void;
  readOnly: boolean;
}) {
  const errors = validateGraphicalConfig(config);

  function updateTopLevel(key: keyof GraphicalScaleConfig, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  function updateParam(idx: number, updates: Partial<ScaleParam>) {
    const params = [...config.parameters];
    params[idx] = { ...params[idx], ...updates };
    // Auto-sync sourceMatch with label if not manually changed
    if ('label' in updates && params[idx].sourceMatch === config.parameters[idx].label) {
      params[idx].sourceMatch = updates.label as string;
    }
    onChange({ ...config, parameters: params });
  }

  function addParam() {
    onChange({ ...config, parameters: [...config.parameters, emptyParam()] });
  }

  function removeParam(idx: number) {
    const params = config.parameters.filter((_, i) => i !== idx);
    onChange({ ...config, parameters: params });
  }

  function moveParam(idx: number, dir: -1 | 1) {
    const params = [...config.parameters];
    const target = idx + dir;
    if (target < 0 || target >= params.length) return;
    [params[idx], params[target]] = [params[target], params[idx]];
    onChange({ ...config, parameters: params });
  }

  function updateBand(paramIdx: number, bandIdx: number, updates: Partial<BandDef>) {
    const params = [...config.parameters];
    const bands = [...params[paramIdx].bands];
    bands[bandIdx] = { ...bands[bandIdx], ...updates };
    params[paramIdx] = { ...params[paramIdx], bands };
    onChange({ ...config, parameters: params });
  }

  function addBand(paramIdx: number) {
    const params = [...config.parameters];
    params[paramIdx] = { ...params[paramIdx], bands: [...params[paramIdx].bands, { label: '', min: null, max: null, colorToken: 'NEUTRAL' as ColorToken }] };
    onChange({ ...config, parameters: params });
  }

  function removeBand(paramIdx: number, bandIdx: number) {
    const params = [...config.parameters];
    params[paramIdx] = { ...params[paramIdx], bands: params[paramIdx].bands.filter((_, i) => i !== bandIdx) };
    onChange({ ...config, parameters: params });
  }

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          <strong>Validation errors:</strong>
          <ul className="mt-1 ml-4 list-disc space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Top-level config */}
      <section>
        <h2 className="text-base font-semibold mb-3">Report Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input type="text" value={config.title} disabled={readOnly}
              onChange={e => updateTopLevel('title', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subtitle</label>
            <input type="text" value={config.subtitle} disabled={readOnly}
              onChange={e => updateTopLevel('subtitle', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Scale Style</label>
            <select value={config.scaleStyle} disabled={readOnly}
              onChange={e => updateTopLevel('scaleStyle', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-50">
              <option value="BAND_HIGHLIGHT">Band Highlight</option>
              <option value="VALUE_MARKER">Value Marker (deferred)</option>
            </select>
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.showDemographics} disabled={readOnly}
                onChange={e => updateTopLevel('showDemographics', e.target.checked)} />
              <span className="text-sm">Show Demographics</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.showInterpretationSummary} disabled={readOnly}
                onChange={e => updateTopLevel('showInterpretationSummary', e.target.checked)} />
              <span className="text-sm">Show Summary Table</span>
            </label>
          </div>
        </div>
      </section>

      {/* Parameter list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Parameters ({config.parameters.length})</h2>
          {!readOnly && (
            <button onClick={addParam}
              className="px-3 py-1 border rounded text-sm hover:bg-muted">
              + Add Parameter
            </button>
          )}
        </div>
        <div className="space-y-4">
          {config.parameters.map((param, pIdx) => {
            const bandErrors = validateBands(param.bands);
            return (
              <div key={pIdx} className="border rounded-lg p-4 bg-muted/10">
                {/* Parameter header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm">{param.label || `Parameter ${pIdx + 1}`}</span>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <button onClick={() => moveParam(pIdx, -1)} disabled={pIdx === 0}
                        className="px-2 py-0.5 text-xs border rounded hover:bg-muted disabled:opacity-30">▲</button>
                      <button onClick={() => moveParam(pIdx, 1)} disabled={pIdx === config.parameters.length - 1}
                        className="px-2 py-0.5 text-xs border rounded hover:bg-muted disabled:opacity-30">▼</button>
                      <button onClick={() => removeParam(pIdx)}
                        className="px-2 py-0.5 text-xs border rounded text-destructive hover:bg-destructive/10">Remove</button>
                    </div>
                  )}
                </div>

                {/* Parameter fields */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Key (unique)</label>
                    <input type="text" value={param.key} disabled={readOnly}
                      onChange={e => updateParam(pIdx, { key: e.target.value })}
                      placeholder="e.g. total_cholesterol"
                      className="w-full border rounded px-2 py-1 text-sm bg-background disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Label</label>
                    <input type="text" value={param.label} disabled={readOnly}
                      onChange={e => updateParam(pIdx, { label: e.target.value })}
                      placeholder="e.g. Total Cholesterol"
                      className="w-full border rounded px-2 py-1 text-sm bg-background disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Unit</label>
                    <input type="text" value={param.unit} disabled={readOnly}
                      onChange={e => updateParam(pIdx, { unit: e.target.value })}
                      placeholder="e.g. mg/dL"
                      className="w-full border rounded px-2 py-1 text-sm bg-background disabled:opacity-50" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Source Match (parameter name in result)</label>
                    <input type="text" value={param.sourceMatch} disabled={readOnly}
                      onChange={e => updateParam(pIdx, { sourceMatch: e.target.value })}
                      placeholder="Match by parameter name"
                      className="w-full border rounded px-2 py-1 text-sm bg-background disabled:opacity-50" />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={param.skipIfMissing} disabled={readOnly}
                        onChange={e => updateParam(pIdx, { skipIfMissing: e.target.checked })} />
                      <span className="text-xs">Skip if missing</span>
                    </label>
                  </div>
                </div>

                {/* Band editor */}
                {bandErrors.length > 0 && (
                  <div className="mb-2 text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                    {bandErrors.join(' · ')}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Interpretation Bands</div>
                  {param.bands.map((band, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2">
                      <input type="text" value={band.label} disabled={readOnly}
                        onChange={e => updateBand(pIdx, bIdx, { label: e.target.value })}
                        placeholder="Label" className="flex-1 border rounded px-2 py-1 text-xs bg-background disabled:opacity-50" />
                      <input type="number" value={band.min ?? ''} disabled={readOnly}
                        onChange={e => updateBand(pIdx, bIdx, { min: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="min (null=open)" className="w-24 border rounded px-2 py-1 text-xs bg-background disabled:opacity-50" />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input type="number" value={band.max ?? ''} disabled={readOnly}
                        onChange={e => updateBand(pIdx, bIdx, { max: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        placeholder="max (null=open)" className="w-24 border rounded px-2 py-1 text-xs bg-background disabled:opacity-50" />
                      <select value={band.colorToken} disabled={readOnly}
                        onChange={e => updateBand(pIdx, bIdx, { colorToken: e.target.value as ColorToken })}
                        className={`border rounded px-2 py-1 text-xs ${TOKEN_LABELS[band.colorToken]?.bg ?? ''} ${TOKEN_LABELS[band.colorToken]?.text ?? ''} disabled:opacity-50`}>
                        {COLOR_TOKENS.map(t => (
                          <option key={t} value={t}>{TOKEN_LABELS[t].label}</option>
                        ))}
                      </select>
                      {!readOnly && (
                        <button onClick={() => removeBand(pIdx, bIdx)}
                          className="text-xs text-destructive px-1.5 py-0.5 border rounded hover:bg-destructive/10">×</button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <button onClick={() => addBand(pIdx)}
                      className="text-xs px-2 py-1 border rounded hover:bg-muted">+ Add Band</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── Standard Table Config Editor ────────────────────────────────────────────
function StandardConfigEditor({ config, onChange, readOnly }: {
  config: any;
  onChange: (cfg: any) => void;
  readOnly: boolean;
}) {
  function toggleFlag(section: string, key: string) {
    onChange({ ...config, [section]: { ...(config[section] ?? {}), [key]: !(config[section]?.[key] ?? false) } });
  }
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-base font-semibold mb-3">Header Options</h2>
        <div className="space-y-2">
          {Object.entries(config?.headerOptions ?? {}).map(([key, val]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={val as boolean} onChange={() => !readOnly && toggleFlag('headerOptions', key)} disabled={readOnly} />
              <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').replace('show ', 'Show ')}</span>
            </label>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-3">Demographics Block</h2>
        <div className="space-y-2">
          {Object.entries(config?.demographicsBlock ?? {}).map(([key, val]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={val as boolean} onChange={() => !readOnly && toggleFlag('demographicsBlock', key)} disabled={readOnly} />
              <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').replace('show ', 'Show ')}</span>
            </label>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-3">Results Block</h2>
        <div className="space-y-2">
          {Object.entries(config?.resultsBlock ?? {}).map(([key, val]) => typeof val === 'boolean' && (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={val} onChange={() => !readOnly && toggleFlag('resultsBlock', key)} disabled={readOnly} />
              <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').replace('show ', 'Show ')}</span>
            </label>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-base font-semibold mb-3">Footer Options</h2>
        <div className="space-y-2">
          {Object.entries(config?.footerOptions ?? {}).map(([key, val]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={val as boolean} onChange={() => !readOnly && toggleFlag('footerOptions', key)} disabled={readOnly} />
              <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').replace('show ', 'Show ')}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Status Colors + Page Constants ──────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  DRAFT: 'bg-yellow-100 text-yellow-800',
  ARCHIVED: 'bg-gray-100 text-gray-700',
};

const DEFAULT_CONFIG = {
  headerOptions: { showLogo: true, showBrandName: true, showReportHeader: true },
  demographicsBlock: { showMrn: true, showAge: true, showGender: true, showDob: false },
  resultsBlock: { showReferenceRange: true, showFlag: true, showUnit: true },
  footerOptions: { showDisclaimer: true, showSignature: true, showVerifiedBy: true },
  sectionOrder: ['header', 'demographics', 'results', 'footer'],
};

export default function TemplateEditorPage() {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id ?? '';

  const [tpl, setTpl] = useState<any>(null);
  const [name, setName] = useState('');
  const [config, setConfig] = useState<any>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'archive' | 'new-version' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/admin/templates/{templateId}' as any, { params: { path: { templateId: id } } }).then((res) => {
      const t = res.data as any;
      if (t) {
        setTpl(t);
        setName(t.name);
        setConfig(t.configJson ?? DEFAULT_CONFIG);
      }
      setLoading(false);
    }).catch(() => { setError('Failed to load template'); setLoading(false); });
  }, [id]);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.PATCH('/admin/templates/{templateId}' as any, {
        params: { path: { templateId: id } },
        body: { name, configJson: config },
      });
      const updated = res.data as any;
      if (updated?.id && updated.id !== id) {
        // A new draft version was created (template was ACTIVE)
        setSuccess('A new draft version was created. Redirecting…');
        setTimeout(() => router.push(`/templates/${updated.id}`), 1500);
      } else {
        setTpl(updated);
        setSuccess('Template saved successfully.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function doAction(action: 'activate' | 'archive' | 'new-version') {
    setActionLoading(true);
    setConfirmAction(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      if (action === 'activate') {
        const res = await api.POST('/admin/templates/{templateId}/activate' as any, { params: { path: { templateId: id } } });
        setTpl(res.data);
        setSuccess('Template activated.');
      } else if (action === 'archive') {
        await api.POST('/admin/templates/{templateId}/archive' as any, { params: { path: { templateId: id } } });
        setSuccess('Template archived. Redirecting…');
        setTimeout(() => router.push('/templates'), 1500);
      } else if (action === 'new-version') {
        const res = await api.POST('/admin/templates/{templateId}/new-version' as any, { params: { path: { templateId: id } } });
        const newId = (res.data as any)?.id;
        setSuccess('New draft version created. Redirecting…');
        setTimeout(() => router.push(`/templates/${newId}`), 1500);
      }
    } catch (e: any) {
      setError(e?.message ?? `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading template…</div>;
  if (!tpl) return <div className="p-6 text-destructive">{error ?? 'Template not found.'}</div>;

  const isReadOnly = tpl.status === 'ARCHIVED';
  const isGraphical = tpl.templateFamily === 'GRAPHICAL_SCALE_REPORT';
  const isHybrid    = tpl.templateFamily === 'HYBRID_TEMPLATE';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/templates" className="text-sm text-muted-foreground hover:underline">Templates</Link>
            <span className="text-muted-foreground">›</span>
            <span className="text-sm font-medium">{tpl.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{tpl.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[tpl.status]}`}>
              {tpl.status}
            </span>
            <span className="text-xs text-muted-foreground">v{tpl.templateVersion}</span>
            <span className="text-xs text-muted-foreground font-mono">{tpl.code}</span>
            <span className="text-xs text-muted-foreground">{tpl.templateFamily}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/templates/${id}/preview`}
            className="px-3 py-1.5 border rounded-md text-sm hover:bg-muted"
          >
            Preview
          </Link>
          {tpl.status === 'ACTIVE' && (
            <button
              onClick={() => setConfirmAction('new-version')}
              className="px-3 py-1.5 border rounded-md text-sm hover:bg-muted"
              disabled={actionLoading}
            >
              New Version
            </button>
          )}
          {tpl.status === 'DRAFT' && (
            <button
              onClick={() => setConfirmAction('activate')}
              className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
              disabled={actionLoading}
            >
              Activate
            </button>
          )}
          {tpl.status === 'ACTIVE' && (
            <button
              onClick={() => setConfirmAction('archive')}
              className="px-3 py-1.5 border rounded-md text-sm text-gray-500 hover:bg-gray-50"
              disabled={actionLoading}
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-md text-sm">{success}</div>}

      {isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
          This template is archived and cannot be edited. Clone it to create a new editable copy.
        </div>
      )}

      {/* Read-only metadata */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/20 rounded-lg">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Family</div>
          <div className="text-sm font-medium">{tpl.templateFamily}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Schema Type</div>
          <div className="text-sm font-medium">{tpl.schemaType}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Source</div>
          <div className="text-sm">{tpl.isSystemProvisioned ? 'System Provisioned' : 'Custom'}</div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="space-y-6">
        <section>
          <h2 className="text-base font-semibold mb-3">Metadata</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isReadOnly}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-50"
            />
          </div>
        </section>

        {/* Family-specific config editor */}
        {isHybrid ? (
          <div className="rounded-lg border p-6 text-center">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="font-semibold text-lg mb-1">Hybrid Block Layout Template</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This template uses the visual block-based layout editor (Template Studio).
              Click below to open the drag-and-drop designer.
            </p>
            <Link
              href={`/templates/studio/${tpl.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
            >
              🎨 Open Template Studio
            </Link>
          </div>
        ) : isGraphical ? (
          <GraphicalScaleEditor
            config={config as GraphicalScaleConfig}
            onChange={setConfig}
            readOnly={isReadOnly}
          />
        ) : (
          <StandardConfigEditor
            config={config}
            onChange={setConfig}
            readOnly={isReadOnly}
          />
        )}

        {!isReadOnly && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Link href="/templates" className="px-4 py-2 border rounded-md text-sm">Cancel</Link>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : tpl.status === 'ACTIVE' ? 'Save as New Draft' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Action confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold mb-2 capitalize">{confirmAction === 'new-version' ? 'Create New Version?' : `${confirmAction} Template?`}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {confirmAction === 'activate' && 'This will activate this draft and archive any other active version with the same code.'}
              {confirmAction === 'archive' && 'This will archive the template. It cannot be used for new documents while archived.'}
              {confirmAction === 'new-version' && 'This will create a new DRAFT version based on this active template. The active version remains in use.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
              <button
                onClick={() => doAction(confirmAction)}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
