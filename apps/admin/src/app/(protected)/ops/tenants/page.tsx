'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Run = {
  id: string;
  type: string;
  status: string;
  tenantId?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  QUEUED: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

function fmtTime(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString();
}

export default function TenantExportsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/ops/runs', { params: { query: { type: 'TENANT_EXPORT', limit: 50 } as any } });
    setRuns((data as any)?.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      await api.POST('/ops/backups/tenant:export', { body: { tenantId: tenantId.trim() } });
      setToast('Tenant export queued');
      setTenantId('');
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to queue export');
    } finally {
      setSubmitting(false);
    }
  }

  // group by tenantId — show latest per tenant
  const byTenant = new Map<string, Run>();
  for (const run of runs) {
    const key = run.tenantId ?? 'unknown';
    const existing = byTenant.get(key);
    if (!existing || new Date(run.createdAt ?? run.startedAt ?? 0) > new Date(existing.createdAt ?? existing.startedAt ?? 0)) {
      byTenant.set(key, run);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

      <h1 className="text-2xl font-bold">Tenant Exports</h1>

      {/* Export form */}
      <div className="border rounded-lg p-4 space-y-3 max-w-md">
        <h2 className="font-semibold text-sm">Trigger New Export</h2>
        <form onSubmit={handleExport} className="flex gap-2">
          <input
            type="text"
            placeholder="Tenant ID"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm bg-background"
          />
          <button
            type="submit"
            disabled={submitting || !tenantId.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Queuing…' : 'Export'}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Latest per tenant */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Last Export Per Tenant</h2>
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : byTenant.size === 0 ? (
          <p className="text-sm text-muted-foreground">No exports yet.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Tenant ID</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Started</th>
                  <th className="px-4 py-2 text-left font-medium">Finished</th>
                  <th className="px-4 py-2 text-left font-medium">Logs</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(byTenant.entries()).map(([tid, run]) => (
                  <tr key={tid} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{tid}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[run.status] ?? 'bg-gray-100'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtTime(run.startedAt)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtTime(run.finishedAt)}</td>
                    <td className="px-4 py-2">
                      <a href={`/ops/logs?runId=${run.id}`} className="text-xs text-primary hover:underline">
                        View logs
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All runs */}
      <div>
        <h2 className="text-lg font-semibold mb-3">All Export Runs</h2>
        {loading ? null : !runs.length ? (
          <p className="text-sm text-muted-foreground">No runs.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Run ID</th>
                  <th className="px-4 py-2 text-left font-medium">Tenant</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{run.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2 font-mono text-xs">{run.tenantId ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[run.status] ?? 'bg-gray-100'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtTime(run.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
