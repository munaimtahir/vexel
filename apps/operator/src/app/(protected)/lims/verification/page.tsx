'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type VerificationSummary = {
  encounterId: string;
  encounterCode?: string | null;
  submittedTestsCount: number;
  oldestSubmittedAt?: string | null;
  createdAt: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth?: string | null;
    ageYears?: number | null;
    gender?: string | null;
  };
};

function calcAge(dob?: string | null, ageYears?: number | null): string {
  if (ageYears != null) return `${ageYears}y`;
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years}y`;
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' +
    d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function VerificationPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<VerificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'pending' | 'verified'>('pending');

  const load = async (q: string) => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiErr } = await api.GET('/verification/encounters/pending', {
        params: { query: { search: q || undefined, limit: 50 } },
      });
      if (apiErr || !data) { setError('Failed to load verification queue'); return; }
      const list: VerificationSummary[] = Array.isArray((data as any).data)
        ? (data as any).data
        : Array.isArray(data) ? data : [];
      setQueue(list);
    } catch {
      setError('Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(search); }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(search); };

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      {/* Header */}
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', margin: '0 0 20px' }}>
        Verification
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setTab('pending')}
          style={{
            padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: tab === 'pending' ? 600 : 400,
            color: tab === 'pending' ? '#0f172a' : '#64748b',
            borderBottom: tab === 'pending' ? '2px solid #3b82f6' : '2px solid transparent',
            marginBottom: '-1px',
          }}
        >
          Pending
        </button>
        <button
          disabled
          style={{
            padding: '8px 20px', background: 'none', border: 'none', cursor: 'not-allowed',
            fontSize: '14px', fontWeight: 400, color: '#cbd5e1',
            borderBottom: '2px solid transparent', marginBottom: '-1px',
          }}
        >
          Verified today
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by patient name or MRN..."
          style={{
            flex: 1, maxWidth: '360px', padding: '8px 12px', border: '1px solid #cbd5e1',
            borderRadius: '6px', fontSize: '14px', outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none',
            borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
          }}
        >
          Search
        </button>
      </form>

      {/* States */}
      {loading && <p style={{ color: '#64748b', fontSize: '14px' }}>Loading...</p>}
      {error && <p style={{ color: '#ef4444', fontSize: '14px' }}>{error}</p>}

      {/* Table */}
      {!loading && !error && (
        queue.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px', color: '#64748b',
            background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>No patients pending verification</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['Time', 'Patient', 'Order ID', 'Tests', 'Action'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                      color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map(row => {
                  const p = row.patient;
                  const age = p ? calcAge(p.dateOfBirth, p.ageYears) : '—';
                  const sex = p?.gender ? p.gender.charAt(0).toUpperCase() : '—';
                  return (
                    <tr key={row.encounterId} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {fmtTime(row.oldestSubmittedAt ?? row.createdAt)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {p ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {p.firstName} {p.lastName}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '12px' }}>
                              MRN: {p.mrn} · {age}/{sex}
                            </div>
                          </div>
                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#334155', fontFamily: 'monospace' }}>
                        {row.encounterCode ?? '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#334155' }}>
                        <span style={{
                          background: '#fef3c7', color: '#92400e', padding: '2px 8px',
                          borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                        }}>
                          {row.submittedTestsCount} test{row.submittedTestsCount !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          onClick={() => router.push(`/lims/verification/encounters/${row.encounterId}`)}
                          style={{
                            padding: '6px 14px', background: '#3b82f6', color: 'white',
                            border: 'none', borderRadius: '6px', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 500,
                          }}
                        >
                          Verify patient
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
