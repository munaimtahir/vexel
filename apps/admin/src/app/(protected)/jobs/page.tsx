'use client';
import { useEffect, useMemo, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { ConfirmActionModal, DataTable } from '@vexel/ui-system';

type PendingRetry = {
  id: string;
  label: string;
  kind: 'job' | 'document';
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [failedJobs, setFailedJobs] = useState<any[]>([]);
  const [jobRuns, setJobRuns] = useState<any[]>([]);
  const [failedDocs, setFailedDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<PendingRetry | null>(null);

  async function load() {
    const api = getApiClient(getToken() ?? undefined);
    const [allRes, failedRes, importRes, exportRes, failedDocsRes] = await Promise.allSettled([
      api.GET('/jobs' as any, { params: { query: { page: 1, limit: 200 } } }),
      api.GET('/jobs/failed' as any, { params: { query: { page: 1, limit: 200 } } }),
      api.GET('/catalog/import-jobs' as any, {}),
      api.GET('/catalog/export-jobs' as any, {}),
      api.GET('/documents' as any, { params: { query: { status: 'FAILED', limit: 50 } as any } }),
    ]);
    if (allRes.status === 'fulfilled') setJobs(((allRes.value.data as any)?.data ?? []).map(enrichRow));
    if (failedRes.status === 'fulfilled') setFailedJobs(((failedRes.value.data as any)?.data ?? []).map(enrichRow));
    const importRuns = importRes.status === 'fulfilled' ? (((importRes.value.data as any)?.data ?? []) as any[]) : [];
    const exportRuns = exportRes.status === 'fulfilled' ? (((exportRes.value.data as any)?.data ?? []) as any[]) : [];
    setJobRuns([...importRuns, ...exportRuns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    if (failedDocsRes.status === 'fulfilled') setFailedDocs(((failedDocsRes.value.data as any) ?? []).map(enrichDoc));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function executeRetry() {
    if (!pendingRetry) return;
    setRetrying(pendingRetry.id);
    const api = getApiClient(getToken() ?? undefined);
    if (pendingRetry.kind === 'job') {
      await api.POST(`/jobs/${pendingRetry.id}:retry` as any, {});
    } else {
      await api.POST('/documents/{id}:publish' as any, { params: { path: { id: pendingRetry.id } } });
    }
    setPendingRetry(null);
    await load();
    setRetrying(null);
  }

  const queueDepth = useMemo(
    () => jobs.filter((row) => ['waiting', 'active', 'delayed'].includes(String(row.status))).length,
    [jobs],
  );

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <ConfirmActionModal
        open={pendingRetry !== null}
        title="Retry Failed Job"
        description="This will re-queue the failed task. Continue?"
        actionPreview={pendingRetry ? `${pendingRetry.label} (${pendingRetry.id})` : undefined}
        confirmText="Retry"
        onConfirm={executeRetry}
        onCancel={() => setPendingRetry(null)}
        loading={retrying !== null}
      />

      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: 'hsl(var(--foreground))' }}>Jobs</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <MiniCard label="Queue Depth" value={queueDepth} />
        <MiniCard label="Failed BullMQ Jobs" value={failedJobs.length} status="danger" />
        <MiniCard label="Failed Documents" value={failedDocs.length} status={failedDocs.length ? 'danger' : 'ok'} />
      </div>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'hsl(var(--status-destructive-fg))' }}>Failed BullMQ Jobs ({failedJobs.length})</h2>
        {failedJobs.length === 0 ? (
          <div style={{ background: 'hsl(var(--status-success-bg))', padding: '16px 20px', borderRadius: '8px', color: 'hsl(var(--status-success-fg))', fontSize: '14px' }}>✓ No failed jobs</div>
        ) : (
          <JobTable
            jobs={failedJobs}
            onRetry={(job: any) => setPendingRetry({ id: job.id, kind: 'job', label: job.name ?? 'BullMQ Job' })}
            retrying={retrying}
            expanded={expandedJob}
            onExpand={setExpandedJob}
          />
        )}
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'hsl(var(--status-warning-fg))' }}>Document Renders — Failed ({failedDocs.length})</h2>
        {failedDocs.length === 0 ? (
          <div style={{ background: 'hsl(var(--status-success-bg))', padding: '16px 20px', borderRadius: '8px', color: 'hsl(var(--status-success-fg))', fontSize: '14px' }}>✓ No failed document renders</div>
        ) : (
          <DocRenderTable
            docs={failedDocs}
            onRetry={(doc: any) => setPendingRetry({ id: doc.id, kind: 'document', label: `Document ${doc.type ?? ''}`.trim() })}
            retrying={retrying}
          />
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
          <JobTable
            jobs={jobs}
            onRetry={(job: any) => setPendingRetry({ id: job.id, kind: 'job', label: job.name ?? 'BullMQ Job' })}
            retrying={retrying}
            expanded={expandedJob}
            onExpand={setExpandedJob}
          />
        )}
      </section>
    </div>
  );
}

function enrichRow(row: any) {
  return {
    ...row,
    correlationId: row?.correlationId ?? row?.data?.correlationId ?? null,
    failedAt: row?.processedAt ?? row?.createdAt ?? null,
    status:
      row?.status && row.status !== 'unknown'
        ? row.status
        : row?.failedReason
          ? 'failed'
          : 'waiting',
  };
}

function enrichDoc(doc: any) {
  return {
    ...doc,
    correlationId: doc?.correlationId ?? doc?.metadata?.correlationId ?? doc?.payload?.correlationId ?? null,
    failedAt: doc?.updatedAt ?? doc?.createdAt ?? null,
  };
}

function since(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function MiniCard({ label, value, status }: { label: string; value: string | number; status?: 'ok' | 'danger' }) {
  return (
    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '10px 12px', background: 'hsl(var(--card))' }}>
      <p style={{ margin: 0, color: 'hsl(var(--muted-foreground))', fontSize: '11px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '20px', color: status === 'danger' ? 'hsl(var(--status-destructive-fg))' : status === 'ok' ? 'hsl(var(--status-success-fg))' : undefined }}>
        {value}
      </p>
    </div>
  );
}

function DocRenderTable({ docs, onRetry, retrying }: { docs: any[]; onRetry: (row: any) => void; retrying: string | null }) {
  return (
    <DataTable
      columns={[
        {
          key: 'id',
          header: 'Document ID',
          cell: (d: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{d.id.slice(0, 12)}...</span>,
        },
        {
          key: 'type',
          header: 'Type',
          cell: (d: any) => d.type,
        },
        {
          key: 'correlation',
          header: 'Correlation ID',
          cell: (d: any) => (
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
              {d.correlationId ? String(d.correlationId).slice(0, 14) : '—'}
            </span>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          cell: (d: any) => <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: 'hsl(var(--status-destructive-bg))', color: 'hsl(var(--status-destructive-fg))' }}>{d.status}</span>,
        },
        {
          key: 'failedAt',
          header: 'Failed',
          cell: (d: any) => (
            <span style={{ fontSize: '11px', background: 'hsl(var(--status-warning-bg))', color: 'hsl(var(--status-warning-fg))', padding: '2px 8px', borderRadius: '10px' }}>
              {since(d.failedAt)}
            </span>
          ),
        },
        {
          key: 'error',
          header: 'Failure Reason',
          cell: (d: any) => <span style={{ color: 'hsl(var(--status-destructive-fg))', fontSize: '12px' }}>{d.errorMessage ?? '—'}</span>,
        },
        {
          key: 'actions',
          header: '',
          cell: (d: any) => (
            <button
              onClick={() => onRetry(d)}
              disabled={retrying === d.id}
              style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--status-info-bg))', color: 'hsl(var(--status-info-fg))', border: '1px solid hsl(var(--status-info-border))', borderRadius: '4px', cursor: 'pointer' }}
            >
              {retrying === d.id ? '...' : 'Re-publish'}
            </button>
          ),
        },
      ]}
      data={docs}
      keyExtractor={(d: any) => `${d.id}`}
      emptyMessage="No failed document renders"
      className="shadow-sm"
    />
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
    <DataTable
      columns={[
        {
          key: 'id',
          header: 'ID',
          cell: (j: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{String(j.id).slice(0, 10)}...</span>,
        },
        {
          key: 'queue',
          header: 'Queue',
          cell: (j: any) => j.queue,
        },
        {
          key: 'name',
          header: 'Name',
          cell: (j: any) => j.name ?? '—',
        },
        {
          key: 'correlationId',
          header: 'Correlation ID',
          cell: (j: any) => (
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
              {j.correlationId ? String(j.correlationId).slice(0, 14) : '—'}
            </span>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          cell: (j: any) => {
            const colors = statusColors[j.status] ?? { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' };
            return <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{j.status}</span>;
          },
        },
        {
          key: 'attempts',
          header: 'Attempts',
          cell: (j: any) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{j.attemptsMade ?? 0}</span>,
        },
        {
          key: 'failedAt',
          header: 'Failed',
          cell: (j: any) => (
            j.status === 'failed' ? (
              <span style={{ fontSize: '11px', background: 'hsl(var(--status-warning-bg))', color: 'hsl(var(--status-warning-fg))', padding: '2px 8px', borderRadius: '10px' }}>
                {since(j.failedAt)}
              </span>
            ) : '—'
          ),
        },
        {
          key: 'actions',
          header: 'Actions',
          cell: (j: any) => {
            const isExpanded = expanded === j.id;
            const details = `${j.failedReason ?? ''}${j.stacktrace ? `\n\n${Array.isArray(j.stacktrace) ? j.stacktrace.join('\n') : j.stacktrace}` : ''}`.trim();
            return (
              <div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {j.status === 'failed' && (
                    <button
                      onClick={() => onRetry(j)}
                      disabled={retrying === j.id}
                      style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--status-info-bg))', color: 'hsl(var(--status-info-fg))', border: '1px solid hsl(var(--status-info-border))', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {retrying === j.id ? '...' : 'Retry'}
                    </button>
                  )}
                  {(j.failedReason || j.stacktrace) && (
                    <button
                      onClick={() => onExpand(isExpanded ? null : j.id)}
                      style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div style={{ marginTop: '8px', borderRadius: '4px', background: 'hsl(var(--status-warning-bg))', padding: '8px 10px' }}>
                    <div style={{ fontSize: '12px', color: 'hsl(var(--status-warning-fg))', marginBottom: '6px', fontWeight: 600 }}>Failure Reason</div>
                    <pre style={{ fontSize: '11px', color: 'hsl(var(--status-warning-fg))', overflow: 'auto', maxHeight: '220px', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {details || 'No details available.'}
                    </pre>
                  </div>
                )}
              </div>
            );
          },
        },
      ]}
      data={jobs}
      keyExtractor={(j: any) => `${j.id}`}
      emptyMessage="No jobs found."
      className="shadow-sm"
    />
  );
}

function JobRunTable({ jobRuns }: { jobRuns: any[] }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    queued: { bg: 'hsl(var(--status-warning-bg))', text: 'hsl(var(--status-warning-fg))' },
    running: { bg: 'hsl(var(--status-info-bg))', text: 'hsl(var(--status-info-fg))' },
    completed: { bg: 'hsl(var(--status-success-bg))', text: 'hsl(var(--status-success-fg))' },
    failed: { bg: 'hsl(var(--status-destructive-bg))', text: 'hsl(var(--status-destructive-fg))' },
  };
  return (
    <DataTable
      columns={[
        {
          key: 'id',
          header: 'ID',
          cell: (j: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>{j.id.slice(0, 12)}...</span>,
        },
        {
          key: 'type',
          header: 'Type',
          cell: (j: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{j.type}</span>,
        },
        {
          key: 'status',
          header: 'Status',
          cell: (j: any) => {
            const colors = statusColors[j.status] ?? { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' };
            return <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{j.status}</span>;
          },
        },
        {
          key: 'correlationId',
          header: 'Correlation ID',
          cell: (j: any) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontFamily: 'monospace' }}>{j.correlationId?.slice(0, 14) ?? '—'}</span>,
        },
        {
          key: 'createdBy',
          header: 'Created By',
          cell: (j: any) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{j.createdBy?.slice(0, 12) ?? '—'}</span>,
        },
        {
          key: 'createdAt',
          header: 'Created',
          cell: (j: any) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{new Date(j.createdAt).toLocaleString()}</span>,
        },
        {
          key: 'finishedAt',
          header: 'Finished',
          cell: (j: any) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>{j.finishedAt ? new Date(j.finishedAt).toLocaleString() : '—'}</span>,
        },
        {
          key: 'summary',
          header: 'Summary',
          cell: (j: any) => (
            <span style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
              {j.errorSummary ? (
                <span style={{ color: 'hsl(var(--status-destructive-fg))' }}>{j.errorSummary}</span>
              ) : j.resultSummary ? (
                `${j.resultSummary.created ?? 0}↑ ${j.resultSummary.updated ?? 0}↻`
              ) : (
                '—'
              )}
            </span>
          ),
        },
      ]}
      data={jobRuns}
      keyExtractor={(j: any) => `${j.id}`}
      emptyMessage="No catalog job runs found."
      className="shadow-sm"
    />
  );
}
