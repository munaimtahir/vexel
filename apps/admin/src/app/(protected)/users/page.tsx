'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '' });

  async function loadData() {
    const api = getApiClient(getToken() ?? undefined);
    const [usersRes, rolesRes] = await Promise.allSettled([
      api.GET('/users'),
      api.GET('/roles'),
    ]);
    if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data?.data ?? []);
    if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setError('');
    const api = getApiClient(getToken() ?? undefined);
    const { error: err } = await api.POST('/users', { body: form });
    if (err) { setError('Failed to create user'); setCreating(false); return; }
    setShowCreate(false); setForm({ email: '', firstName: '', lastName: '', password: '' });
    loadData();
    setCreating(false);
  }

  async function handleDisable(userId: string) {
    const api = getApiClient(getToken() ?? undefined);
    await api.PATCH(`/users/${userId}` as any, { body: { status: 'disabled' } });
    loadData();
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Users</h1>
        <button onClick={() => setShowCreate(true)} style={{
          padding: '8px 16px', background: '#3b82f6', color: 'white',
          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
        }}>+ New User</button>
      </div>

      {showCreate && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Create User</h2>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {(['email', 'firstName', 'lastName', 'password'] as const).map((field) => (
              <div key={field}>
                <label htmlFor={`user-${field}`} style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', textTransform: 'capitalize' }}>{field}</label>
                <input
                  id={`user-${field}`}
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {error && <p style={{ color: '#ef4444', fontSize: '13px', gridColumn: '1/-1' }}>{error}</p>}
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={creating} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              {['Name', 'Email', 'Status', 'Roles', 'Actions'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No users found</td></tr>
            ) : users.map((u: any) => (
              <tr key={u.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px' }}>{u.firstName} {u.lastName}</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '12px', fontSize: '12px',
                    background: u.status === 'active' ? '#dcfce7' : '#fee2e2',
                    color: u.status === 'active' ? '#166534' : '#991b1b',
                  }}>{u.status}</span>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                  {(u.roles ?? []).join(', ') || '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {u.status === 'active' && (
                    <button onClick={() => handleDisable(u.id)} style={{
                      padding: '4px 10px', fontSize: '12px', background: '#fef2f2', color: '#dc2626',
                      border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer',
                    }}>Disable</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
