'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  REGISTERED: { bg: 'hsl(var(--status-info-bg))', text: 'hsl(var(--status-info-fg))' },
  SAMPLE_COLLECTED: { bg: 'hsl(var(--status-info-bg))', text: 'hsl(var(--primary))' },
  IN_PROGRESS: { bg: 'hsl(var(--status-warning-bg))', text: 'hsl(var(--status-warning-fg))' },
  RESULTED: { bg: 'hsl(var(--status-success-bg))', text: 'hsl(var(--status-success-fg))' },
  VERIFIED: { bg: 'hsl(var(--status-success-bg))', text: 'hsl(var(--status-success-fg))' },
  PUBLISHED: { bg: 'hsl(var(--status-success-bg))', text: 'hsl(var(--status-success-fg))' },
  CANCELLED: { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' },
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
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Encounters</h1>
        <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Read-only — manage via Operator app</span>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Status:</label>
        <select value={statusFilter} onChange={(e) => handleStatus(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px' }}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>{total} total</span>
      </div>

      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ background: 'hsl(var(--background))' }}>
            <tr>
              {['Ref #', 'Patient', 'Status', 'Source', 'Ordered Tests', 'Tenant', 'Created'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading…</td></tr>
            ) : encounters.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>No encounters found.</td></tr>
            ) : encounters.map((e: any) => {
              const colors = STATUS_COLORS[e.status] ?? { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' };
              return (
                <tr key={e.id} style={{ borderTop: '1px solid hsl(var(--muted))' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px', color: 'hsl(var(--primary))', fontWeight: 600 }}>{e.refNumber ?? e.id?.slice(0, 8)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {e.patient ? `${e.patient.firstName ?? ''} ${e.patient.lastName ?? ''}`.trim() || e.patientId?.slice(0, 8) : e.patientId?.slice(0, 8) ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{e.status?.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>{e.source ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '12px', textAlign: 'center' }}>
                    {Array.isArray(e.orders) ? e.orders.length : (e.orderCount ?? '—')}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontFamily: 'monospace' }}>{e.tenantId?.slice(0, 8) ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', alignItems: 'center', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
          <button disabled={page <= 1} onClick={() => handlePage(page - 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'default', background: 'hsl(var(--card))' }}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'default', background: 'hsl(var(--card))' }}>Next →</button>
        </div>
      )}
    </div>
  );
}
