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

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' };

  return (
    <div>
      {drawerOpen && <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.3)', zIndex: 40 }} onClick={() => setDrawerOpen(false)} />}
      {drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'hsl(var(--card))', zIndex: 50, boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{editingId ? 'Edit Panel' : 'New Panel'}</h2>
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
                  <label style={labelStyle}>Panel ID <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>· Auto-generated</span></label>
                  <input value={form.externalId} readOnly style={{ ...inputStyle, background: 'hsl(var(--background))', color: 'hsl(var(--muted-foreground))', cursor: 'default' }} />
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
                <label htmlFor="panel-active" style={{ fontSize: '14px', color: 'hsl(var(--foreground))', cursor: 'pointer' }}>Active</label>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving}
                style={{ flex: 1, padding: '10px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Panel'}
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
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Panels</h1>
        <button onClick={openCreate} style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
          + New Panel
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input value={search} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, code, user code, LOINC…"
          style={{ width: '320px', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px' }} />
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Panels table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: 'hsl(var(--background))' }}>
                <tr>
                  {['User Code', 'Ext ID', 'Name', 'Price (PKR)', 'LOINC', 'Status', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading…</td></tr>
                ) : panels.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>No panels found.</td></tr>
                ) : panels.map((p: any) => (
                  <tr key={p.id} style={{ borderTop: '1px solid hsl(var(--muted))', background: selectedPanel?.id === p.id ? 'hsl(var(--status-info-bg))' : undefined, cursor: 'pointer' }}
                    onClick={() => selectPanel(p)}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{p.userCode ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{p.externalId ?? '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--foreground))', fontWeight: 500 }}>
                      {p.price != null ? p.price.toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '12px' }}>{p.loincCode ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: p.isActive ? 'hsl(var(--status-success-bg))' : 'hsl(var(--status-destructive-bg))', color: p.isActive ? 'hsl(var(--status-success-fg))' : 'hsl(var(--status-destructive-fg))' }}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }} onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
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

        {/* Test assignments panel */}
        {selectedPanel && (
          <div style={{ width: '340px', flexShrink: 0, background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Test Assignments</div>
                <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginTop: '2px' }}>{selectedPanel.name}</div>
              </div>
              <button onClick={() => setSelectedPanel(null)} style={{ background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            {testLoading ? (
              <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>Loading…</p>
            ) : panelTests.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '12px' }}>No tests assigned.</p>
            ) : (
              <div style={{ marginBottom: '12px' }}>
                {panelTests
                  .slice()
                  .sort((a: any, b: any) => (a.displayOrder ?? a.ordering ?? 0) - (b.displayOrder ?? b.ordering ?? 0))
                  .map((pt: any) => (
                    <div key={pt.testId ?? pt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid hsl(var(--muted))' }}>
                      <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', width: '20px', flexShrink: 0, textAlign: 'right' }}>#{pt.displayOrder ?? pt.ordering ?? '—'}</span>
                      <span style={{ flex: 1, fontSize: '13px', color: 'hsl(var(--foreground))' }}>{pt.test?.name ?? pt.name ?? pt.testId}</span>
                      <button onClick={() => removeTest(pt.testId ?? pt.id)}
                        style={{ padding: '2px 7px', fontSize: '11px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <button onClick={() => { setTestPickerOpen(!testPickerOpen); if (!testPickerOpen) loadAllTests(); }}
                style={{ width: '100%', padding: '7px', background: 'hsl(var(--status-info-bg))', border: '1px dashed hsl(var(--status-info-border))', borderRadius: '6px', color: 'hsl(var(--primary))', fontSize: '13px', cursor: 'pointer' }}>
                + Add Test
              </button>
              {testPickerOpen && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', boxShadow: '0 4px 12px hsl(var(--foreground) / 0.1)', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                  {availableTests.length === 0 ? (
                    <div style={{ padding: '10px', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>No more tests available.</div>
                  ) : availableTests.map((t: any) => (
                    <button key={t.id} onClick={() => addTest(t.id)} disabled={addingTest}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid hsl(var(--muted))' }}>
                      <span style={{ fontWeight: 500 }}>{t.name}</span>
                      {t.userCode && <span style={{ marginLeft: '6px', fontSize: '11px', color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>{t.userCode}</span>}
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
