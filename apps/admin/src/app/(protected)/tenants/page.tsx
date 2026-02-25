'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import Link from 'next/link';

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', domains: '' });
  const [editTenant, setEditTenant] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', domains: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadData() {
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/tenants');
    setTenants(data?.data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const api = getApiClient(getToken() ?? undefined);
    await api.POST('/tenants', {
      body: { name: form.name, domains: form.domains.split(',').map((d) => d.trim()).filter(Boolean) },
    });
    setShowCreate(false);
    setForm({ name: '', domains: '' });
    loadData();
  }

  function openEdit(t: any) {
    setEditTenant(t);
    const domainStr = (t.domains ?? []).map((d: any) => d.domain ?? d).join(', ');
    setEditForm({ name: t.name ?? '', domains: domainStr });
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTenant) return;
    setEditSaving(true);
    const api = getApiClient(getToken() ?? undefined);
    await api.PATCH('/tenants/{tenantId}' as any, {
      params: { path: { tenantId: editTenant.id } },
      body: { name: editForm.name, domains: editForm.domains.split(',').map((d) => d.trim()).filter(Boolean) },
    });
    setEditTenant(null); setEditSaving(false);
    loadData();
  }

  async function handleStatusToggle(tenantId: string, currentStatus: string) {
    setTogglingId(tenantId);
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const api = getApiClient(getToken() ?? undefined);
    await api.PATCH('/tenants/{tenantId}' as any, {
      params: { path: { tenantId } },
      body: { status: newStatus },
    });
    setTogglingId(null);
    loadData();
  }

  if (loading) return <p style={{ padding: '32px' }}>Loading...</p>;

  return (
    <div>
      {/* Edit drawer */}
      {editTenant && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'hsl(var(--foreground) / 0.3)', zIndex: 40 }} onClick={() => setEditTenant(null)} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: 'hsl(var(--card))', zIndex: 50, boxShadow: 'var(--shadow-lg)', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Edit Tenant</h2>
              <button onClick={() => setEditTenant(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}>×</button>
            </div>
            <form onSubmit={handleEditSave} style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Domains (comma-separated)</label>
                <input value={editForm.domains} onChange={(e) => setEditForm({ ...editForm, domains: e.target.value })} placeholder="clinic.example.com, app.example.com" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={editSaving} style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>{editSaving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => setEditTenant(null)} style={{ padding: '8px 16px', background: 'hsl(var(--muted))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              </div>
            </form>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Tenants</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>+ New Tenant</button>
      </div>

      {showCreate && (
        <div style={{ background: 'hsl(var(--card))', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Create Tenant</h2>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '12px', maxWidth: '500px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Domains (comma-separated)</label>
              <input value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} placeholder="clinic.example.com, app.example.com" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" style={{ padding: '8px 16px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Create</button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', background: 'hsl(var(--muted))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px' }}>
        {tenants.length === 0 ? <p style={{ color: 'hsl(var(--muted-foreground))' }}>No tenants found.</p> : tenants.map((t: any) => (
          <div key={t.id} style={{ background: 'hsl(var(--card))', padding: '16px 20px', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '4px' }}>{t.name}</p>
                <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '8px' }}>{(t.domains ?? []).map((d: any) => d.domain ?? d).join(', ') || 'No domains'}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link href={`/branding?tenantId=${t.id}`} style={{ fontSize: '12px', color: 'hsl(var(--primary))', textDecoration: 'none', padding: '3px 8px', background: 'hsl(var(--status-info-bg))', borderRadius: '4px', border: '1px solid hsl(var(--status-info-border))' }}>🎨 Branding</Link>
                  <Link href={`/feature-flags?tenantId=${t.id}`} style={{ fontSize: '12px', color: 'hsl(var(--primary))', textDecoration: 'none', padding: '3px 8px', background: 'hsl(var(--status-info-bg))', borderRadius: '4px', border: '1px solid hsl(var(--status-info-border))' }}>🚩 Feature Flags</Link>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: t.status === 'active' ? 'hsl(var(--status-success-bg))' : 'hsl(var(--status-warning-bg))', color: t.status === 'active' ? 'hsl(var(--status-success-fg))' : 'hsl(var(--status-warning-fg))' }}>{t.status}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => openEdit(t)} style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleStatusToggle(t.id, t.status)} disabled={togglingId === t.id}
                    style={{ padding: '4px 10px', fontSize: '12px', background: t.status === 'active' ? 'hsl(var(--status-destructive-bg))' : 'hsl(var(--status-success-bg))', color: t.status === 'active' ? 'hsl(var(--status-destructive-fg))' : 'hsl(var(--status-success-fg))', border: `1px solid ${t.status === 'active' ? 'hsl(var(--status-destructive-border))' : 'hsl(var(--status-success-border))'}`, borderRadius: '4px', cursor: 'pointer' }}>
                    {togglingId === t.id ? '...' : t.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
