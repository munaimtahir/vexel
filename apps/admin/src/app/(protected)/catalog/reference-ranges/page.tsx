'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' };

const emptyForm = () => ({
  parameterId: '', testId: '', gender: '', ageMinYears: '', ageMaxYears: '',
  lowValue: '', highValue: '', criticalLow: '', criticalHigh: '',
  unit: '', normalText: '', interpretation: '',
});

export default function ReferenceRangesPage() {
  const [ranges, setRanges] = useState<any[]>([]);
  const [parameters, setParameters] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterParamId, setFilterParamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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
        api.GET('/catalog/parameters' as any, { params: { query: { limit: 200 } } }),
        api.GET('/catalog/tests' as any, { params: { query: { limit: 200 } } }),
      ]);
      if (pRes.status === 'fulfilled') setParameters((pRes.value.data as any)?.data ?? []);
      if (tRes.status === 'fulfilled') setTests((tRes.value.data as any)?.data ?? []);
      await load();
    }
    init();
  }, []);

  function openCreate() {
    setEditingId(null); setForm(emptyForm()); setError(null); setDrawerOpen(true);
  }

  function openEdit(r: any) {
    setEditingId(r.id);
    setForm({
      parameterId: r.parameterId ?? '', testId: r.testId ?? '', gender: r.gender ?? '',
      ageMinYears: r.ageMinYears != null ? String(r.ageMinYears) : '',
      ageMaxYears: r.ageMaxYears != null ? String(r.ageMaxYears) : '',
      lowValue: r.lowValue != null ? String(r.lowValue) : '',
      highValue: r.highValue != null ? String(r.highValue) : '',
      criticalLow: r.criticalLow != null ? String(r.criticalLow) : '',
      criticalHigh: r.criticalHigh != null ? String(r.criticalHigh) : '',
      unit: r.unit ?? '', normalText: r.normalText ?? '', interpretation: r.interpretation ?? '',
    });
    setError(null); setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const api = getApiClient(getToken() ?? undefined);
    const body: any = { parameterId: form.parameterId };
    if (form.testId) body.testId = form.testId;
    if (form.gender) body.gender = form.gender;
    if (form.ageMinYears !== '') body.ageMinYears = Number(form.ageMinYears);
    if (form.ageMaxYears !== '') body.ageMaxYears = Number(form.ageMaxYears);
    if (form.lowValue !== '') body.lowValue = Number(form.lowValue);
    if (form.highValue !== '') body.highValue = Number(form.highValue);
    if (form.criticalLow !== '') body.criticalLow = Number(form.criticalLow);
    if (form.criticalHigh !== '') body.criticalHigh = Number(form.criticalHigh);
    if (form.unit) body.unit = form.unit;
    if (form.normalText) body.normalText = form.normalText;
    if (form.interpretation) body.interpretation = form.interpretation;

    let res: any;
    if (editingId) {
      res = await api.PATCH('/catalog/reference-ranges/{id}' as any, { params: { path: { id: editingId } }, body });
    } else {
      res = await api.POST('/catalog/reference-ranges' as any, { body });
    }
    if (res.error) { setError(res.error?.message ?? 'Failed'); setSaving(false); return; }
    setDrawerOpen(false); setSaving(false);
    load(page, filterParamId);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const api = getApiClient(getToken() ?? undefined);
    await api.DELETE('/catalog/reference-ranges/{id}' as any, { params: { path: { id } } });
    setDeleteId(null); setDeleting(false);
    load(page, filterParamId);
  }

  function handlePage(p: number) { setPage(p); load(p, filterParamId); }
  function handleFilter(paramId: string) { setFilterParamId(paramId); setPage(1); load(1, paramId); }
  const totalPages = Math.ceil(total / LIMIT);

  const getParamName = (id: string) => parameters.find((p) => p.id === id)?.name ?? id?.slice(0, 8) ?? '—';
  const getTestName = (id: string) => tests.find((t) => t.id === id)?.name ?? id?.slice(0, 8) ?? '—';

  return (
    <div>
      {/* Drawer */}
      {drawerOpen && <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.3)', zIndex: 40 }} onClick={() => setDrawerOpen(false)} />}
      {drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '460px', background: 'hsl(var(--card))', zIndex: 50, boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{editingId ? 'Edit Reference Range' : 'New Reference Range'}</h2>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>×</button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <div style={{ background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>{error}</div>}

            <div>
              <label style={labelStyle}>Parameter *</label>
              <select required value={form.parameterId} onChange={(e) => setForm({ ...form, parameterId: e.target.value })} style={inputStyle}>
                <option value="">Select parameter…</option>
                {parameters.map((p) => <option key={p.id} value={p.id}>{p.name} {p.userCode ? `(${p.userCode})` : ''}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Test (optional — scopes to specific test)</label>
              <select value={form.testId} onChange={(e) => setForm({ ...form, testId: e.target.value })} style={inputStyle}>
                <option value="">All tests</option>
                {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Gender</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} style={inputStyle}>
                  <option value="">Any</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Age Min (yrs)</label>
                <input type="number" min={0} value={form.ageMinYears} onChange={(e) => setForm({ ...form, ageMinYears: e.target.value })} style={inputStyle} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Age Max (yrs)</label>
                <input type="number" min={0} value={form.ageMaxYears} onChange={(e) => setForm({ ...form, ageMaxYears: e.target.value })} style={inputStyle} placeholder="999" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Normal Low</label>
                <input type="number" step="any" value={form.lowValue} onChange={(e) => setForm({ ...form, lowValue: e.target.value })} style={inputStyle} placeholder="e.g. 3.5" />
              </div>
              <div>
                <label style={labelStyle}>Normal High</label>
                <input type="number" step="any" value={form.highValue} onChange={(e) => setForm({ ...form, highValue: e.target.value })} style={inputStyle} placeholder="e.g. 5.5" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Critical Low</label>
                <input type="number" step="any" value={form.criticalLow} onChange={(e) => setForm({ ...form, criticalLow: e.target.value })} style={inputStyle} placeholder="e.g. 2.0" />
              </div>
              <div>
                <label style={labelStyle}>Critical High</label>
                <input type="number" step="any" value={form.criticalHigh} onChange={(e) => setForm({ ...form, criticalHigh: e.target.value })} style={inputStyle} placeholder="e.g. 8.0" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Unit</label>
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={inputStyle} placeholder="e.g. mmol/L" />
              </div>
              <div>
                <label style={labelStyle}>Normal Text (for non-numeric)</label>
                <input value={form.normalText} onChange={(e) => setForm({ ...form, normalText: e.target.value })} style={inputStyle} placeholder="e.g. Negative" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Interpretation Note</label>
              <input value={form.interpretation} onChange={(e) => setForm({ ...form, interpretation: e.target.value })} style={inputStyle} />
            </div>

            <div style={{ marginTop: '8px', display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving} style={{ flex: 1, padding: '10px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Range'}
              </button>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ padding: '10px 16px', background: 'hsl(var(--muted))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'hsl(var(--card))', padding: '24px', borderRadius: '8px', maxWidth: '380px', width: '90%' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Delete Reference Range?</h2>
            <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '20px' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting} style={{ padding: '8px 16px', background: 'hsl(var(--status-destructive-fg))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>{deleting ? 'Deleting...' : 'Delete'}</button>
              <button onClick={() => setDeleteId(null)} style={{ padding: '8px 16px', background: 'hsl(var(--muted))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Reference Ranges</h1>
        <button onClick={openCreate} style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>+ New Range</button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <select value={filterParamId} onChange={(e) => handleFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', minWidth: '260px' }}>
          <option value="">All parameters</option>
          {parameters.map((p) => <option key={p.id} value={p.id}>{p.name} {p.userCode ? `(${p.userCode})` : ''}</option>)}
        </select>
      </div>

      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: 'hsl(var(--background))' }}>
            <tr>
              {['Parameter', 'Test', 'Gender', 'Age', 'Normal Range', 'Critical', 'Unit', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading…</td></tr>
            ) : ranges.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>No reference ranges found.</td></tr>
            ) : ranges.map((r: any) => (
              <tr key={r.id} style={{ borderTop: '1px solid hsl(var(--muted))' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{getParamName(r.parameterId)}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>{r.testId ? getTestName(r.testId) : '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  {r.gender ? <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '11px', background: r.gender === 'M' ? 'hsl(var(--status-info-bg))' : 'hsl(var(--status-info-bg))', color: r.gender === 'M' ? 'hsl(var(--status-info-fg))' : 'hsl(var(--status-info-fg))' }}>{r.gender === 'M' ? 'Male' : 'Female'}</span> : <span style={{ color: 'hsl(var(--muted-foreground))' }}>Any</span>}
                </td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>
                  {r.ageMinYears != null || r.ageMaxYears != null ? `${r.ageMinYears ?? 0}–${r.ageMaxYears ?? '∞'} yrs` : 'Any'}
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', color: 'hsl(var(--foreground))' }}>
                  {r.lowValue != null || r.highValue != null ? `${r.lowValue ?? '?'} – ${r.highValue ?? '?'}` : r.normalText ?? '—'}
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--status-destructive-fg))' }}>
                  {r.criticalLow != null || r.criticalHigh != null ? `${r.criticalLow ?? '?'} / ${r.criticalHigh ?? '?'}` : '—'}
                </td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>{r.unit ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => openEdit(r)} style={{ padding: '3px 8px', fontSize: '12px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => setDeleteId(r.id)} style={{ padding: '3px 8px', fontSize: '12px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', border: '1px solid hsl(var(--status-destructive-border))', borderRadius: '4px', cursor: 'pointer' }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
