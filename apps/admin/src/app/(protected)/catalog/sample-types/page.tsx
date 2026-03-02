'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { DataTable } from '@vexel/ui-system';

const emptyForm = () => ({
  name: '', externalId: '', userCode: '', description: '', isActive: true,
});

export default function SampleTypesPage() {
  const [items, setItems] = useState<any[]>([]);
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
    const res = await api.GET('/catalog/sample-types' as any, { params: { query: { search: s || undefined, page: p, limit: LIMIT } } });
    setItems((res.data as any)?.data ?? []);
    setTotal((res.data as any)?.pagination?.total ?? (res.data as any)?.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, []);

  async function openCreate() {
    setEditingId(null); setForm(emptyForm()); setError(null); setDrawerOpen(true);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/sample-types/next-id' as any, {});
    const nextId = (res.data as any)?.nextId ?? '';
    setForm((f) => ({ ...f, externalId: nextId }));
  }

  function openEdit(item: any) {
    setEditingId(item.id);
    setForm({
      name: item.name ?? '',
      externalId: item.externalId ?? '',
      userCode: item.userCode ?? '',
      description: item.description ?? '',
      isActive: item.isActive !== false,
    });
    setError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const api = getApiClient(getToken() ?? undefined);
    const body: any = { name: form.name, isActive: form.isActive };
    if (form.externalId) body.externalId = form.externalId;
    if (form.userCode) body.userCode = form.userCode;
    if (form.description) body.description = form.description;

    let res: any;
    if (editingId) {
      res = await api.PATCH('/catalog/sample-types/{id}' as any, { params: { path: { id: editingId } }, body });
    } else {
      res = await api.POST('/catalog/sample-types' as any, { body });
    }
    if (res.error) { setError(res.error?.message ?? 'Failed'); setSaving(false); return; }
    setDrawerOpen(false); setSaving(false);
    await load(page, search);
  }

  function handleSearch(val: string) { setSearch(val); setPage(1); load(1, val); }
  function handlePage(p: number) { setPage(p); load(p, search); }
  const totalPages = Math.ceil(total / LIMIT);
  const columns = [
    {
      key: 'userCode',
      header: 'User Code',
      cell: (item: any) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.userCode ?? '—'}</span>,
    },
    {
      key: 'externalId',
      header: 'Ext ID',
      cell: (item: any) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{item.externalId ?? '—'}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      cell: (item: any) => <span style={{ fontWeight: 500 }}>{item.name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      cell: (item: any) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{item.description ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: any) => (
        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: item.isActive ? 'hsl(var(--status-success-bg))' : 'hsl(var(--status-destructive-bg))', color: item.isActive ? 'hsl(var(--status-success-fg))' : 'hsl(var(--status-destructive-fg))' }}>
          {item.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (item: any) => (
        <button onClick={() => openEdit(item)} style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
      ),
    },
  ];

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' };

  return (
    <div>
      {drawerOpen && <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.3)', zIndex: 40 }} onClick={() => setDrawerOpen(false)} />}
      {drawerOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'hsl(var(--card))', zIndex: 50, boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{editingId ? 'Edit Sample Type' : 'New Sample Type'}</h2>
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
                  <label style={labelStyle}>Sample Type ID</label>
                  <input value={form.externalId} readOnly style={{ ...inputStyle, background: 'hsl(var(--background))', color: 'hsl(var(--muted-foreground))' }} />
                </div>
                <div>
                  <label style={labelStyle}>User Code</label>
                  <input value={form.userCode} onChange={(e) => setForm({ ...form, userCode: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="sample-type-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                <label htmlFor="sample-type-active" style={{ fontSize: '14px', color: 'hsl(var(--foreground))', cursor: 'pointer' }}>Active</label>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving} style={{ flex: 1, padding: '10px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Sample Type'}
              </button>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ padding: '10px 16px', background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Sample Types</h1>
        <button onClick={openCreate} style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
          + New Sample Type
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Search by name, external ID or user code…" style={{ width: '320px', padding: '8px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px' }} />
      </div>

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(item: any) => `${item.id}`}
        loading={loading}
        emptyMessage="No sample types found."
        className="shadow-sm"
      />

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '16px', alignItems: 'center', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
          <button disabled={page <= 1} onClick={() => handlePage(page - 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'default', background: 'hsl(var(--card))', color: page > 1 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>← Prev</button>
          <span style={{ padding: '0 8px' }}>Page {page} of {totalPages} ({total} total)</span>
          <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'default', background: 'hsl(var(--card))', color: page < totalPages ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>Next →</button>
        </div>
      )}
    </div>
  );
}
