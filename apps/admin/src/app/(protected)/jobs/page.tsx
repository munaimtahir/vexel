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
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  async function load() {
    const api = getApiClient(getToken() ?? undefined);
    const [allRes, failedRes, importRes, exportRes, failedDocsRes] = await Promise.allSettled([
      api.GET('/jobs' as any, {}),
      api.GET('/jobs/failed' as any, {}),
      api.GET('/catalog/import-jobs' as any, {}),
      api.GET('/catalog/export-jobs' as any, {}),
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

  async function handleDocRetry(docId: string) {
    setRetrying(docId);
    const api = getApiClient(getToken() ?? undefined);
    await api.POST('/documents/{id}:publish' as any, { params: { path: { id: docId } } });
    await load();
    setRetrying(null);
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: 'hsl(var(--foreground))' }}>Jobs</h1>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'hsl(var(--status-destructive-fg))' }}>Failed BullMQ Jobs ({failedJobs.length})</h2>
        {failedJobs.length === 0 ? (
          <div style={{ background: 'hsl(var(--status-success-bg))', padding: '16px 20px', borderRadius: '8px', color: 'hsl(var(--status-success-fg))', fontSize: '14px' }}>✓ No failed jobs</div>
        ) : (
          <JobTable jobs={failedJobs} onRetry={handleRetry} retrying={retrying} expanded={expandedJob} onExpand={setExpandedJob} />
        )}
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'hsl(var(--status-warning-fg))' }}>Document Renders — Failed ({failedDocs.length})</h2>
        {failedDocs.length === 0 ? (
          <div style={{ background: 'hsl(var(--status-success-bg))', padding: '16px 20px', borderRadius: '8px', color: 'hsl(var(--status-success-fg))', fontSize: '14px' }}>✓ No failed document renders</div>
        ) : (
          <DocRenderTable docs={failedDocs} onRetry={handleDocRetry} retrying={retrying} />
        )}
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'hsl(var(--foreground))' }}>Catalog Job Runs ({jobRuns.length})</h2>
        {jobRuns.length === 0 ? (
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px' }}>No catalog job runs found.</p>
        ) : (
          <JobRunTable jobRuns={jobRuns} />
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'hsl(var(--foreground))' }}>All BullMQ Jobs ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px' }}>No jobs found.</p>
        ) : (
          <JobTable jobs={jobs} onRetry={handleRetry} retrying={retrying} expanded={expandedJob} onExpand={setExpandedJob} />
        )}
      </section>
    </div>
  );
}

function DocRenderTable({ docs, onRetry, retrying }: { docs: any[]; onRetry: (id: string) => void; retrying: string | null }) {
  return (
    <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ background: 'hsl(var(--background))' }}>
          <tr>
            {['Document ID', 'Type', 'Status', 'Error', 'Created', ''].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((d: any) => (
            <tr key={d.id} style={{ borderTop: '1px solid hsl(var(--muted))' }}>
              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{d.id.slice(0, 12)}…</td>
              <td style={{ padding: '10px 12px' }}>{d.type}</td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))' }}>{d.status}</span>
              </td>
              <td style={{ padding: '10px 12px', color: 'hsl(var(--status-destructive-fg))', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.errorMessage ?? '—'}</td>
              <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{new Date(d.createdAt).toLocaleString()}</td>
              <td style={{ padding: '10px 12px' }}>
                <button onClick={() => onRetry(d.id)} disabled={retrying === d.id}
                  style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--status-info-bg))', color: 'hsl(var(--status-info-fg))', border: '1px solid hsl(var(--status-info-border))', borderRadius: '4px', cursor: 'pointer' }}>
                  {retrying === d.id ? '...' : 'Re-publish'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobTable({ jobs, onRetry, retrying, expanded, onExpand }: any) {
  const statusColors: any = {
    failed: { bg: 'hsl(var(--status-destructive-bg))', text: 'hsl(var(--status-destructive-fg))' },
    completed: { bg: 'hsl(var(--status-success-bg))', text: 'hsl(var(--status-success-fg))' },
    active: { bg: 'hsl(var(--status-info-bg))', text: 'hsl(var(--status-info-fg))' },
    waiting: { bg: 'hsl(var(--status-warning-bg))', text: 'hsl(var(--status-warning-fg))' },
    delayed: { bg: 'hsl(var(--status-info-bg))', text: 'hsl(var(--primary))' },
  };
  return (
    <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ background: 'hsl(var(--background))' }}>
          <tr>
            {['ID', 'Queue', 'Name', 'Status', 'Attempts', 'Created', 'Actions'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j: any) => {
            const colors = statusColors[j.status] ?? { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' };
            const isExpanded = expanded === j.id;
            return (
              <>
                <tr key={j.id} style={{ borderTop: '1px solid hsl(var(--muted))' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{j.id.slice(0, 10)}…</td>
                  <td style={{ padding: '10px 12px' }}>{j.queue}</td>
                  <td style={{ padding: '10px 12px' }}>{j.name ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{j.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))' }}>{j.attemptsMade ?? 0}</td>
                  <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{j.createdAt ? new Date(j.createdAt).toLocaleString() : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {j.status === 'failed' && (
                        <button onClick={() => onRetry(j.id)} disabled={retrying === j.id}
                          style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--status-info-bg))', color: 'hsl(var(--status-info-fg))', border: '1px solid hsl(var(--status-info-border))', borderRadius: '4px', cursor: 'pointer' }}>
                          {retrying === j.id ? '...' : 'Retry'}
                        </button>
                      )}
                      {(j.failedReason || j.stacktrace) && (
                        <button onClick={() => onExpand(isExpanded ? null : j.id)}
                          style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}>
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr style={{ borderTop: '1px solid hsl(var(--muted))', background: 'hsl(var(--status-warning-bg))' }}>
                    <td colSpan={7} style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '12px', color: 'hsl(var(--status-warning-fg))', marginBottom: '6px', fontWeight: 600 }}>Failure Reason:</div>
                      <pre style={{ fontSize: '11px', color: 'hsl(var(--status-warning-fg))', overflow: 'auto', maxHeight: '200px', margin: 0, background: 'hsl(var(--status-warning-bg))', padding: '10px', borderRadius: '4px' }}>
                        {j.failedReason ?? ''}{j.stacktrace ? '\n\n' + (Array.isArray(j.stacktrace) ? j.stacktrace.join('\n') : j.stacktrace) : ''}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function JobRunTable({ jobRuns }: { jobRuns: any[] }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    queued:    { bg: 'hsl(var(--status-warning-bg))', text: 'hsl(var(--status-warning-fg))' },
    running:   { bg: 'hsl(var(--status-info-bg))', text: 'hsl(var(--status-info-fg))' },
    completed: { bg: 'hsl(var(--status-success-bg))', text: 'hsl(var(--status-success-fg))' },
    failed:    { bg: 'hsl(var(--status-destructive-bg))', text: 'hsl(var(--status-destructive-fg))' },
  };
  return (
    <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ background: 'hsl(var(--background))' }}>
          <tr>
            {['ID', 'Type', 'Status', 'Created By', 'Created', 'Finished', 'Summary'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobRuns.map((j: any) => {
            const colors = statusColors[j.status] ?? { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' };
            return (
              <tr key={j.id} style={{ borderTop: '1px solid hsl(var(--muted))' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{j.id.slice(0, 12)}…</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px' }}>{j.type}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{j.status}</span>
                </td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{j.createdBy?.slice(0, 12) ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{new Date(j.createdAt).toLocaleString()}</td>
                <td style={{ padding: '10px 12px', color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{j.finishedAt ? new Date(j.finishedAt).toLocaleString() : '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
                  {j.errorSummary ? <span style={{ color: 'hsl(var(--status-destructive-fg))' }}>{j.errorSummary}</span>
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
