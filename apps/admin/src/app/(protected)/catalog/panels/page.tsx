'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const emptyForm = () => ({
  name: '', externalId: '', userCode: '', loincCode: '', price: '', isActive: true,
});

export default function PanelsPage() {
  const [panels, setPanels] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Selected panel for test assignments
  const [selectedPanel, setSelectedPanel] = useState<any | null>(null);
  const [panelTests, setPanelTests] = useState<any[]>([]);
  const [allTests, setAllTests] = useState<any[]>([]);
  const [testPickerOpen, setTestPickerOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [addingTest, setAddingTest] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/panels' as any, { params: { query: { search: s || undefined, page: p, limit: LIMIT } } });
    setPanels((res.data as any)?.data ?? []);
    setTotal((res.data as any)?.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, []);

  async function loadPanelTests(panelId: string) {
    setTestLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/panels/{panelId}/tests' as any, { params: { path: { panelId } } });
    setPanelTests((res.data as any)?.data ?? (Array.isArray(res.data) ? res.data : []));
    setTestLoading(false);
  }

  async function loadAllTests() {
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/tests' as any, { params: { query: { limit: 200 } } });
    setAllTests((res.data as any)?.data ?? []);
  }

  async function openCreate() {
    setEditingId(null); setForm(emptyForm()); setError(null); setDrawerOpen(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/panels/next-id' as any, {});
    const nextId = (res.data as any)?.nextId ?? '';
    setForm(f => ({ ...f, externalId: nextId }));
  }
  function openEdit(p: any) {
    setEditingId(p.id);
    setForm({
      name: p.name ?? '', externalId: p.externalId ?? '',
      userCode: p.userCode ?? '', loincCode: p.loincCode ?? '', price: p.price != null ? String(p.price) : '', isActive: p.isActive !== false,
    });
    setError(null); setDrawerOpen(true);
  }

  async function selectPanel(p: any) {
    setSelectedPanel(p);
    await Promise.all([loadPanelTests(p.id), loadAllTests()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const api = getApiClient(getToken() ?? undefined);
    const body: any = { name: form.name, isActive: form.isActive };
    if (form.externalId) body.externalId = form.externalId;
    if (form.userCode) body.userCode = form.userCode;
    if (form.loincCode) body.loincCode = form.loincCode;
    if (form.price !== '') body.price = Number(form.price);

    let res: any;
    if (editingId) {
      res = await api.PATCH('/catalog/panels/{id}' as any, { params: { path: { id: editingId } }, body });
    } else {
      res = await api.POST('/catalog/panels' as any, { body });
    }
    if (res.error) { setError(res.error?.message ?? 'Failed'); setSaving(false); return; }
    setDrawerOpen(false); setSaving(false);
    await load(page, search);
  }

  async function addTest(testId: string) {
    if (!selectedPanel) return;
    setAddingTest(true);
    const api = getApiClient(getToken() ?? undefined);
    const maxOrder = panelTests.reduce((m: number, t: any) => Math.max(m, t.displayOrder ?? t.ordering ?? 0), 0);
    await api.POST('/catalog/panels/{panelId}/tests' as any, {
      params: { path: { panelId: selectedPanel.id } },
      body: { testId, ordering: maxOrder + 1 },
    });
    await loadPanelTests(selectedPanel.id);
    setTestPickerOpen(false);
    setAddingTest(false);
  }

  async function removeTest(testId: string) {
    if (!selectedPanel) return;
    const api = getApiClient(getToken() ?? undefined);
    await api.DELETE('/catalog/panels/{panelId}/tests/{testId}' as any, {
      params: { path: { panelId: selectedPanel.id, testId } },
    });
    await loadPanelTests(selectedPanel.id);
  }

  function handleSearch(val: string) { setSearch(val); setPage(1); load(1, val); }
  function handlePage(p: number) { setPage(p); load(p, search); }
  const totalPages = Math.ceil(total / LIMIT);

  const assignedTestIds = new Set(panelTests.map((t: any) => t.testId ?? t.id));
  const availableTests = allTests.filter((t: any) => !assignedTestIds.has(t.id));

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' };

  return (
    <div>
      {drawerOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} onClick={() => setDrawerOpen(false)} />}
      {drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'white', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>{editingId ? 'Edit Panel' : 'New Panel'}</h2>
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
                  <label style={labelStyle}>Panel ID <span style={{ color: '#94a3b8', fontWeight: 400 }}>· Auto-generated</span></label>
                  <input value={form.externalId} readOnly style={{ ...inputStyle, background: '#f8fafc', color: '#64748b', cursor: 'default' }} />
                </div>
                <div>
                  <label style={labelStyle}>User Code</label>
                  <input value={form.userCode} onChange={(e) => setForm({ ...form, userCode: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <input type="checkbox" id="panel-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                <label htmlFor="panel-active" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>Active</label>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving}
                style={{ flex: 1, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Panel'}
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
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Panels</h1>
        <button onClick={openCreate} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
          + New Panel
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input value={search} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, code, user code, LOINC…"
          style={{ width: '320px', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Panels table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  {['User Code', 'Ext ID', 'Name', 'Price (PKR)', 'LOINC', 'Status', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
                ) : panels.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No panels found.</td></tr>
                ) : panels.map((p: any) => (
                  <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9', background: selectedPanel?.id === p.id ? '#eff6ff' : undefined, cursor: 'pointer' }}
                    onClick={() => selectPanel(p)}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{p.userCode ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{p.externalId ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: 500 }}>
                      {p.price != null ? p.price.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>{p.loincCode ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: p.isActive ? '#dcfce7' : '#fee2e2', color: p.isActive ? '#166534' : '#991b1b' }}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }} onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
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

        {/* Test assignments panel */}
        {selectedPanel && (
          <div style={{ width: '340px', flexShrink: 0, background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Test Assignments</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{selectedPanel.name}</div>
              </div>
              <button onClick={() => setSelectedPanel(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            {testLoading ? (
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>Loading…</p>
            ) : panelTests.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>No tests assigned.</p>
            ) : (
              <div style={{ marginBottom: '12px' }}>
                {panelTests
                  .slice()
                  .sort((a: any, b: any) => (a.displayOrder ?? a.ordering ?? 0) - (b.displayOrder ?? b.ordering ?? 0))
                  .map((pt: any) => (
                    <div key={pt.testId ?? pt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', width: '20px', flexShrink: 0, textAlign: 'right' }}>#{pt.displayOrder ?? pt.ordering ?? '—'}</span>
                      <span style={{ flex: 1, fontSize: '13px', color: '#1e293b' }}>{pt.test?.name ?? pt.name ?? pt.testId}</span>
                      <button onClick={() => removeTest(pt.testId ?? pt.id)}
                        style={{ padding: '2px 7px', fontSize: '11px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <button onClick={() => { setTestPickerOpen(!testPickerOpen); if (!testPickerOpen) loadAllTests(); }}
                style={{ width: '100%', padding: '7px', background: '#f0f9ff', border: '1px dashed #bae6fd', borderRadius: '6px', color: '#0369a1', fontSize: '13px', cursor: 'pointer' }}>
                + Add Test
              </button>
              {testPickerOpen && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                  {availableTests.length === 0 ? (
                    <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8' }}>No more tests available.</div>
                  ) : availableTests.map((t: any) => (
                    <button key={t.id} onClick={() => addTest(t.id)} disabled={addingTest}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontWeight: 500 }}>{t.name}</span>
                      {t.userCode && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{t.userCode}</span>}
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
