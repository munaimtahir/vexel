'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [failedJobs, setFailedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function load() {
    const api = getApiClient(getToken() ?? undefined);
    const [allRes, failedRes] = await Promise.allSettled([
      api.GET('/jobs'),
      api.GET('/jobs/failed'),
    ]);
    if (allRes.status === 'fulfilled') setJobs(allRes.value.data?.data ?? []);
    if (failedRes.status === 'fulfilled') setFailedJobs(failedRes.value.data?.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleRetry(jobId: string) {
    setRetrying(jobId);
    const api = getApiClient(getToken() ?? undefined);
    await api.POST(`/jobs/${jobId}:retry` as any, {});
    await load();
    setRetrying(null);
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: '#1e293b' }}>Jobs</h1>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#dc2626' }}>Failed Jobs ({failedJobs.length})</h2>
        {failedJobs.length === 0 ? (
          <div style={{ background: '#f0fdf4', padding: '16px 20px', borderRadius: '8px', color: '#166534', fontSize: '14px' }}>✓ No failed jobs</div>
        ) : (
          <JobTable jobs={failedJobs} onRetry={handleRetry} retrying={retrying} />
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>All Jobs ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>No jobs found.</p>
        ) : (
          <JobTable jobs={jobs} onRetry={handleRetry} retrying={retrying} />
        )}
      </section>
    </div>
  );
}

function JobTable({ jobs, onRetry, retrying }: any) {
  const statusColors: any = {
    failed: { bg: '#fee2e2', text: '#991b1b' },
    completed: { bg: '#dcfce7', text: '#166534' },
    active: { bg: '#dbeafe', text: '#1d4ed8' },
    waiting: { bg: '#fef9c3', text: '#854d0e' },
    delayed: { bg: '#ede9fe', text: '#6d28d9' },
  };
  return (
    <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ background: '#f8fafc' }}>
          <tr>
            {['ID', 'Queue', 'Name', 'Status', 'Attempts', 'Created', 'Actions'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j: any) => {
            const colors = statusColors[j.status] ?? { bg: '#f1f5f9', text: '#475569' };
            return (
              <tr key={j.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{j.id.slice(0, 10)}…</td>
                <td style={{ padding: '10px 12px' }}>{j.queue}</td>
                <td style={{ padding: '10px 12px' }}>{j.name ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{j.status}</span>
                </td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{j.attemptsMade ?? 0}</td>
                <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px' }}>{j.createdAt ? new Date(j.createdAt).toLocaleString() : '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  {j.status === 'failed' && (
                    <button onClick={() => onRetry(j.id)} disabled={retrying === j.id}
                      style={{ padding: '4px 10px', fontSize: '12px', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}>
                      {retrying === j.id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
