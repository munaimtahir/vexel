'use client';
import { useEffect, useRef, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const POLL_INTERVAL_MS = 5000;
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  queued:    { bg: '#fef9c3', text: '#854d0e' },
  running:   { bg: '#dbeafe', text: '#1d4ed8' },
  completed: { bg: '#dcfce7', text: '#166534' },
  failed:    { bg: '#fee2e2', text: '#991b1b' },
};

export default function ImportExportPage() {
  const [payload, setPayload] = useState('{\n  "tests": [\n    { "code": "CBC", "name": "Complete Blood Count" }\n  ]\n}');
  const [importJobs, setImportJobs] = useState<any[]>([]);
  const [exportJobs, setExportJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadJobs() {
    const api = getApiClient(getToken() ?? undefined);
    const [importRes, exportRes] = await Promise.allSettled([
      api.GET('/catalog/import-jobs' as any),
      api.GET('/catalog/export-jobs' as any),
    ]);
    if (importRes.status === 'fulfilled') setImportJobs((importRes.value.data as any)?.data ?? []);
    if (exportRes.status === 'fulfilled') setExportJobs((exportRes.value.data as any)?.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
    pollRef.current = setInterval(() => { loadJobs(); }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleImport() {
    setSubmitting('import'); setError(null);
    try {
      const body = JSON.parse(payload);
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.POST('/catalog/import-jobs' as any, { body });
      if ((res as any).error) throw new Error((res as any).error?.message ?? 'Import failed');
      await loadJobs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(null);
    }
  }

  async function handleExport() {
    setSubmitting('export'); setError(null);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.POST('/catalog/export-jobs' as any, {});
    if ((res as any).error) setError((res as any).error?.message ?? 'Export failed');
    await loadJobs();
    setSubmitting(null);
  }

  async function handleRetry(id: string) {
    setRetrying(id);
    const api = getApiClient(getToken() ?? undefined);
    await api.POST(`/catalog/import-jobs/${id}:retry` as any, {});
    await loadJobs();
    setRetrying(null);
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>Import / Export</h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>Bulk import catalog data or export for backup. Same payload → same job (idempotent).</p>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      {/* Import */}
      <section style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Import Catalog</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>Paste JSON with tests, parameters, panels arrays. Import is idempotent — same payload returns the same job.</p>
        <textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={10}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '12px', boxSizing: 'border-box' }} />
        <button onClick={handleImport} disabled={submitting === 'import'}
          style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
          {submitting === 'import' ? 'Submitting...' : '▶ Run Import'}
        </button>
      </section>

      {/* Export */}
      <section style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Export Catalog</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>Export all active catalog data to JSON. Result is stored in the job record.</p>
        <button onClick={handleExport} disabled={submitting === 'export'}
          style={{ padding: '8px 20px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
          {submitting === 'export' ? 'Submitting...' : '⬇ Run Export'}
        </button>
      </section>

      {/* Job lists */}
      <JobList title="Import Jobs" jobs={importJobs} loading={loading} onRetry={handleRetry} retrying={retrying} />
      <JobList title="Export Jobs" jobs={exportJobs} loading={loading} onRetry={null} retrying={null} />
    </div>
  );
}

function JobList({ title, jobs, loading, onRetry, retrying }: any) {
  return (
    <section style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>{title} ({jobs.length})</h2>
      {loading ? <p style={{ fontSize: '13px', color: '#94a3b8' }}>Loading...</p> : jobs.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: '13px' }}>No jobs yet.</p>
      ) : (
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                {['ID', 'Status', 'Created', 'Finished', 'Summary', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j: any) => {
                const colors = STATUS_COLORS[j.status] ?? { bg: '#f1f5f9', text: '#475569' };
                return (
                  <tr key={j.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{j.id.slice(0, 12)}…</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>{j.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px' }}>{new Date(j.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '11px' }}>{j.finishedAt ? new Date(j.finishedAt).toLocaleString() : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '11px', color: '#64748b' }}>
                      {j.errorSummary ? <span style={{ color: '#dc2626' }}>{j.errorSummary}</span>
                        : j.resultSummary ? `✓ ${j.resultSummary.created ?? 0} created, ${j.resultSummary.updated ?? 0} updated`
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {onRetry && j.status === 'failed' && (
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
      )}
    </section>
  );
}
