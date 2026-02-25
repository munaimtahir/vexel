'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const emptyForm = () => ({
  name: '', externalId: '', userCode: '', loincCode: '',
  department: '', specimenType: '', method: '', price: '', isActive: true,
});

export default function CatalogTestsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Selected test for parameter assignments
  const [selectedTest, setSelectedTest] = useState<any | null>(null);
  const [testParams, setTestParams] = useState<any[]>([]);
  const [allParams, setAllParams] = useState<any[]>([]);
  const [paramPickerOpen, setParamPickerOpen] = useState(false);
  const [paramLoading, setParamLoading] = useState(false);
  const [addingParam, setAddingParam] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/tests' as any, { params: { query: { search: s || undefined, page: p, limit: LIMIT } } });
    setTests((res.data as any)?.data ?? []);
    setTotal((res.data as any)?.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, []);

  async function loadTestParams(testId: string) {
    setParamLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/tests/{testId}/parameters' as any, { params: { path: { testId } } });
    setTestParams((res.data as any)?.data ?? (Array.isArray(res.data) ? res.data : []));
    setParamLoading(false);
  }

  async function loadAllParams() {
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/parameters' as any, { params: { query: { limit: 200 } } });
    setAllParams((res.data as any)?.data ?? []);
  }

  async function openCreate() {
    setEditingId(null); setForm(emptyForm()); setError(null); setDrawerOpen(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/tests/next-id' as any, {});
    const nextId = (res.data as any)?.nextId ?? '';
    setForm(f => ({ ...f, externalId: nextId }));
  }
  function openEdit(t: any) {
    setEditingId(t.id);
    setForm({
      name: t.name ?? '', externalId: t.externalId ?? '',
      userCode: t.userCode ?? '', loincCode: t.loincCode ?? '',
      department: t.department ?? '', specimenType: t.specimenType ?? '',
      method: t.method ?? '', price: t.price != null ? String(t.price) : '', isActive: t.isActive !== false,
    });
    setError(null); setDrawerOpen(true);
  }

  async function selectTest(t: any) {
    setSelectedTest(t);
    await Promise.all([loadTestParams(t.id), loadAllParams()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const api = getApiClient(getToken() ?? undefined);
    const body: any = { name: form.name, isActive: form.isActive };
    if (form.externalId) body.externalId = form.externalId;
    if (form.userCode) body.userCode = form.userCode;
    if (form.loincCode) body.loincCode = form.loincCode;
    if (form.department) body.department = form.department;
    if (form.specimenType) body.specimenType = form.specimenType;
    if (form.method) body.method = form.method;
    if (form.price !== '') body.price = Number(form.price);

    let res: any;
    if (editingId) {
      res = await api.PATCH('/catalog/tests/{id}' as any, { params: { path: { id: editingId } }, body });
    } else {
      res = await api.POST('/catalog/tests' as any, { body });
    }
    if (res.error) { setError(res.error?.message ?? 'Failed'); setSaving(false); return; }
    setDrawerOpen(false); setSaving(false);
    await load(page, search);
    if (selectedTest && selectedTest.id === editingId && res.data) {
      setSelectedTest(res.data);
    }
  }

  async function addParam(parameterId: string) {
    if (!selectedTest) return;
    setAddingParam(true);
    const api = getApiClient(getToken() ?? undefined);
    const maxOrder = testParams.reduce((m: number, p: any) => Math.max(m, p.displayOrder ?? p.ordering ?? 0), 0);
    await api.POST('/catalog/tests/{testId}/parameters' as any, {
      params: { path: { testId: selectedTest.id } },
      body: { parameterId, ordering: maxOrder + 1 },
    });
    await loadTestParams(selectedTest.id);
    setParamPickerOpen(false);
    setAddingParam(false);
  }

  async function removeParam(parameterId: string) {
    if (!selectedTest) return;
    const api = getApiClient(getToken() ?? undefined);
    await api.DELETE('/catalog/tests/{testId}/parameters/{parameterId}' as any, {
      params: { path: { testId: selectedTest.id, parameterId } },
    });
    await loadTestParams(selectedTest.id);
  }

  async function reorderParam(parameterId: string, direction: 'up' | 'down') {
    if (!selectedTest) return;
    const sorted = [...testParams].sort((a: any, b: any) => (a.displayOrder ?? a.ordering ?? 0) - (b.displayOrder ?? b.ordering ?? 0));
    const idx = sorted.findIndex((p: any) => (p.parameterId ?? p.id) === parameterId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const curr = sorted[idx];
    const swap = sorted[swapIdx];
    const currOrder = curr.displayOrder ?? curr.ordering ?? idx + 1;
    const swapOrder = swap.displayOrder ?? swap.ordering ?? swapIdx + 1;
    const api = getApiClient(getToken() ?? undefined);
    await Promise.all([
      api.PATCH('/catalog/tests/{testId}/parameters/{parameterId}' as any, {
        params: { path: { testId: selectedTest.id, parameterId: curr.parameterId ?? curr.id } },
        body: { displayOrder: swapOrder },
      }),
      api.PATCH('/catalog/tests/{testId}/parameters/{parameterId}' as any, {
        params: { path: { testId: selectedTest.id, parameterId: swap.parameterId ?? swap.id } },
        body: { displayOrder: currOrder },
      }),
    ]);
    await loadTestParams(selectedTest.id);
  }

  function handleSearch(val: string) { setSearch(val); setPage(1); load(1, val); }
  function handlePage(p: number) { setPage(p); load(p, search); }
  const totalPages = Math.ceil(total / LIMIT);

  const assignedParamIds = new Set(testParams.map((p: any) => p.parameterId ?? p.id));
  const availableParams = allParams.filter((p: any) => !assignedParamIds.has(p.id));

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' };

  return (
    <div>
      {drawerOpen && <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.3)', zIndex: 40 }} onClick={() => setDrawerOpen(false)} />}
      {drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'hsl(var(--card))', zIndex: 50, boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{editingId ? 'Edit Test' : 'New Test'}</h2>
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
                  <label style={labelStyle}>Test ID <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>· Auto-generated</span></label>
                  <input value={form.externalId} readOnly style={{ ...inputStyle, background: 'hsl(var(--background))', color: 'hsl(var(--muted-foreground))', cursor: 'default' }} />
                </div>
                <div>
                  <label style={labelStyle}>User Code</label>
                  <input value={form.userCode} onChange={(e) => setForm({ ...form, userCode: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Department</label>
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Specimen Type</label>
                  <input value={form.specimenType} onChange={(e) => setForm({ ...form, specimenType: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Method</label>
                  <input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>LOINC Code</label>
                  <input value={form.loincCode} onChange={(e) => setForm({ ...form, loincCode: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Price (PKR)</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="test-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                <label htmlFor="test-active" style={{ fontSize: '14px', color: 'hsl(var(--foreground))', cursor: 'pointer' }}>Active</label>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving}
                style={{ flex: 1, padding: '10px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Test'}
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
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Catalog Tests</h1>
        <button onClick={openCreate} style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
          + New Test
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input value={search} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, code, user code, LOINC…"
          style={{ width: '320px', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px' }} />
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Tests table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: 'hsl(var(--background))' }}>
                <tr>
                  {['User Code', 'Ext ID', 'Name', 'Price (PKR)', 'Department', 'LOINC', 'Status', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading…</td></tr>
                ) : tests.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>No tests found.</td></tr>
                ) : tests.map((t: any) => (
                  <tr key={t.id} style={{ borderTop: '1px solid hsl(var(--muted))', background: selectedTest?.id === t.id ? 'hsl(var(--status-info-bg))' : undefined, cursor: 'pointer' }}
                    onClick={() => selectTest(t)}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{t.userCode ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{t.externalId ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--foreground))', fontWeight: 500 }}>
                      {t.price != null ? t.price.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{t.department ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '12px' }}>{t.loincCode ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: t.isActive ? 'hsl(var(--status-success-bg))' : 'hsl(var(--status-destructive-bg))', color: t.isActive ? 'hsl(var(--status-success-fg))' : 'hsl(var(--status-destructive-fg))' }}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }} onClick={(e) => { e.stopPropagation(); openEdit(t); }}>
                      <button style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

        {/* Parameter assignments panel */}
        {selectedTest && (
          <div style={{ width: '340px', flexShrink: 0, background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Parameter Assignments</div>
                <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginTop: '2px' }}>{selectedTest.name}</div>
              </div>
              <button onClick={() => setSelectedTest(null)} style={{ background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            {paramLoading ? (
              <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>Loading…</p>
            ) : testParams.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '12px' }}>No parameters assigned.</p>
            ) : (
              <div style={{ marginBottom: '12px' }}>
                {[...testParams]
                  .sort((a: any, b: any) => (a.displayOrder ?? a.ordering ?? 0) - (b.displayOrder ?? b.ordering ?? 0))
                  .map((tp: any, idx: number, arr: any[]) => (
                    <div key={tp.parameterId ?? tp.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0', borderBottom: '1px solid hsl(var(--muted))' }}>
                      <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', width: '18px', flexShrink: 0, textAlign: 'right' }}>{idx + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: 'hsl(var(--foreground))', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tp.parameter?.name ?? tp.name ?? tp.parameterId}</div>
                        {tp.parameter?.externalId && <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>{tp.parameter.externalId}</div>}
                      </div>
                      {tp.isRequired && <span style={{ fontSize: '10px', background: 'hsl(var(--status-warning-bg))', color: 'hsl(var(--status-warning-fg))', padding: '1px 5px', borderRadius: '8px', flexShrink: 0 }}>req</span>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <button onClick={() => reorderParam(tp.parameterId ?? tp.id, 'up')} disabled={idx === 0}
                          style={{ padding: '1px 4px', fontSize: '10px', background: idx === 0 ? 'hsl(var(--muted))' : 'hsl(var(--status-info-bg))', color: idx === 0 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))', border: 'none', borderRadius: '3px', cursor: idx === 0 ? 'default' : 'pointer', lineHeight: 1 }}>↑</button>
                        <button onClick={() => reorderParam(tp.parameterId ?? tp.id, 'down')} disabled={idx === arr.length - 1}
                          style={{ padding: '1px 4px', fontSize: '10px', background: idx === arr.length - 1 ? 'hsl(var(--muted))' : 'hsl(var(--status-info-bg))', color: idx === arr.length - 1 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))', border: 'none', borderRadius: '3px', cursor: idx === arr.length - 1 ? 'default' : 'pointer', lineHeight: 1 }}>↓</button>
                      </div>
                      <button onClick={() => removeParam(tp.parameterId ?? tp.id)}
                        style={{ padding: '2px 7px', fontSize: '11px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', border: 'none', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}>
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* Add parameter */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setParamPickerOpen(!paramPickerOpen); if (!paramPickerOpen) loadAllParams(); }}
                style={{ width: '100%', padding: '7px', background: 'hsl(var(--status-info-bg))', border: '1px dashed hsl(var(--status-info-border))', borderRadius: '6px', color: 'hsl(var(--primary))', fontSize: '13px', cursor: 'pointer' }}>
                + Add Parameter
              </button>
              {paramPickerOpen && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', boxShadow: '0 4px 12px hsl(var(--foreground) / 0.1)', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                  {availableParams.length === 0 ? (
                    <div style={{ padding: '10px', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>No more parameters available.</div>
                  ) : availableParams.map((p: any) => (
                    <button key={p.id} onClick={() => addParam(p.id)} disabled={addingParam}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid hsl(var(--muted))' }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      {p.userCode && <span style={{ marginLeft: '6px', fontSize: '11px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>{p.userCode}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
