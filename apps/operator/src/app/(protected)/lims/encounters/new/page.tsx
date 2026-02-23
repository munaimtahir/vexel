'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function NewEncounterPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [patientId, setPatientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/patients')
      .then(({ data }) => { setPatients((data as any)?.data ?? []); })
      .catch(() => setError('Failed to load patients'))
      .finally(() => setLoadingPatients(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) { setError('Please select a patient'); return; }
    setLoading(true);
    setError('');

    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.POST('/encounters', { body: { patientId } });
      if (apiError || !data) { setError('Failed to create encounter'); return; }
      router.push('/lims/encounters');
    } catch {
      setError('Failed to create encounter');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Register Encounter</h2>
        <p style={{ color: '#64748b', margin: '4px 0 0' }}>Create a new patient encounter</p>
      </div>

      <div style={{ background: 'white', padding: '32px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
              Patient *
            </label>
            {loadingPatients ? (
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading patients...</p>
            ) : (
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
              >
                <option value="">Select a patient...</option>
                {patients.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} — MRN: {p.mrn}
                  </option>
                ))}
              </select>
            )}
            {patients.length === 0 && !loadingPatients && (
              <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '4px' }}>
                No patients found. <a href="/lims/patients" style={{ color: '#3b82f6' }}>Create a patient first</a>.
              </p>
            )}
          </div>

          {error && <p style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit" disabled={loading || loadingPatients}
              style={{ flex: 1, padding: '10px', background: loading ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Registering...' : 'Register Encounter'}
            </button>
            <button
              type="button" onClick={() => router.back()}
              style={{ padding: '10px 20px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
