'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const RESULT_TYPES = ['numeric', 'text', 'boolean', 'enum'];

const emptyForm = () => ({
  name: '', externalId: '', userCode: '', resultType: 'numeric',
  defaultUnit: '', decimals: '', allowedValues: '', loincCode: '', defaultValue: '', isActive: true,
});

export default function ParametersPage() {
  const [params, setParams] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 20;

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/parameters' as any, { params: { query: { search: s || undefined, page: p, limit: LIMIT } } });
    setParams((res.data as any)?.data ?? []);
    setTotal((res.data as any)?.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, []);

  async function openCreate() {
    setEditingId(null); setForm(emptyForm()); setError(null); setDrawerOpen(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/parameters/next-id' as any, {});
    const nextId = (res.data as any)?.nextId ?? '';
    setForm(f => ({ ...f, externalId: nextId }));
  }
  function openEdit(p: any) {
    setEditingId(p.id);
    setForm({
      name: p.name ?? '', externalId: p.externalId ?? '',
      userCode: p.userCode ?? '', resultType: p.resultType ?? 'numeric',
      defaultUnit: p.defaultUnit ?? '', decimals: p.decimals != null ? String(p.decimals) : '',
      allowedValues: Array.isArray(p.allowedValues) ? p.allowedValues.join(', ') : (p.allowedValues ?? ''),
      loincCode: p.loincCode ?? '', defaultValue: p.defaultValue ?? '', isActive: p.isActive !== false,
    });
    setError(null); setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const api = getApiClient(getToken() ?? undefined);
    const body: any = {
      name: form.name,
      resultType: form.resultType,
      isActive: form.isActive,
    };
    if (form.externalId) body.externalId = form.externalId;
    if (form.userCode) body.userCode = form.userCode;
    if (form.loincCode) body.loincCode = form.loincCode;
    if (form.defaultValue) body.defaultValue = form.defaultValue;
    if (form.resultType === 'numeric') {
      if (form.defaultUnit) body.defaultUnit = form.defaultUnit;
      if (form.decimals !== '') body.decimals = Number(form.decimals);
    }
    if (form.resultType === 'enum' && form.allowedValues) {
      body.allowedValues = form.allowedValues.split(',').map((v: string) => v.trim()).filter(Boolean);
    }

    let res: any;
    if (editingId) {
      res = await api.PUT('/catalog/parameters/{parameterId}' as any, { params: { path: { parameterId: editingId } }, body });
    } else {
      res = await api.POST('/catalog/parameters' as any, { body });
    }
    if (res.error) { setError(res.error?.message ?? 'Failed'); setSaving(false); return; }
    setDrawerOpen(false); setSaving(false);
    await load(page, search);
  }

  function handleSearch(val: string) {
    setSearch(val); setPage(1);
    load(1, val);
  }

  function handlePage(p: number) { setPage(p); load(p, search); }

  const totalPages = Math.ceil(total / LIMIT);

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' };

  return (
    <div>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.3)', zIndex: 40 }} onClick={() => setDrawerOpen(false)} />
      )}
      {/* Drawer panel */}
      {drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'hsl(var(--card))', zIndex: 50, boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{editingId ? 'Edit Parameter' : 'New Parameter'}</h2>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>×</button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
            {error && <div style={{ background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Parameter ID <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>· Auto-generated</span></label>
                  <input value={form.externalId} readOnly style={{ ...inputStyle, background: 'hsl(var(--background))', color: 'hsl(var(--muted-foreground))', cursor: 'default' }} />
                </div>
                <div>
                  <label style={labelStyle}>User Code</label>
                  <input value={form.userCode} onChange={(e) => setForm({ ...form, userCode: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Result Type *</label>
                <select required value={form.resultType} onChange={(e) => setForm({ ...form, resultType: e.target.value })} style={inputStyle}>
                  {RESULT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.resultType === 'numeric' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Default Unit (UCUM)</label>
                    <input value={form.defaultUnit} onChange={(e) => setForm({ ...form, defaultUnit: e.target.value })} style={inputStyle} placeholder="e.g. mg/dL" />
                  </div>
                  <div>
                    <label style={labelStyle}>Decimal Places</label>
                    <input type="number" min={0} max={10} value={form.decimals} onChange={(e) => setForm({ ...form, decimals: e.target.value })} style={inputStyle} />
                  </div>
                </div>
              )}
              {form.resultType === 'enum' && (
                <div>
                  <label style={labelStyle}>Allowed Values (comma-separated)</label>
                  <input value={form.allowedValues} onChange={(e) => setForm({ ...form, allowedValues: e.target.value })} style={inputStyle} placeholder="positive, negative, borderline" />
                </div>
              )}
              <div>
                <label style={labelStyle}>LOINC Code</label>
                <input value={form.loincCode} onChange={(e) => setForm({ ...form, loincCode: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Default Value</label>
                <input value={form.defaultValue} onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} style={inputStyle} placeholder="Pre-fills result entry for this parameter" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="param-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                <label htmlFor="param-active" style={{ fontSize: '14px', color: 'hsl(var(--foreground))', cursor: 'pointer' }}>Active</label>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving}
                style={{ flex: 1, padding: '10px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Parameter'}
              </button>
              <button type="button" onClick={() => setDrawerOpen(false)}
                style={{ padding: '10px 16px', background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Parameters</h1>
        <button onClick={openCreate} style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
          + New Parameter
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          value={search} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, code, user code, LOINC…"
          style={{ width: '320px', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px' }}
        />
      </div>

      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: 'hsl(var(--background))' }}>
            <tr>
              {['User Code', 'Ext ID', 'Name', 'Result Type', 'Default Unit', 'LOINC', 'Status', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading…</td></tr>
            ) : params.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>No parameters found.</td></tr>
            ) : params.map((p: any) => (
              <tr key={p.id} style={{ borderTop: '1px solid hsl(var(--muted))' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{p.userCode ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{p.externalId ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: 'hsl(var(--status-info-bg))', color: 'hsl(var(--primary))' }}>{p.resultType ?? p.dataType}</span>
                </td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{p.defaultUnit ?? p.unit ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '12px' }}>{p.loincCode ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: p.isActive ? 'hsl(var(--status-success-bg))' : 'hsl(var(--status-destructive-bg))', color: p.isActive ? 'hsl(var(--status-success-fg))' : 'hsl(var(--status-destructive-fg))' }}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => openEdit(p)} style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '16px', alignItems: 'center', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
          <button disabled={page <= 1} onClick={() => handlePage(page - 1)}
            style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'default', background: 'hsl(var(--card))', color: page > 1 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
            ← Prev
          </button>
          <span style={{ padding: '0 8px' }}>Page {page} of {totalPages} ({total} total)</span>
          <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)}
            style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'default', background: 'hsl(var(--card))', color: page < totalPages ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
