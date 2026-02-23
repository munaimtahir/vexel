'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' };

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', permissions: [] as string[] });
  const [editRole, setEditRole] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', permissions: [] as string[] });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  function togglePerm(p: string, current: string[], setter: (v: string[]) => void) {
    setter(current.includes(p) ? current.filter((x) => x !== p) : [...current, p]);
  }

  function openEdit(r: any) {
    setEditRole(r);
    setEditForm({ name: r.name ?? '', description: r.description ?? '', permissions: r.permissions ?? [] });
    setEditError('');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editRole) return;
    setEditSaving(true); setEditError('');
    const api = getApiClient(getToken() ?? undefined);
    const { error: err } = await api.PATCH('/roles/{roleId}' as any, { params: { path: { roleId: editRole.id } }, body: editForm });
    if (err) { setEditError((err as any)?.message ?? 'Failed'); setEditSaving(false); return; }
    setEditRole(null); setEditSaving(false);
    loadData();
  }

  async function handleDelete(roleId: string) {
    setDeleting(true);
    const api = getApiClient(getToken() ?? undefined);
    await api.DELETE('/roles/{roleId}' as any, { params: { path: { roleId } } });
    setDeleteId(null); setDeleting(false);
    loadData();
  }

  if (loading) return <p style={{ padding: '32px' }}>Loading...</p>;

  return (
    <div>
      {/* Edit drawer */}
      {editRole && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} onClick={() => setEditRole(null)} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '440px', background: 'white', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>Edit Role</h2>
              <button onClick={() => setEditRole(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>
            {editError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>{editError}</div>}
            <form onSubmit={handleEditSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} disabled={editRole.isSystem} />
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...labelStyle, marginBottom: '8px' }}>Permissions</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {permissions.map((p) => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      <input type="checkbox" checked={editForm.permissions.includes(p)} onChange={() => togglePerm(p, editForm.permissions, (v) => setEditForm({ ...editForm, permissions: v }))} />
                      <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{p}</code>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={editSaving} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>{editSaving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => setEditRole(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '90%' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>Delete Role?</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>This will remove the role and unassign it from all users. This cannot be undone.</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleDelete(deleteId)} disabled={deleting} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>{deleting ? 'Deleting...' : 'Delete'}</button>
                <button onClick={() => setDeleteId(null)} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}

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
                <label style={labelStyle}>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...labelStyle, marginBottom: '8px' }}>Permissions</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {permissions.map((p) => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p, form.permissions, (v) => setForm({ ...form, permissions: v }))} />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  {r.isSystem && <span style={{ fontSize: '11px', background: '#ede9fe', color: '#6d28d9', padding: '2px 6px', borderRadius: '4px' }}>system</span>}
                </div>
                {r.description && <p style={{ color: '#64748b', fontSize: '13px', margin: '2px 0 0' }}>{r.description}</p>}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => openEdit(r)} style={{ padding: '4px 10px', fontSize: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                {!r.isSystem && (
                  <button onClick={() => setDeleteId(r.id)} style={{ padding: '4px 10px', fontSize: '12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                )}
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
