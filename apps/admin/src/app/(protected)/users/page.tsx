'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' };
const btnSecondary: React.CSSProperties = { padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' };

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create drawer
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', firstName: '', lastName: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit drawer
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Role assignment drawer
  const [roleUser, setRoleUser] = useState<any | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [roleSaving, setRoleSaving] = useState(false);

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
    setCreating(true); setCreateError('');
    const api = getApiClient(getToken() ?? undefined);
    const { error: err } = await api.POST('/users', { body: createForm });
    if (err) { setCreateError((err as any)?.message ?? 'Failed to create user'); setCreating(false); return; }
    setCreateOpen(false); setCreateForm({ email: '', firstName: '', lastName: '', password: '' });
    loadData(); setCreating(false);
  }

  async function handleStatusToggle(userId: string, currentStatus: string) {
    const api = getApiClient(getToken() ?? undefined);
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    await api.PATCH('/users/{userId}' as any, { params: { path: { userId } }, body: { status: newStatus } });
    loadData();
  }

  async function openEdit(u: any) {
    setEditUser(u);
    setEditForm({ firstName: u.firstName ?? '', lastName: u.lastName ?? '' });
    setEditError('');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true); setEditError('');
    const api = getApiClient(getToken() ?? undefined);
    const { error: err } = await api.PATCH('/users/{userId}' as any, { params: { path: { userId: editUser.id } }, body: editForm });
    if (err) { setEditError((err as any)?.message ?? 'Failed'); setEditSaving(false); return; }
    setEditUser(null); setEditSaving(false);
    loadData();
  }

  async function openRoles(u: any) {
    setRoleUser(u);
    // Fetch current roles for this user
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/users/{userId}/roles' as any, { params: { path: { userId: u.id } } });
    const assigned: any[] = (res.data as any) ?? [];
    setUserRoles(assigned.map((r: any) => r.id ?? r));
  }

  function toggleRoleAssignment(roleId: string) {
    setUserRoles((prev) => prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]);
  }

  async function handleRoleSave() {
    if (!roleUser) return;
    setRoleSaving(true);
    const api = getApiClient(getToken() ?? undefined);
    await api.PUT('/users/{userId}/roles' as any, { params: { path: { userId: roleUser.id } }, body: { roleIds: userRoles } });
    setRoleUser(null); setRoleSaving(false);
    loadData();
  }

  if (loading) return <p style={{ padding: '32px' }}>Loading...</p>;

  return (
    <div>
      {/* Edit drawer */}
      {editUser && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} onClick={() => setEditUser(null)} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px', background: 'white', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>Edit User</h2>
              <button onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>
            <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {editError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>{editError}</div>}
              <div>
                <label style={labelStyle}>First Name</label>
                <input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="submit" disabled={editSaving} style={btnPrimary}>{editSaving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => setEditUser(null)} style={btnSecondary}>Cancel</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Role assignment drawer */}
      {roleUser && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} onClick={() => setRoleUser(null)} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: 'white', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>Assign Roles</h2>
              <button onClick={() => setRoleUser(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>{roleUser.email}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {roles.map((r: any) => (
                <label key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', border: `1px solid ${userRoles.includes(r.id) ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: '6px', cursor: 'pointer', background: userRoles.includes(r.id) ? '#eff6ff' : 'white' }}>
                  <input type="checkbox" checked={userRoles.includes(r.id)} onChange={() => toggleRoleAssignment(r.id)} style={{ marginTop: '2px', width: '15px', height: '15px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{r.name}</div>
                    {r.description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{r.description}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                      {(r.permissions ?? []).slice(0, 5).map((p: string) => (
                        <code key={p} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', color: '#475569' }}>{p}</code>
                      ))}
                      {(r.permissions ?? []).length > 5 && <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', color: '#94a3b8' }}>+{(r.permissions ?? []).length - 5}</code>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleRoleSave} disabled={roleSaving} style={btnPrimary}>{roleSaving ? 'Saving...' : 'Save Roles'}</button>
              <button onClick={() => setRoleUser(null)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Users</h1>
        <button onClick={() => setCreateOpen(true)} style={{ ...btnPrimary, fontSize: '14px' }}>+ New User</button>
      </div>

      {createOpen && (
        <div style={{ background: 'white', padding: '24px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Create User</h2>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {(['email', 'firstName', 'lastName', 'password'] as const).map((field) => (
              <div key={field}>
                <label htmlFor={`create-${field}`} style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px', textTransform: 'capitalize' }}>{field}</label>
                <input
                  id={`create-${field}`}
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={createForm[field]}
                  onChange={(e) => setCreateForm({ ...createForm, [field]: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>
            ))}
            {createError && <p style={{ color: '#ef4444', fontSize: '13px', gridColumn: '1/-1' }}>{createError}</p>}
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={creating} style={btnPrimary}>{creating ? 'Creating...' : 'Create'}</button>
              <button type="button" onClick={() => setCreateOpen(false)} style={btnSecondary}>Cancel</button>
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
            ) : users.map((u: any) => {
              const roleNames = (u.roles ?? []).map((r: any) => typeof r === 'string' ? r : r.name).filter(Boolean);
              return (
                <tr key={u.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{u.firstName} {u.lastName}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: u.status === 'active' ? '#dcfce7' : '#fee2e2', color: u.status === 'active' ? '#166534' : '#991b1b' }}>{u.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {roleNames.length === 0 ? <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span> : roleNames.map((n: string) => (
                        <span key={n} style={{ background: '#ede9fe', color: '#6d28d9', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>{n}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openEdit(u)} style={{ padding: '4px 10px', fontSize: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => openRoles(u)} style={{ padding: '4px 10px', fontSize: '12px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: '4px', cursor: 'pointer' }}>Roles</button>
                      <button onClick={() => handleStatusToggle(u.id, u.status)} style={{ padding: '4px 10px', fontSize: '12px', background: u.status === 'active' ? '#fef2f2' : '#f0fdf4', color: u.status === 'active' ? '#dc2626' : '#16a34a', border: `1px solid ${u.status === 'active' ? '#fecaca' : '#bbf7d0'}`, borderRadius: '4px', cursor: 'pointer' }}>
                        {u.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
