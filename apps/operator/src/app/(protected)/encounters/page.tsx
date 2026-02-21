'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function EncountersPage() {
  const router = useRouter();
  const [encounters, setEncounters] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/encounters')
      .then(({ data, error: apiError }) => {
        if (apiError || !data) { setError('Failed to load encounters'); return; }
        setEncounters((data as any).data ?? []);
        setPagination((data as any).pagination ?? null);
      })
      .catch(() => setError('Failed to load encounters'))
      .finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = {
    registered: '#3b82f6',
    lab_ordered: '#8b5cf6',
    specimen_collected: '#f59e0b',
    resulted: '#10b981',
    verified: '#059669',
    cancelled: '#ef4444',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Encounters</h2>
          {pagination && <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>{pagination.total} total</p>}
        </div>
        <Link
          href="/encounters/new"
          style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
        >
          + New Encounter
        </Link>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading encounters...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {!loading && !error && encounters.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b', fontSize: '16px' }}>No encounters yet.</p>
          <Link href="/encounters/new" style={{ color: '#3b82f6' }}>Register the first encounter →</Link>
        </div>
      )}

      {!loading && encounters.length > 0 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['ID', 'Patient', 'Status', 'Created'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {encounters.map((enc: any) => (
                <tr key={enc.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => router.push(`/encounters/${enc.id}`)}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace', color: '#475569' }}>{enc.id.slice(0, 8)}…</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>
                    {enc.patient ? `${enc.patient.firstName} ${enc.patient.lastName}` : enc.patientId.slice(0, 8)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, background: `${statusColor[enc.status] ?? '#94a3b8'}20`, color: statusColor[enc.status] ?? '#64748b' }}>
                      {enc.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{new Date(enc.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
