'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [failedJobs, setFailedJobs] = useState<any[]>([]);
  const [jobRuns, setJobRuns] = useState<any[]>([]);
  const [failedDocs, setFailedDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function load() {
    const api = getApiClient(getToken() ?? undefined);
    const [allRes, failedRes, importRes, exportRes, failedDocsRes] = await Promise.allSettled([
      api.GET('/jobs' as any),
      api.GET('/jobs/failed' as any),
      api.GET('/catalog/import-jobs' as any),
      api.GET('/catalog/export-jobs' as any),
      api.GET('/documents' as any, { params: { query: { status: 'FAILED', limit: 10 } as any } }),
    ]);
    if (allRes.status === 'fulfilled') setJobs(allRes.value.data?.data ?? []);
    if (failedRes.status === 'fulfilled') setFailedJobs(failedRes.value.data?.data ?? []);
    const importRuns = importRes.status === 'fulfilled' ? ((importRes.value.data as any)?.data ?? []) : [];
    const exportRuns = exportRes.status === 'fulfilled' ? ((exportRes.value.data as any)?.data ?? []) : [];
    setJobRuns([...importRuns, ...exportRuns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    if (failedDocsRes.status === 'fulfilled') setFailedDocs((failedDocsRes.value.data as any) ?? []);
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
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#dc2626' }}>Failed BullMQ Jobs ({failedJobs.length})</h2>
        {failedJobs.length === 0 ? (
          <div style={{ background: '#f0fdf4', padding: '16px 20px', borderRadius: '8px', color: '#166534', fontSize: '14px' }}>✓ No failed jobs</div>
        ) : (
          <JobTable jobs={failedJobs} onRetry={handleRetry} retrying={retrying} />
        )}
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: '#b45309' }}>Document Renders — Failed ({failedDocs.length})</h2>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
          ℹ️ Retry for failed document renders is coming in Phase 6.
        </p>
        {failedDocs.length === 0 ? (
          <div style={{ background: '#f0fdf4', padding: '16px 20px', borderRadius: '8px', color: '#166534', fontSize: '14px' }}>✓ No failed document renders</div>
        ) : (
          <DocRenderTable docs={failedDocs} />
        )}
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>Catalog Job Runs ({jobRuns.length})</h2>
        {jobRuns.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>No catalog job runs found.</p>
        ) : (
          <JobRunTable jobRuns={jobRuns} />
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>All BullMQ Jobs ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>No jobs found.</p>
        ) : (
          <JobTable jobs={jobs} onRetry={handleRetry} retrying={retrying} />
        )}
      </section>
    </div>
  );
}

function DocRenderTable({ docs }: { docs: any[] }) {
  return (
    <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ background: '#f8fafc' }}>
          <tr>
            {['Document ID', 'Type', 'Status', 'Error', 'Created'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((d: any) => (
            <tr key={d.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{d.id.slice(0, 12)}…</td>
              <td style={{ padding: '10px 12px' }}>{d.type}</td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: '#fee2e2', color: '#991b1b' }}>{d.status}</span>
              </td>
              <td style={{ padding: '10px 12px', color: '#dc2626', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.errorMessage ?? '—'}
              </td>
              <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px' }}>{new Date(d.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function JobRunTable({ jobRuns }: { jobRuns: any[] }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    queued:    { bg: '#fef9c3', text: '#854d0e' },
    running:   { bg: '#dbeafe', text: '#1d4ed8' },
    completed: { bg: '#dcfce7', text: '#166534' },
    failed:    { bg: '#fee2e2', text: '#991b1b' },
  };
  return (
    <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ background: '#f8fafc' }}>
          <tr>
            {['ID', 'Type', 'Status', 'Created By', 'Created', 'Finished', 'Summary'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobRuns.map((j: any) => {
            const colors = statusColors[j.status] ?? { bg: '#f1f5f9', text: '#475569' };
            return (
              <tr key={j.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{j.id.slice(0, 12)}…</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px' }}>{j.type}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{j.status}</span>
                </td>
                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '11px' }}>{j.createdBy?.slice(0, 12) ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px' }}>{new Date(j.createdAt).toLocaleString()}</td>
                <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px' }}>{j.finishedAt ? new Date(j.finishedAt).toLocaleString() : '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '11px', color: '#64748b' }}>
                  {j.errorSummary ? <span style={{ color: '#dc2626' }}>{j.errorSummary}</span>
                    : j.resultSummary ? `${j.resultSummary.created ?? 0}↑ ${j.resultSummary.updated ?? 0}↻`
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
