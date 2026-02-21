'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', permissions: [] as string[] });

  async function loadData() {
    const api = getApiClient(getToken() ?? undefined);
    const [rolesRes, permsRes] = await Promise.allSettled([
      api.GET('/roles'),
      api.GET('/roles/permissions'),
    ]);
    if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.data ?? []);
    if (permsRes.status === 'fulfilled') setPermissions(permsRes.value.data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const api = getApiClient(getToken() ?? undefined);
    await api.POST('/roles', { body: form });
    setShowCreate(false);
    setForm({ name: '', description: '', permissions: [] });
    loadData();
  }

  function togglePerm(p: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }));
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Roles</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>+ New Role</button>
      </div>

      {showCreate && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Create Role</h2>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Permissions</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {permissions.map((p) => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} />
                    <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{p}</code>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Create</button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px' }}>
        {roles.length === 0 ? <p style={{ color: '#94a3b8' }}>No roles found.</p> : roles.map((r: any) => (
          <div key={r.id} style={{ background: 'white', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                {r.isSystem && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#ede9fe', color: '#6d28d9', padding: '2px 6px', borderRadius: '4px' }}>system</span>}
                {r.description && <p style={{ color: '#64748b', fontSize: '13px', margin: '2px 0 0' }}>{r.description}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {(r.permissions ?? []).map((p: string) => (
                <code key={p} style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#475569' }}>{p}</code>
              ))}
              {(r.permissions ?? []).length === 0 && <span style={{ color: '#94a3b8', fontSize: '13px' }}>No permissions assigned</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
