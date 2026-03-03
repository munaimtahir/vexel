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
};

type Dashboard = {
  lastFullBackup?: Run | null;
  lastHealthcheck?: Run | null;
  recentRuns: Run[];
  storageTargets: { id: string }[];
};

const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  QUEUED: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

function fmtBytes(n?: number | null) {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTime(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString();
}

export default function OpsDashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/ops/dashboard');
    setDashboard(data as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runBackup() {
    setActionLoading('backup');
    const api = getApiClient(getToken() ?? undefined);
    await api.POST('/ops/backups/full:run', {
      body: { includeDb: true, includeMinio: true, includeEnv: true, includeCaddy: true, passphraseMode: 'SERVER_MANAGED' },
    });
    setToast('Full backup queued');
    setActionLoading(null);
    setTimeout(() => setToast(null), 3000);
    load();
  }

  async function runHealthcheck() {
    setActionLoading('healthcheck');
    const api = getApiClient(getToken() ?? undefined);
    await api.POST('/ops/healthcheck:run', {});
    setToast('Healthcheck queued');
    setActionLoading(null);
    setTimeout(() => setToast(null), 3000);
    load();
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading ops dashboard…</div>;

  const lb = dashboard?.lastFullBackup;
  const lh = dashboard?.lastHealthcheck;

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ops Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={runBackup}
            disabled={actionLoading === 'backup'}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50"
          >
            {actionLoading === 'backup' ? 'Starting…' : 'Run Full Backup'}
          </button>
          <button
            onClick={runHealthcheck}
            disabled={actionLoading === 'healthcheck'}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded text-sm font-medium disabled:opacity-50"
          >
            {actionLoading === 'healthcheck' ? 'Starting…' : 'Run Healthcheck'}
          </button>
          <Link
            href="/ops/tenants"
            className="px-4 py-2 border rounded text-sm font-medium hover:bg-muted"
          >
            Export Tenant
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Last Full Backup</p>
          {lb ? (
            <>
              <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[lb.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {lb.status}
              </span>
              <p className="text-sm">{fmtTime(lb.finishedAt ?? lb.startedAt)}</p>
              <p className="text-xs text-muted-foreground">{fmtBytes(lb.artifactSizeBytes)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No backup yet</p>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Last Healthcheck</p>
          {lh ? (
            <>
              <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[lh.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {lh.status}
              </span>
              <p className="text-sm">{fmtTime(lh.finishedAt ?? lh.startedAt)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No healthcheck yet</p>
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Storage Targets</p>
          <p className="text-2xl font-bold">{dashboard?.storageTargets?.length ?? 0}</p>
          <Link href="/ops/storage" className="text-xs text-primary hover:underline">
            Manage targets →
          </Link>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        {[
          { href: '/ops/backups', label: 'Backup Runs' },
          { href: '/ops/restore', label: 'Restore Center' },
          { href: '/ops/schedules', label: 'Schedules' },
          { href: '/ops/storage', label: 'Storage Targets' },
          { href: '/ops/logs', label: 'Logs' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-3 py-1.5 border rounded text-sm hover:bg-muted transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* Recent runs */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Runs</h2>
        {!dashboard?.recentRuns?.length ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Started</th>
                  <th className="px-4 py-2 text-left font-medium">Size</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.recentRuns ?? []).slice(0, 5).map((run) => (
                  <tr key={run.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{run.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2">{run.type}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[run.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtTime(run.startedAt)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmtBytes(run.artifactSizeBytes)}</td>
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
