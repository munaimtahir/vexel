'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  REGISTERED: { bg: '#dbeafe', text: '#1d4ed8' },
  SAMPLE_COLLECTED: { bg: '#ede9fe', text: '#6d28d9' },
  IN_PROGRESS: { bg: '#fef9c3', text: '#854d0e' },
  RESULTED: { bg: '#dcfce7', text: '#166534' },
  VERIFIED: { bg: '#d1fae5', text: '#065f46' },
  PUBLISHED: { bg: '#f0fdf4', text: '#15803d' },
  CANCELLED: { bg: '#f1f5f9', text: '#64748b' },
};

export default function EncountersPage() {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const LIMIT = 25;

  async function load(p = 1, status = '') {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const query: any = { page: p, limit: LIMIT };
    if (status) query.status = status;
    const res = await api.GET('/encounters' as any, { params: { query } });
    setEncounters((res.data as any)?.data ?? []);
    setTotal((res.data as any)?.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handlePage(p: number) { setPage(p); load(p, statusFilter); }
  function handleStatus(s: string) { setStatusFilter(s); setPage(1); load(1, s); }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Encounters</h1>
        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Read-only — manage via Operator app</span>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', color: '#64748b' }}>Status:</label>
        <select value={statusFilter} onChange={(e) => handleStatus(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{total} total</span>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              {['Ref #', 'Patient', 'Status', 'Source', 'Ordered Tests', 'Tenant', 'Created'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
            ) : encounters.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No encounters found.</td></tr>
            ) : encounters.map((e: any) => {
              const colors = STATUS_COLORS[e.status] ?? { bg: '#f1f5f9', text: '#475569' };
              return (
                <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>{e.refNumber ?? e.id?.slice(0, 8)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {e.patient ? `${e.patient.firstName ?? ''} ${e.patient.lastName ?? ''}`.trim() || e.patientId?.slice(0, 8) : e.patientId?.slice(0, 8) ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{e.status?.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px' }}>{e.source ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
                    {Array.isArray(e.orders) ? e.orders.length : (e.orderCount ?? '—')}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>{e.tenantId?.slice(0, 8) ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px' }}>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</td>
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
