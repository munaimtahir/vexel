'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Run = {
  id: string;
  type: string;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  artifactSizeBytes?: number | null;
  artifactPath?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  QUEUED: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const STATUSES = ['ALL', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'] as const;

function fmtBytes(n?: number | null) {
  if (!n) return '—';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTime(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString();
}

export default function BackupsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [pagination, setPagination] = useState<{ total: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  async function load(pg = page, sf = statusFilter) {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const query: Record<string, any> = { type: 'FULL', limit: 20, page: pg };
    if (sf !== 'ALL') query.status = sf;
    const { data } = await api.GET('/ops/runs', { params: { query } as any });
    setRuns((data as any)?.data ?? []);
    setPagination((data as any)?.pagination ?? null);
    setLoading(false);
  }

  useEffect(() => { load(page, statusFilter); }, [page, statusFilter]);

  function changeFilter(sf: string) {
    setStatusFilter(sf);
    setPage(1);
  }

  const totalPages = pagination ? Math.ceil(pagination.total / (pagination.limit || 20)) : 1;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Full Backup Runs</h1>
        <Link
          href="/ops/backups/new"
          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium"
        >
          New Backup
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => changeFilter(s)}
            className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted border-border'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !runs.length ? (
        <p className="text-muted-foreground">No runs found.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">ID</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Started</th>
                <th className="px-4 py-2 text-left font-medium">Finished</th>
                <th className="px-4 py-2 text-left font-medium">Size</th>
                <th className="px-4 py-2 text-left font-medium">Artifact</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{run.id.slice(0, 8)}…</td>
                  <td className="px-4 py-2">{run.type}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[run.status] ?? 'bg-gray-100'}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtTime(run.startedAt)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtTime(run.finishedAt)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtBytes(run.artifactSizeBytes)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-[160px]" title={run.artifactPath ?? ''}>
                    {run.artifactPath ? run.artifactPath.slice(-30) : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/ops/logs?runId=${run.id}`} className="text-xs text-primary hover:underline">
                      Logs
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 items-center justify-end">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
