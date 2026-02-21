'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', domains: '' });

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

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Tenants</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>+ New Tenant</button>
      </div>

      {showCreate && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Create Tenant</h2>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '12px', maxWidth: '500px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Domains (comma-separated)</label>
              <input value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} placeholder="clinic.example.com, app.example.com"
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Create</button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px' }}>
        {tenants.length === 0 ? <p style={{ color: '#94a3b8' }}>No tenants found.</p> : tenants.map((t: any) => (
          <div key={t.id} style={{ background: 'white', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '4px' }}>{t.name}</p>
                <p style={{ fontSize: '12px', color: '#64748b' }}>{(t.domains ?? []).map((d: any) => d.domain ?? d).join(', ')}</p>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: t.status === 'active' ? '#dcfce7' : '#fef9c3', color: t.status === 'active' ? '#166534' : '#854d0e' }}>{t.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
