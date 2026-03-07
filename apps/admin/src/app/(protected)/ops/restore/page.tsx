'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Run = {
  id: string;
  type: string;
  status: string;
  artifactPath?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  metaJson?: Record<string, any> | null;
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

export default function RestorePage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [dryRunResult, setDryRunResult] = useState<Run | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [preSnapshot, setPreSnapshot] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [runningRestore, setRunningRestore] = useState<Run | null>(null);

  async function load() {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const [fullRes, allRes] = await Promise.allSettled([
      api.GET('/ops/runs', { params: { query: { type: 'FULL', status: 'SUCCEEDED', limit: 20 } as any } }),
      api.GET('/ops/runs', { params: { query: { type: 'RESTORE', limit: 5 } as any } }),
    ]);
    if (fullRes.status === 'fulfilled') setRuns((fullRes.value.data as any)?.data ?? []);
    if (allRes.status === 'fulfilled') {
      const latest = ((allRes.value.data as any)?.data ?? []).find((r: Run) => r.status === 'RUNNING');
      setRunningRestore(latest ?? null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runDryRun() {
    if (!selectedRun?.artifactPath) return;
    setActionLoading(true);
    setError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data } = await api.POST('/ops/restores/full:dryRun', {
        body: { artifactPath: selectedRun.artifactPath },
      });
      const runId = (data as any)?.runId;
      if (runId) {
        // Poll until finished
        let attempt = 0;
        let run: Run | null = null;
        while (attempt < 30) {
          await new Promise((r) => setTimeout(r, 2000));
          const r = await api.GET('/ops/runs/{id}' as any, { params: { path: { id: runId } } });
          run = (r.data as any) as Run;
          if (run?.status === 'SUCCEEDED' || run?.status === 'FAILED') break;
          attempt++;
        }
        setDryRunResult(run);
        if (run?.status === 'SUCCEEDED') setStep(3);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Dry run failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function applyRestore() {
    if (!selectedRun?.artifactPath || confirmPhrase !== 'yes-restore') return;
    setActionLoading(true);
    setError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      await api.POST('/ops/restores/full:run', {
        body: {
          artifactPath: selectedRun.artifactPath,
          confirmPhrase: 'yes-restore',
          preSnapshotEnabled: preSnapshot,
          mode: 'APPLY',
        },
      });
      setToast('Restore queued — monitor logs');
      setTimeout(() => setToast(null), 4000);
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Restore failed to start');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

      {/* Danger banner */}
      <div className="bg-red-50 border border-red-300 rounded-lg p-4">
        <p className="text-red-700 font-bold text-sm">⚠ DANGER ZONE — RESTORE CENTER</p>
        <p className="text-red-600 text-xs mt-1">
          Applying a restore will overwrite the current database and object storage. A pre-restore
          snapshot will be taken automatically unless disabled. Restore remains blocked unless the
          server is explicitly started with <span className="font-mono">VEXEL_ALLOW_RESTORE=true</span>.
        </p>
      </div>

      {/* Running restore indicator */}
      {runningRestore && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 text-sm text-blue-800">
          🔄 Restore currently running — Run ID: <span className="font-mono">{runningRestore.id.slice(0, 8)}…</span>
          <a href={`/ops/logs?runId=${runningRestore.id}`} className="ml-2 underline">
            View logs
          </a>
        </div>
      )}

      <h1 className="text-2xl font-bold">Restore Center</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          {/* Step 1 */}
          <div className={`border rounded-lg p-4 space-y-3 ${step === 1 ? '' : 'opacity-60'}`}>
            <h2 className="font-semibold">Step 1 — Select Backup Artifact</h2>
            {!runs.length ? (
              <p className="text-sm text-muted-foreground">No succeeded full backups available.</p>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <label
                    key={run.id}
                    className={`flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-muted/30 ${
                      selectedRun?.id === run.id ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="artifact"
                      checked={selectedRun?.id === run.id}
                      onChange={() => { setSelectedRun(run); setStep(2); setDryRunResult(null); }}
                    />
                    <div className="text-sm">
                      <span className="font-mono">{run.id.slice(0, 8)}…</span>
                      <span className="ml-3 text-muted-foreground">{fmtTime(run.finishedAt)}</span>
                      <span className="ml-3 text-xs font-mono text-muted-foreground truncate max-w-xs">
                        {run.artifactPath}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Step 2 — Dry run */}
          {step >= 2 && selectedRun && (
            <div className="border rounded-lg p-4 space-y-3">
              <h2 className="font-semibold">Step 2 — Dry Run</h2>
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-mono">{selectedRun.artifactPath}</span>
              </p>
              <button
                onClick={runDryRun}
                disabled={actionLoading}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded text-sm font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Running dry run…' : 'Run Dry Run'}
              </button>
              {dryRunResult && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium">
                    Dry run{' '}
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[dryRunResult.status] ?? ''}`}>
                      {dryRunResult.status}
                    </span>
                  </p>
                  {dryRunResult.metaJson && (
                    <pre className="text-xs font-mono bg-muted p-3 rounded overflow-auto max-h-40">
                      {JSON.stringify(dryRunResult.metaJson, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Apply */}
          {step === 3 && (
            <div className="border-2 border-red-300 rounded-lg p-4 space-y-4 bg-red-50/50">
              <h2 className="font-semibold text-red-700">Step 3 — Apply Restore</h2>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preSnapshot}
                  onChange={(e) => setPreSnapshot(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Take pre-restore snapshot (recommended)</span>
              </label>

              <div className="space-y-1">
                <label className="text-sm font-medium text-red-700">
                  Type <span className="font-mono bg-red-100 px-1">yes-restore</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="yes-restore"
                  className="border rounded px-3 py-2 text-sm bg-background w-full max-w-xs"
                />
              </div>

              <button
                onClick={applyRestore}
                disabled={actionLoading || confirmPhrase !== 'yes-restore'}
                className="px-5 py-2 bg-red-600 text-white rounded text-sm font-medium disabled:opacity-40 hover:bg-red-700"
              >
                {actionLoading ? 'Starting restore…' : 'Apply Restore'}
              </button>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
