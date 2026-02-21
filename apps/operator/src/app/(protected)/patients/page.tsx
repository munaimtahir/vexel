'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/patients')
      .then(({ data, error: apiError }) => {
        if (apiError || !data) { setError('Failed to load patients'); return; }
        setPatients((data as any).data ?? []);
        setPagination((data as any).pagination ?? null);
      })
      .catch(() => setError('Failed to load patients'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Patients</h2>
          {pagination && <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>{pagination.total} total</p>}
        </div>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading patients...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {!loading && !error && patients.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b', fontSize: '16px' }}>No patients yet.</p>
        </div>
      )}

      {!loading && patients.length > 0 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['MRN', 'Name', 'DOB', 'Gender', 'Created'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace', color: '#475569' }}>{p.mrn}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>
                    {p.firstName} {p.lastName}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                    {p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{p.gender ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
