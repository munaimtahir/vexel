'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { DataTable } from '@vexel/ui-system';

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' };
const badgeStyle = (bg: string, fg: string): React.CSSProperties => ({ padding: '2px 7px', borderRadius: '10px', fontSize: '11px', background: bg, color: fg, display: 'inline-block' });

const emptyForm = () => ({
  parameterId: '', testId: '', gender: '', ageMinYears: '', ageMaxYears: '',
  rangeType: 'numeric' as 'numeric' | 'expression',
  lowValue: '', highValue: '', criticalLow: '', criticalHigh: '',
  unit: '', normalText: '', interpretation: '', isActive: true,
});

type ValidationErrors = Partial<Record<'ageMinYears' | 'ageMaxYears' | 'lowValue' | 'highValue' | 'criticalLow' | 'criticalHigh' | 'scope' | 'rangeValue', string>>;

// ─── Display preview string ───────────────────────────────────────────────────
function buildPreview(form: ReturnType<typeof emptyForm>, paramName: string): string {
  const parts: string[] = [];
  if (form.gender) parts.push(form.gender === 'M' ? 'Male' : 'Female');
  else parts.push('Any sex');
  const ageMin = form.ageMinYears !== '' ? form.ageMinYears : '0';
  const ageMax = form.ageMaxYears !== '' ? form.ageMaxYears : '∞';
  parts.push(`${ageMin}–${ageMax} yrs`);
  if (form.rangeType === 'numeric') {
    const lo = form.lowValue !== '' ? form.lowValue : '?';
    const hi = form.highValue !== '' ? form.highValue : '?';
    const unit = form.unit || '';
    parts.push(`${lo}–${hi}${unit ? ' ' + unit : ''}`);
  } else {
    parts.push(form.normalText || '(expression)');
  }
  return paramName ? `${paramName}: ${parts.join(', ')}` : parts.join(', ');
}

export default function ReferenceRangesPage() {
  const router = useRouter();
  const [ranges, setRanges] = useState<any[]>([]);
  const [parameters, setParameters] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterParamId, setFilterParamId] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Create/Edit drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Parameter drilldown drawer
  const [drillParamId, setDrillParamId] = useState<string | null>(null);
  const [drillRanges, setDrillRanges] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const LIMIT = 20;

  const load = useCallback(async (p = page, paramId = filterParamId) => {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const query: any = { page: p, limit: LIMIT };
    if (paramId) query.parameterId = paramId;
    const res = await api.GET('/catalog/reference-ranges' as any, { params: { query } });
    setRanges((res.data as any)?.data ?? (Array.isArray(res.data) ? res.data : []));
    setTotal((res.data as any)?.total ?? 0);
    setLoading(false);
  }, [page, filterParamId]);

  useEffect(() => {
    async function init() {
      const api = getApiClient(getToken() ?? undefined);
      const [pRes, tRes] = await Promise.allSettled([
        api.GET('/catalog/parameters' as any, { params: { query: { limit: 500, page: 1 } } }),
        api.GET('/catalog/tests' as any, { params: { query: { limit: 500, page: 1 } } }),
      ]);
      if (pRes.status === 'fulfilled') setParameters((pRes.value.data as any)?.data ?? []);
      if (tRes.status === 'fulfilled') setTests((tRes.value.data as any)?.data ?? []);
      await load();
    }
    init();
  }, []);

  // ─── Drilldown ──────────────────────────────────────────────────────────────
  async function openDrill(paramId: string) {
    setDrillParamId(paramId);
    setDrillLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/reference-ranges' as any, { params: { query: { parameterId: paramId, limit: 500, page: 1 } } });
    const loaded = (res.data as any)?.data ?? (Array.isArray(res.data) ? res.data : []);
    // sort: test-scoped first (by testId), then by gender asc, then by ageMin asc
    loaded.sort((a: any, b: any) => {
      const ta = a.testId ?? ''; const tb = b.testId ?? '';
      if (ta !== tb) return ta < tb ? -1 : 1;
      const ga = a.gender ?? 'Z'; const gb = b.gender ?? 'Z';
      if (ga !== gb) return ga < gb ? -1 : 1;
      return (a.ageMinYears ?? 0) - (b.ageMinYears ?? 0);
    });
    setDrillRanges(loaded);
    setDrillLoading(false);
  }

  function closeDrill() { setDrillParamId(null); setDrillRanges([]); }

  // ─── Create / Edit ──────────────────────────────────────────────────────────
  function openCreate(prefillParamId?: string) {
    setEditingId(null);
    const f = emptyForm();
    if (prefillParamId) f.parameterId = prefillParamId;
    setForm(f);
    setError(null);
    setDrawerOpen(true);
  }

  function openEdit(r: any) {
    setEditingId(r.id);
    const hasNumeric = r.lowValue != null || r.highValue != null;
    setForm({
      parameterId: r.parameterId ?? '',
      testId: r.testId ?? '',
      gender: r.gender ?? '',
      ageMinYears: r.ageMinYears != null ? String(r.ageMinYears) : '',
      ageMaxYears: r.ageMaxYears != null ? String(r.ageMaxYears) : '',
      rangeType: hasNumeric ? 'numeric' : 'expression',
      lowValue: r.lowValue != null ? String(r.lowValue) : '',
      highValue: r.highValue != null ? String(r.highValue) : '',
      criticalLow: r.criticalLow != null ? String(r.criticalLow) : '',
      criticalHigh: r.criticalHigh != null ? String(r.criticalHigh) : '',
      unit: r.unit ?? '',
      normalText: r.normalText ?? '',
      interpretation: r.interpretation ?? '',
      isActive: r.isActive !== false,
    });
    setError(null);
    setDrawerOpen(true);
  }

  const validation = useMemo(() => validateForm(form, ranges, editingId), [form, ranges, editingId]);
  const selectedParam = useMemo(() => parameters.find((p) => p.id === form.parameterId), [form.parameterId, parameters]);
  const previewStr = useMemo(() => buildPreview(form, selectedParam?.name ?? ''), [form, selectedParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validation.ok) { setError('Fix validation errors before saving.'); return; }
    setSaving(true); setError(null);
    const api = getApiClient(getToken() ?? undefined);
    const body: any = { parameterId: form.parameterId };
    if (form.testId) body.testId = form.testId;
    if (form.gender) body.gender = form.gender;
    if (form.ageMinYears !== '') body.ageMinYears = Number(form.ageMinYears);
    if (form.ageMaxYears !== '') body.ageMaxYears = Number(form.ageMaxYears);
    if (form.rangeType === 'numeric') {
      if (form.lowValue !== '') body.lowValue = Number(form.lowValue);
      if (form.highValue !== '') body.highValue = Number(form.highValue);
      if (form.unit) body.unit = form.unit;
    } else {
      if (form.normalText) body.normalText = form.normalText;
    }
    if (form.criticalLow !== '') body.criticalLow = Number(form.criticalLow);
    if (form.criticalHigh !== '') body.criticalHigh = Number(form.criticalHigh);
    if (form.interpretation) body.interpretation = form.interpretation;
    body.isActive = form.isActive;

    let res: any;
    if (editingId) {
      res = await api.PUT('/catalog/reference-ranges/{id}' as any, { params: { path: { id: editingId } }, body });
    } else {
      res = await api.POST('/catalog/reference-ranges' as any, { body });
    }
    if (res.error) { setError(res.error?.message ?? 'Failed'); setSaving(false); return; }
    setDrawerOpen(false); setSaving(false);
    load(page, filterParamId);
    // refresh drilldown if open for this param
    if (drillParamId === form.parameterId) openDrill(drillParamId);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const api = getApiClient(getToken() ?? undefined);
    await api.DELETE('/catalog/reference-ranges/{id}' as any, { params: { path: { id } } });
    setDeleteId(null); setDeleteTarget(null); setDeleting(false);
    load(page, filterParamId);
    if (drillParamId) openDrill(drillParamId);
  }

  function confirmDelete(r: any) { setDeleteId(r.id); setDeleteTarget(r); }

  function handlePage(p: number) { setPage(p); load(p, filterParamId); }

  function handleFilter(paramId: string) { setFilterParamId(paramId); setPage(1); load(1, paramId); }

  // ─── Client-side filters (gender, active, search applied to loaded page) ───
  const filteredRanges = useMemo(() => {
    let rows = ranges;
    const q = search.toLowerCase().trim();
    if (q) {
      rows = rows.filter((r) => {
        const p = parameters.find((p) => p.id === r.parameterId);
        const t = tests.find((t) => t.id === r.testId);
        return (
          p?.name?.toLowerCase().includes(q) ||
          p?.userCode?.toLowerCase().includes(q) ||
          p?.externalId?.toLowerCase().includes(q) ||
          t?.name?.toLowerCase().includes(q) ||
          t?.userCode?.toLowerCase().includes(q)
        );
      });
    }
    if (filterGender) rows = rows.filter((r) => (r.gender ?? '') === filterGender);
    if (filterActive === 'active') rows = rows.filter((r) => r.isActive !== false);
    if (filterActive === 'inactive') rows = rows.filter((r) => r.isActive === false);
    return rows;
  }, [ranges, search, filterGender, filterActive, parameters, tests]);

  const totalPages = Math.ceil(total / LIMIT);
  const getParamName = (id: string) => parameters.find((p) => p.id === id)?.name ?? id?.slice(0, 8) ?? '—';
  const getParamCode = (id: string) => parameters.find((p) => p.id === id)?.userCode ?? '';
  const getTestName = (id: string) => tests.find((t) => t.id === id)?.name ?? id?.slice(0, 8) ?? '—';

  const columns = [
    {
      key: 'parameter',
      header: 'Parameter',
      cell: (r: any) => (
        <button
          onClick={() => openDrill(r.parameterId)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>{getParamName(r.parameterId)}</span>
          {getParamCode(r.parameterId) && <span style={{ marginLeft: '5px', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>({getParamCode(r.parameterId)})</span>}
        </button>
      ),
    },
    {
      key: 'test',
      header: 'Test Override',
      cell: (r: any) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>{r.testId ? getTestName(r.testId) : <em>Default</em>}</span>,
    },
    {
      key: 'gender',
      header: 'Sex',
      cell: (r: any) => r.gender
        ? <span style={badgeStyle('hsl(var(--status-info-bg))', 'hsl(var(--status-info-fg))')}>{r.gender === 'M' ? 'M' : 'F'}</span>
        : <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>Any</span>,
    },
    {
      key: 'age',
      header: 'Age Band',
      cell: (r: any) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px', fontFamily: 'monospace' }}>{r.ageMinYears != null || r.ageMaxYears != null ? `${r.ageMinYears ?? 0}–${r.ageMaxYears ?? '∞'} y` : 'Any'}</span>,
    },
    {
      key: 'normalRange',
      header: 'Range',
      cell: (r: any) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'hsl(var(--foreground))' }}>
          {r.lowValue != null || r.highValue != null ? `${r.lowValue ?? '?'} – ${r.highValue ?? '?'}` : r.normalText ?? '—'}
        </span>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      cell: (r: any) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>{r.unit || '—'}</span>,
    },
    {
      key: 'critical',
      header: 'Critical',
      cell: (r: any) => r.criticalLow != null || r.criticalHigh != null
        ? <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--status-destructive-fg))' }}>{r.criticalLow ?? '?'} / {r.criticalHigh ?? '?'}</span>
        : <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>—</span>,
    },
    {
      key: 'active',
      header: 'Active',
      cell: (r: any) => r.isActive === false
        ? <span style={badgeStyle('hsl(var(--status-destructive-bg))', 'hsl(var(--status-destructive-fg))')}>Inactive</span>
        : <span style={badgeStyle('hsl(var(--status-success-bg))', 'hsl(var(--status-success-fg))')}>Active</span>,
    },
    {
      key: 'actions',
      header: '',
      cell: (r: any) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => openEdit(r)} style={{ padding: '3px 8px', fontSize: '12px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
          <button onClick={() => confirmDelete(r)} style={{ padding: '3px 8px', fontSize: '12px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', border: '1px solid hsl(var(--status-destructive-border))', borderRadius: '4px', cursor: 'pointer' }}>Del</button>
        </div>
      ),
    },
  ];

  // ─── Drilldown grouped data ─────────────────────────────────────────────────
  const drillParam = drillParamId ? parameters.find((p) => p.id === drillParamId) : null;
  const drillGrouped = useMemo(() => {
    if (!drillRanges.length) return [];
    const testIds = [...new Set(drillRanges.map((r) => r.testId ?? null))];
    // test-scoped first, then null (default)
    testIds.sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      const na = getTestName(a); const nb = getTestName(b);
      return na.localeCompare(nb);
    });
    return testIds.map((tid) => ({
      testId: tid,
      rows: drillRanges
        .filter((r) => (r.testId ?? null) === tid)
        .sort((a: any, b: any) => {
          const ga = a.gender ?? 'Z'; const gb = b.gender ?? 'Z';
          if (ga !== gb) return ga < gb ? -1 : 1;
          return (a.ageMinYears ?? 0) - (b.ageMinYears ?? 0);
        }),
    }));
  }, [drillRanges, tests]);

  return (
    <div>
      {/* ── Overlay (shared for create/edit and drilldown) ─────────────────── */}
      {(drawerOpen || drillParamId) && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.25)', zIndex: 40 }}
          onClick={() => { setDrawerOpen(false); closeDrill(); }}
        />
      )}

      {/* ── Create / Edit drawer ───────────────────────────────────────────── */}
      {drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px', background: 'hsl(var(--card))', zIndex: 50, boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{editingId ? 'Edit Reference Range' : 'New Reference Range'}</h2>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>×</button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <div style={{ background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>{error}</div>}
            {validation.errors.scope && <div style={{ background: 'hsl(var(--status-warning-bg))', color: 'hsl(var(--status-warning-fg))', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>{validation.errors.scope}</div>}

            {/* Preview */}
            {form.parameterId && (
              <div style={{ background: 'hsl(var(--muted))', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontFamily: 'monospace', color: 'hsl(var(--foreground))' }}>
                Preview: {previewStr}
              </div>
            )}

            <div>
              <label style={labelStyle}>Parameter *</label>
              <select required value={form.parameterId} onChange={(e) => setForm({ ...form, parameterId: e.target.value })} style={inputStyle}>
                <option value="">Select parameter…</option>
                {parameters.map((p) => <option key={p.id} value={p.id}>{p.name}{p.userCode ? ` (${p.userCode})` : ''}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Test override (optional — scopes to specific test)</label>
              <select value={form.testId} onChange={(e) => setForm({ ...form, testId: e.target.value })} style={inputStyle}>
                <option value="">Default (all tests)</option>
                {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Sex</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} style={inputStyle}>
                  <option value="">Any</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Age Min (yrs)</label>
                <input type="number" min={0} value={form.ageMinYears} onChange={(e) => setForm({ ...form, ageMinYears: e.target.value })} style={{ ...inputStyle, borderColor: validation.errors.ageMinYears ? 'hsl(var(--status-destructive-fg))' : 'hsl(var(--border))' }} placeholder="0" />
                {validation.errors.ageMinYears && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'hsl(var(--status-destructive-fg))' }}>{validation.errors.ageMinYears}</p>}
              </div>
              <div>
                <label style={labelStyle}>Age Max (yrs)</label>
                <input type="number" min={0} value={form.ageMaxYears} onChange={(e) => setForm({ ...form, ageMaxYears: e.target.value })} style={{ ...inputStyle, borderColor: validation.errors.ageMaxYears ? 'hsl(var(--status-destructive-fg))' : 'hsl(var(--border))' }} placeholder="999" />
                {validation.errors.ageMaxYears && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'hsl(var(--status-destructive-fg))' }}>{validation.errors.ageMaxYears}</p>}
              </div>
            </div>

            {/* Range type toggle */}
            <div>
              <label style={labelStyle}>Range type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['numeric', 'expression'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, rangeType: t })}
                    style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '5px', border: '1px solid hsl(var(--border))', cursor: 'pointer', fontWeight: form.rangeType === t ? 700 : 400, background: form.rangeType === t ? 'hsl(var(--primary))' : 'hsl(var(--muted))', color: form.rangeType === t ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))' }}>
                    {t === 'numeric' ? 'Numeric (low / high)' : 'Expression / Text'}
                  </button>
                ))}
              </div>
            </div>

            {form.rangeType === 'numeric' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Normal Low</label>
                    <input type="number" step="any" value={form.lowValue} onChange={(e) => setForm({ ...form, lowValue: e.target.value })} style={{ ...inputStyle, borderColor: validation.errors.lowValue ? 'hsl(var(--status-destructive-fg))' : 'hsl(var(--border))' }} placeholder="e.g. 3.5" />
                    {validation.errors.lowValue && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'hsl(var(--status-destructive-fg))' }}>{validation.errors.lowValue}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>Normal High</label>
                    <input type="number" step="any" value={form.highValue} onChange={(e) => setForm({ ...form, highValue: e.target.value })} style={{ ...inputStyle, borderColor: validation.errors.highValue ? 'hsl(var(--status-destructive-fg))' : 'hsl(var(--border))' }} placeholder="e.g. 5.5" />
                    {validation.errors.highValue && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'hsl(var(--status-destructive-fg))' }}>{validation.errors.highValue}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>Unit</label>
                    <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={inputStyle} placeholder="e.g. mmol/L" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Critical Low</label>
                    <input type="number" step="any" value={form.criticalLow} onChange={(e) => setForm({ ...form, criticalLow: e.target.value })} style={{ ...inputStyle, borderColor: validation.errors.criticalLow ? 'hsl(var(--status-destructive-fg))' : 'hsl(var(--border))' }} placeholder="e.g. 2.0" />
                    {validation.errors.criticalLow && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'hsl(var(--status-destructive-fg))' }}>{validation.errors.criticalLow}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>Critical High</label>
                    <input type="number" step="any" value={form.criticalHigh} onChange={(e) => setForm({ ...form, criticalHigh: e.target.value })} style={{ ...inputStyle, borderColor: validation.errors.criticalHigh ? 'hsl(var(--status-destructive-fg))' : 'hsl(var(--border))' }} placeholder="e.g. 8.0" />
                    {validation.errors.criticalHigh && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'hsl(var(--status-destructive-fg))' }}>{validation.errors.criticalHigh}</p>}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label style={labelStyle}>Expression / Normal Text *</label>
                <input required={form.rangeType === 'expression'} value={form.normalText} onChange={(e) => setForm({ ...form, normalText: e.target.value })} style={{ ...inputStyle, borderColor: validation.errors.rangeValue ? 'hsl(var(--status-destructive-fg))' : 'hsl(var(--border))' }} placeholder="e.g. Negative, Non-reactive, &lt; 200" />
                {validation.errors.rangeValue && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'hsl(var(--status-destructive-fg))' }}>{validation.errors.rangeValue}</p>}
              </div>
            )}

            <div>
              <label style={labelStyle}>Interpretation note</label>
              <input value={form.interpretation} onChange={(e) => setForm({ ...form, interpretation: e.target.value })} style={inputStyle} placeholder="Optional clinical note" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="rr-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: '16px', height: '16px' }} />
              <label htmlFor="rr-active" style={{ fontSize: '14px', color: 'hsl(var(--foreground))', cursor: 'pointer' }}>Active</label>
            </div>

            <div style={{ marginTop: '8px', display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving || !validation.ok}
                style={{ flex: 1, padding: '10px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: saving || !validation.ok ? 'default' : 'pointer', fontSize: '14px', fontWeight: 600, opacity: validation.ok ? 1 : 0.6 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Range'}
              </button>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ padding: '10px 16px', background: 'hsl(var(--muted))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Parameter drilldown drawer ─────────────────────────────────────── */}
      {drillParamId && !drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px', background: 'hsl(var(--card))', zIndex: 50, boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                {drillParam?.name ?? drillParamId}
                {drillParam?.userCode && <span style={{ marginLeft: '8px', fontSize: '13px', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>({drillParam.userCode})</span>}
              </h2>
              <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginTop: '2px' }}>All reference ranges for this parameter</p>
            </div>
            <button onClick={closeDrill} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>×</button>
          </div>

          <div style={{ padding: '16px 24px' }}>
            <button onClick={() => { closeDrill(); openCreate(drillParamId); }}
              style={{ padding: '7px 14px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
              + Add range for this parameter
            </button>

            {drillLoading ? (
              <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>Loading…</p>
            ) : drillGrouped.length === 0 ? (
              <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>No ranges defined yet.</p>
            ) : drillGrouped.map(({ testId, rows }) => (
              <div key={testId ?? '__default'} style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {testId ? (
                    <><span style={badgeStyle('hsl(var(--status-info-bg))', 'hsl(var(--status-info-fg))')}>Test</span>{getTestName(testId)}</>
                  ) : (
                    <><span style={badgeStyle('hsl(var(--muted))', 'hsl(var(--muted-foreground))')}>Default</span>All tests</>
                  )}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'hsl(var(--muted))' }}>
                      {['Sex', 'Age Band', 'Range', 'Unit', 'Critical', ''].map((h) => (
                        <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'hsl(var(--muted-foreground))', fontWeight: 600, fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                        <td style={{ padding: '5px 8px' }}>{r.gender ?? <em style={{ color: 'hsl(var(--muted-foreground))' }}>Any</em>}</td>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{r.ageMinYears != null || r.ageMaxYears != null ? `${r.ageMinYears ?? 0}–${r.ageMaxYears ?? '∞'}y` : 'Any'}</td>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{r.lowValue != null || r.highValue != null ? `${r.lowValue ?? '?'}–${r.highValue ?? '?'}` : r.normalText ?? '—'}</td>
                        <td style={{ padding: '5px 8px', color: 'hsl(var(--muted-foreground))' }}>{r.unit || '—'}</td>
                        <td style={{ padding: '5px 8px', color: 'hsl(var(--status-destructive-fg))', fontFamily: 'monospace' }}>{r.criticalLow != null || r.criticalHigh != null ? `${r.criticalLow ?? '?'}/${r.criticalHigh ?? '?'}` : '—'}</td>
                        <td style={{ padding: '5px 8px' }}>
                          <div style={{ display: 'flex', gap: '3px' }}>
                            <button onClick={() => { closeDrill(); openEdit(r); }} style={{ padding: '2px 6px', fontSize: '11px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '3px', cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => confirmDelete(r)} style={{ padding: '2px 6px', fontSize: '11px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', border: '1px solid hsl(var(--status-destructive-border))', borderRadius: '3px', cursor: 'pointer' }}>Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'hsl(var(--card))', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Delete Reference Range?</h2>
            <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '6px' }}>
              This removes the reference range row for <strong>this tenant only</strong> and cannot be undone.
            </p>
            {deleteTarget && (
              <p style={{ fontSize: '12px', color: 'hsl(var(--foreground))', background: 'hsl(var(--muted))', padding: '8px 10px', borderRadius: '5px', fontFamily: 'monospace', marginBottom: '16px' }}>
                {getParamName(deleteTarget.parameterId)}{deleteTarget.testId ? ` / ${getTestName(deleteTarget.testId)}` : ''} · {deleteTarget.gender ?? 'Any'} · {deleteTarget.ageMinYears ?? 0}–{deleteTarget.ageMaxYears ?? '∞'}y
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting} style={{ padding: '8px 16px', background: 'hsl(var(--status-destructive-fg))', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>{deleting ? 'Deleting...' : 'Delete'}</button>
              <button onClick={() => { setDeleteId(null); setDeleteTarget(null); }} style={{ padding: '8px 16px', background: 'hsl(var(--muted))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Reference Ranges</h1>
          <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginTop: '2px' }}>
            Normal and critical limits per parameter, stratified by sex and age.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => router.push('/admin/catalog/import-export')}
            style={{ padding: '7px 12px', fontSize: '13px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '6px', cursor: 'pointer', color: 'hsl(var(--foreground))' }}>
            ⬇ Export
          </button>
          <button
            onClick={() => router.push('/admin/catalog/import-export')}
            style={{ padding: '7px 12px', fontSize: '13px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '6px', cursor: 'pointer', color: 'hsl(var(--foreground))' }}>
            ⬆ Import
          </button>
          <button onClick={() => openCreate()} style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            + New Range
          </button>
        </div>
      </div>

      {/* ── Filters row ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by parameter or test name…"
          style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', minWidth: '240px' }}
        />
        <select value={filterParamId} onChange={(e) => handleFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', minWidth: '200px' }}>
          <option value="">All parameters</option>
          {parameters.map((p) => <option key={p.id} value={p.id}>{p.name}{p.userCode ? ` (${p.userCode})` : ''}</option>)}
        </select>
        <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px' }}>
          <option value="">All sexes</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px' }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {(search || filterGender || filterActive) && (
          <button onClick={() => { setSearch(''); setFilterGender(''); setFilterActive(''); }} style={{ padding: '8px 12px', fontSize: '13px', background: 'none', border: '1px solid hsl(var(--border))', borderRadius: '6px', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>
            Clear filters
          </button>
        )}
      </div>

      <DataTable columns={columns} data={filteredRanges} keyExtractor={(r: any) => `${r.id}`} loading={loading} emptyMessage="No reference ranges found." className="shadow-sm" />

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '16px', alignItems: 'center', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
          <button disabled={page <= 1} onClick={() => handlePage(page - 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'default', background: 'hsl(var(--card))' }}>← Prev</button>
          <span>Page {page} of {totalPages} ({total} total)</span>
          <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'default', background: 'hsl(var(--card))' }}>Next →</button>
        </div>
      )}
    </div>
  );
}

function toNum(value: string): number | null {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function rangeScopeKey(row: { parameterId: string; testId?: string; gender?: string; ageMinYears?: number | null; ageMaxYears?: number | null }): string {
  return [
    row.parameterId || '',
    row.testId || '',
    row.gender || '',
    row.ageMinYears == null ? '' : String(row.ageMinYears),
    row.ageMaxYears == null ? '' : String(row.ageMaxYears),
  ].join('|');
}

function validateForm(form: ReturnType<typeof emptyForm>, ranges: any[], editingId: string | null): { ok: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};

  const ageMin = toNum(form.ageMinYears);
  const ageMax = toNum(form.ageMaxYears);
  const low = toNum(form.lowValue);
  const high = toNum(form.highValue);
  const criticalLow = toNum(form.criticalLow);
  const criticalHigh = toNum(form.criticalHigh);

  if (ageMin != null && ageMax != null && ageMin > ageMax) {
    errors.ageMinYears = 'Age min must be ≤ age max.';
    errors.ageMaxYears = 'Age max must be ≥ age min.';
  }

  if (form.rangeType === 'expression' && !form.normalText.trim()) {
    errors.rangeValue = 'Expression text is required.';
  }

  if (low != null && high != null && low > high) {
    errors.lowValue = 'Normal low must be ≤ normal high.';
    errors.highValue = 'Normal high must be ≥ normal low.';
  }

  if (criticalLow != null && low != null && criticalLow > low) {
    errors.criticalLow = 'Critical low should be ≤ normal low.';
  }

  if (criticalHigh != null && high != null && criticalHigh < high) {
    errors.criticalHigh = 'Critical high should be ≥ normal high.';
  }

  if (criticalLow != null && criticalHigh != null && criticalLow > criticalHigh) {
    errors.criticalLow = 'Critical low must be ≤ critical high.';
    errors.criticalHigh = 'Critical high must be ≥ critical low.';
  }

  if (form.parameterId) {
    const scope = rangeScopeKey({
      parameterId: form.parameterId,
      testId: form.testId || '',
      gender: form.gender || '',
      ageMinYears: ageMin,
      ageMaxYears: ageMax,
    });

    const duplicate = ranges.some((row) => {
      if (editingId && row.id === editingId) return false;
      return scope === rangeScopeKey({
        parameterId: row.parameterId,
        testId: row.testId || '',
        gender: row.gender || '',
        ageMinYears: row.ageMinYears,
        ageMaxYears: row.ageMaxYears,
      });
    });

    if (duplicate) {
      errors.scope = 'A reference range already exists for the same parameter/test/sex/age scope.';
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
