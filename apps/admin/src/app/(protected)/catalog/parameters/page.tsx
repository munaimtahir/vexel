'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function ParametersPage() {
  const [params, setParams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', unit: '', dataType: 'numeric' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.GET('/catalog/parameters' as any);
    setParams((res.data as any)?.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const api = getApiClient(getToken() ?? undefined);
    const body: any = { code: form.code, name: form.name, dataType: form.dataType };
    if (form.unit) body.unit = form.unit;
    const res = await api.POST('/catalog/parameters' as any, { body });
    if ((res as any).error) { setError((res as any).error?.message ?? 'Failed'); setSaving(false); return; }
    setForm({ code: '', name: '', unit: '', dataType: 'numeric' });
    setShowForm(false); setSaving(false);
    await load();
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Parameters</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
          {showForm ? 'Cancel' : '+ New Parameter'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Create Parameter</h2>
          {error && <p style={{ color: '#dc2626', marginBottom: '12px', fontSize: '13px' }}>{error}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {[['Code *', 'code'], ['Name *', 'name'], ['Unit', 'unit']].map(([label, key]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{label}</label>
                <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={label.includes('*')}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Data Type</label>
              <select value={form.dataType} onChange={(e) => setForm({ ...form, dataType: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}>
                {['numeric', 'text', 'boolean', 'coded'].map((dt) => <option key={dt} value={dt}>{dt}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} style={{ padding: '8px 20px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
            {saving ? 'Saving...' : 'Create'}
          </button>
        </form>
      )}

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              {['Code', 'Name', 'Unit', 'Data Type', 'Active', 'Created'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {params.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No parameters found.</td></tr>
            ) : params.map((p: any) => (
              <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{p.code}</td>
                <td style={{ padding: '10px 12px' }}>{p.name}</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{p.unit ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: '#ede9fe', color: '#6d28d9' }}>{p.dataType}</span></td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: p.isActive ? '#dcfce7' : '#fee2e2', color: p.isActive ? '#166534' : '#991b1b' }}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
