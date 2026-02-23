'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Tab = 'pending' | 'submitted';

function patientAge(p: any): string {
  if (!p) return '';
  if (p.ageYears != null) return `${p.ageYears}`;
  if (p.dateOfBirth) {
    const diff = Date.now() - new Date(p.dateOfBirth).getTime();
    return `${Math.floor(diff / (365.25 * 24 * 3600 * 1000))}`;
  }
  return '';
}

function patientLabel(p: any): string {
  if (!p) return '—';
  const age = patientAge(p);
  const gender = p.gender ? p.gender.toString().charAt(0).toUpperCase() : '';
  return `${age}${gender}`;
}

const statusColors: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fff7ed', color: '#c2410c' },
  SUBMITTED: { bg: '#f0fdf4', color: '#16a34a' },
};

export default function ResultsWorklistPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      if (tab === 'pending') {
        // @ts-ignore
        const { data, error: apiErr } = await api.GET('/results/tests/pending', {
          params: { query: search ? { search } : {} },
        });
        if (apiErr) { setError('Failed to load'); return; }
        setRows((data as any)?.data ?? []);
      } else {
        // @ts-ignore
        const { data, error: apiErr } = await api.GET('/results/tests/submitted', {
          params: { query: search ? { search } : {} },
        });
        if (apiErr) { setError('Failed to load'); return; }
        setRows((data as any)?.data ?? []);
      }
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    border: 'none',
    background: active ? '#2563eb' : 'transparent',
    color: active ? 'white' : '#64748b',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  });

  const badge = (status: string) => {
    const s = statusColors[status] ?? { bg: '#f1f5f9', color: '#64748b' };
    return (
      <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color }}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Results</h2>

        {/* Tabs */}
        <div style={{ gap: '4px', background: '#f8fafc', padding: '4px', borderRadius: '8px', display: 'inline-flex', marginBottom: '16px' }}>
          <button style={tabStyle(tab === 'pending')} onClick={() => setTab('pending')}>Pending tests</button>
          <button style={tabStyle(tab === 'submitted')} onClick={() => setTab('submitted')}>Submitted tests</button>
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search by name, MRN, order ID or test name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '360px',
              padding: '8px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#1e293b',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '48px', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '16px' }}>
            {tab === 'pending' ? 'No pending tests' : 'No submitted tests'}
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Time', 'Patient', 'Order ID', 'Test name', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {row.patient ? (
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                          {row.patient.firstName} {row.patient.lastName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {row.patient.mrn} · {patientLabel(row.patient)}
                        </div>
                      </div>
                    ) : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace', color: '#475569' }}>
                    {row.encounterCode ?? row.encounterId?.slice(0, 8) ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>
                    {row.testName}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {badge(row.resultStatus)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => router.push(`/lims/results/${row.id}`)}
                      style={{
                        padding: '6px 14px',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tab === 'pending' ? 'Enter results' : 'View / Add missing'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
