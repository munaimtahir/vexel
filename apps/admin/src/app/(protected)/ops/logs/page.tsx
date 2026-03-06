'use client';
import { useEffect, useRef, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Run = {
  id: string;
  type: string;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
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

export default function LogsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);

  async function loadRuns() {
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/ops/runs', { params: { query: { limit: 30 } as any } });
    setRuns((data as any)?.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadRuns();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function loadLogs(run: Run) {
    setLogLoading(true);
    setLogLines([]);
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/ops/runs/{id}/logs' as any, { params: { path: { id: run.id } } });
    setLogLines((data as any)?.lines ?? []);
    setLogLoading(false);
    setTimeout(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }

  function selectRun(run: Run) {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setSelectedRun(run);
    loadLogs(run);

    if (run.status === 'RUNNING') {
      pollRef.current = setInterval(async () => {
        const api = getApiClient(getToken() ?? undefined);
        const [runRes, logRes] = await Promise.allSettled([
          api.GET('/ops/runs/{id}' as any, { params: { path: { id: run.id } } }),
          api.GET('/ops/runs/{id}/logs' as any, { params: { path: { id: run.id } } }),
        ]);
        if (logRes.status === 'fulfilled') {
          setLogLines((logRes.value.data as any)?.lines ?? []);
          setTimeout(() => {
            logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
          }, 50);
        }
        if (runRes.status === 'fulfilled') {
          const updated = runRes.value.data as any;
          if (updated?.status !== 'RUNNING') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setSelectedRun(updated);
            setRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }
        }
      }, 3000);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Logs Viewer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 180px)' }}>
        {/* Run list */}
        <div className="border rounded-lg overflow-y-auto">
          <div className="bg-muted/50 px-4 py-2 font-medium text-sm sticky top-0">
            Recent Runs
          </div>
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : !runs.length ? (
            <p className="p-4 text-sm text-muted-foreground">No runs.</p>
          ) : (
            <ul>
              {runs.map((run) => (
                <li key={run.id}>
                  <button
                    onClick={() => selectRun(run)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-muted/30 transition-colors ${
                      selectedRun?.id === run.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[run.status] ?? 'bg-gray-100'}`}
                      >
                        {run.status}
                      </span>
                      {run.status === 'RUNNING' && (
                        <span className="text-xs text-blue-600 animate-pulse">● live</span>
                      )}
                    </div>
                    <p className="text-xs font-medium mt-1">{run.type}</p>
                    <p className="text-xs text-muted-foreground font-mono">{run.id.slice(0, 12)}…</p>
                    <p className="text-xs text-muted-foreground">{fmtTime(run.startedAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Log viewer */}
        <div className="lg:col-span-2 border rounded-lg flex flex-col overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 font-medium text-sm flex items-center gap-2 shrink-0">
            {selectedRun ? (
              <>
                <span>{selectedRun.type}</span>
                <span className="font-mono text-xs text-muted-foreground">{selectedRun.id}</span>
                <span
                  className={`inline-block text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[selectedRun.status] ?? 'bg-gray-100'}`}
                >
                  {selectedRun.status}
                </span>
                {selectedRun.status === 'RUNNING' && (
                  <span className="text-xs text-blue-600 animate-pulse">● polling</span>
                )}
              </>
            ) : (
              'Select a run to view logs'
            )}
          </div>
          <pre
            ref={logRef}
            className="flex-1 overflow-auto p-4 text-xs font-mono bg-background leading-relaxed whitespace-pre-wrap break-all"
          >
            {logLoading ? (
              'Loading logs…'
            ) : !selectedRun ? (
              '← Select a run from the list'
            ) : !logLines.length ? (
              'No log lines available.'
            ) : (
              logLines.join('\n')
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
