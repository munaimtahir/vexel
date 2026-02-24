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

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' };

  return (
    <div>
      {drawerOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} onClick={() => setDrawerOpen(false)} />}
      {drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'white', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>{editingId ? 'Edit Test' : 'New Test'}</h2>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Test ID <span style={{ color: '#94a3b8', fontWeight: 400 }}>· Auto-generated</span></label>
                  <input value={form.externalId} readOnly style={{ ...inputStyle, background: '#f8fafc', color: '#64748b', cursor: 'default' }} />
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
                <label htmlFor="test-active" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>Active</label>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving}
                style={{ flex: 1, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Test'}
              </button>
              <button type="button" onClick={() => setDrawerOpen(false)}
                style={{ padding: '10px 16px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Catalog Tests</h1>
        <button onClick={openCreate} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
          + New Test
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input value={search} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, code, user code, LOINC…"
          style={{ width: '320px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Tests table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  {['User Code', 'Ext ID', 'Name', 'Price (PKR)', 'Department', 'LOINC', 'Status', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
                ) : tests.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No tests found.</td></tr>
                ) : tests.map((t: any) => (
                  <tr key={t.id} style={{ borderTop: '1px solid #f1f5f9', background: selectedTest?.id === t.id ? '#eff6ff' : undefined, cursor: 'pointer' }}
                    onClick={() => selectTest(t)}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{t.userCode ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{t.externalId ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: 500 }}>
                      {t.price != null ? t.price.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{t.department ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>{t.loincCode ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: t.isActive ? '#dcfce7' : '#fee2e2', color: t.isActive ? '#166534' : '#991b1b' }}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }} onClick={(e) => { e.stopPropagation(); openEdit(t); }}>
                      <button style={{ padding: '4px 10px', fontSize: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '16px', alignItems: 'center', fontSize: '13px', color: '#64748b' }}>
              <button disabled={page <= 1} onClick={() => handlePage(page - 1)}
                style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'default', background: 'white', color: page > 1 ? '#374151' : '#94a3b8' }}>
                ← Prev
              </button>
              <span style={{ padding: '0 8px' }}>Page {page} of {totalPages} ({total} total)</span>
              <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)}
                style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'default', background: 'white', color: page < totalPages ? '#374151' : '#94a3b8' }}>
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Parameter assignments panel */}
        {selectedTest && (
          <div style={{ width: '340px', flexShrink: 0, background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Parameter Assignments</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{selectedTest.name}</div>
              </div>
              <button onClick={() => setSelectedTest(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            {paramLoading ? (
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>Loading…</p>
            ) : testParams.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>No parameters assigned.</p>
            ) : (
              <div style={{ marginBottom: '12px' }}>
                {[...testParams]
                  .sort((a: any, b: any) => (a.displayOrder ?? a.ordering ?? 0) - (b.displayOrder ?? b.ordering ?? 0))
                  .map((tp: any, idx: number, arr: any[]) => (
                    <div key={tp.parameterId ?? tp.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', width: '18px', flexShrink: 0, textAlign: 'right' }}>{idx + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tp.parameter?.name ?? tp.name ?? tp.parameterId}</div>
                        {tp.parameter?.externalId && <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{tp.parameter.externalId}</div>}
                      </div>
                      {tp.isRequired && <span style={{ fontSize: '10px', background: '#fef9c3', color: '#854d0e', padding: '1px 5px', borderRadius: '8px', flexShrink: 0 }}>req</span>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <button onClick={() => reorderParam(tp.parameterId ?? tp.id, 'up')} disabled={idx === 0}
                          style={{ padding: '1px 4px', fontSize: '10px', background: idx === 0 ? '#f1f5f9' : '#e0f2fe', color: idx === 0 ? '#94a3b8' : '#0369a1', border: 'none', borderRadius: '3px', cursor: idx === 0 ? 'default' : 'pointer', lineHeight: 1 }}>↑</button>
                        <button onClick={() => reorderParam(tp.parameterId ?? tp.id, 'down')} disabled={idx === arr.length - 1}
                          style={{ padding: '1px 4px', fontSize: '10px', background: idx === arr.length - 1 ? '#f1f5f9' : '#e0f2fe', color: idx === arr.length - 1 ? '#94a3b8' : '#0369a1', border: 'none', borderRadius: '3px', cursor: idx === arr.length - 1 ? 'default' : 'pointer', lineHeight: 1 }}>↓</button>
                      </div>
                      <button onClick={() => removeParam(tp.parameterId ?? tp.id)}
                        style={{ padding: '2px 7px', fontSize: '11px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}>
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* Add parameter */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setParamPickerOpen(!paramPickerOpen); if (!paramPickerOpen) loadAllParams(); }}
                style={{ width: '100%', padding: '7px', background: '#f0f9ff', border: '1px dashed #bae6fd', borderRadius: '6px', color: '#0369a1', fontSize: '13px', cursor: 'pointer' }}>
                + Add Parameter
              </button>
              {paramPickerOpen && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                  {availableParams.length === 0 ? (
                    <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8' }}>No more parameters available.</div>
                  ) : availableParams.map((p: any) => (
                    <button key={p.id} onClick={() => addParam(p.id)} disabled={addingParam}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      {p.userCode && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{p.userCode}</span>}
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
