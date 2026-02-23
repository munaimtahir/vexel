'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const DOC_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  QUEUED: { bg: '#fef9c3', text: '#854d0e' },
  RENDERING: { bg: '#dbeafe', text: '#1d4ed8' },
  RENDERED: { bg: '#dcfce7', text: '#166534' },
  PUBLISHED: { bg: '#d1fae5', text: '#065f46' },
  FAILED: { bg: '#fee2e2', text: '#991b1b' },
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const LIMIT = 25;

  async function load(p = 1, status = '') {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const query: any = { page: p, limit: LIMIT };
    if (status) query.status = status;
    const res = await api.GET('/documents' as any, { params: { query } });
    setDocuments((res.data as any)?.data ?? []);
    setTotal((res.data as any)?.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleRepublish(docId: string) {
    setPublishing(docId); setMsg(null);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.POST('/documents/{id}:publish' as any, { params: { path: { id: docId } } });
    if ((res as any).error) {
      setMsg({ type: 'err', text: (res as any).error?.message ?? 'Failed to re-publish' });
    } else {
      setMsg({ type: 'ok', text: 'Document queued for re-publishing.' });
    }
    setPublishing(null);
    setTimeout(() => load(page, statusFilter), 1000);
  }

  function handlePage(p: number) { setPage(p); load(p, statusFilter); }
  function handleStatus(s: string) { setStatusFilter(s); setPage(1); load(1, s); }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Documents</h1>
        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Read-only — re-publish failed docs from here</span>
      </div>

      {msg && (
        <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2', color: msg.type === 'ok' ? '#166534' : '#991b1b' }}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.6 }}>✕</button>
        </div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', color: '#64748b' }}>Status:</label>
        <select value={statusFilter} onChange={(e) => handleStatus(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}>
          <option value="">All statuses</option>
          {Object.keys(DOC_STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{total} total</span>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              {['ID', 'Type', 'Status', 'Encounter', 'Template Ver', 'Tenant', 'Created', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
            ) : documents.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No documents found.</td></tr>
            ) : documents.map((d: any) => {
              const colors = DOC_STATUS_COLORS[d.status] ?? { bg: '#f1f5f9', text: '#475569' };
              return (
                <tr key={d.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{d.id?.slice(0, 12)}…</td>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{d.type ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{d.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>{d.encounterId?.slice(0, 8) ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px' }}>{d.templateVersion ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>{d.tenantId?.slice(0, 8) ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px' }}>{d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {d.status === 'FAILED' && (
                      <button onClick={() => handleRepublish(d.id)} disabled={publishing === d.id}
                        style={{ padding: '4px 10px', fontSize: '12px', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {publishing === d.id ? '...' : 'Re-publish'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', alignItems: 'center', fontSize: '13px', color: '#64748b' }}>
          <button disabled={page <= 1} onClick={() => handlePage(page - 1)} style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'default', background: 'white' }}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)} style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'default', background: 'white' }}>Next →</button>
        </div>
      )}
    </div>
  );
}
