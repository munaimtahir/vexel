'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { EncounterStatusBadge } from '@/components/status-badge';

const LIMIT = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'registered', label: 'Registered' },
  { value: 'lab_ordered', label: 'Ordered' },
  { value: 'specimen_collected', label: 'Collected' },
  { value: 'specimen_received', label: 'Received' },
  { value: 'resulted', label: 'Resulted' },
  { value: 'verified', label: 'Verified' },
  { value: 'cancelled', label: 'Cancelled' },
];

function nextActionLink(enc: any): { text: string; href: string; disabled?: boolean } {
  switch (enc.status) {
    case 'registered':         return { text: 'Place Order', href: `/lims/encounters/${enc.id}/order` };
    case 'lab_ordered':        return { text: 'Collect Sample', href: `/lims/encounters/${enc.id}/sample` };
    case 'specimen_collected': return { text: 'Enter Results', href: `/lims/encounters/${enc.id}/results` };
    case 'specimen_received':  return { text: 'Enter Results', href: `/lims/encounters/${enc.id}/results` };
    case 'partial_resulted':   return { text: 'Enter Results', href: `/lims/encounters/${enc.id}/results` };
    case 'resulted':           return { text: 'Verify', href: `/lims/encounters/${enc.id}/verify` };
    case 'verified':           return { text: 'View Reports', href: `/lims/encounters/${enc.id}/reports` };
    case 'cancelled':          return { text: 'Cancelled', href: '#', disabled: true };
    default:                   return { text: 'View', href: `/lims/encounters/${enc.id}` };
  }
}

export default function WorklistPage() {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async (p: number, status: string) => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const query: any = { page: p, limit: LIMIT };
      if (status) query.status = status;
      const { data, error: apiErr } = await api.GET('/encounters', { params: { query } });
      if (apiErr || !data) { setError('Failed to load worklist'); return; }
      const list = Array.isArray(data) ? data : (data as any)?.data ?? [];
      const total = (data as any)?.total ?? list.length;
      setEncounters(list);
      setHasMore(p * LIMIT < total);
    } catch {
      setError('Failed to load worklist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page, statusFilter); }, [page, statusFilter]);

  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>Worklist</h1>
        <Link href="/lims/registrations/new" style={{ padding: '10px 20px', background: '#2563eb', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
          + New Registration
        </Link>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', background: 'white' }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : encounters.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No encounters found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Date/Time', 'Patient', 'Encounter ID', 'Status', 'Next Action'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {encounters.map((enc: any) => {
                const action = nextActionLink(enc);
                const p = enc.patient;
                const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : enc.patientId ?? '—';
                return (
                  <tr key={enc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      {enc.createdAt ? new Date(enc.createdAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500, color: '#1e293b' }}>{name}</div>
                      {p?.mrn && <div style={{ fontSize: '12px', color: '#94a3b8' }}>MRN: {p.mrn}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#1d4ed8', fontSize: '13px' }}>
                      {enc.encounterCode ?? enc.id?.slice(0, 8)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <EncounterStatusBadge status={enc.status} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {action.disabled ? (
                        <span style={{ color: '#9ca3af', fontSize: '13px' }}>{action.text}</span>
                      ) : (
                        <Link
                          href={action.href}
                          style={{ padding: '6px 14px', background: '#2563eb', color: 'white', borderRadius: '4px', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}
                        >
                          {action.text}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: page <= 1 ? '#94a3b8' : '#1e293b' }}
          >
            ← Prev
          </button>
          <span style={{ padding: '8px 12px', color: '#64748b', fontSize: '14px' }}>Page {page}</span>
          <button
            disabled={!hasMore}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: !hasMore ? 'not-allowed' : 'pointer', color: !hasMore ? '#94a3b8' : '#1e293b' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
