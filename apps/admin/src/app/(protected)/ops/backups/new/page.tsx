'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type StorageTarget = { id: string; name: string; type: string; isEnabled: boolean };

export default function NewBackupPage() {
  const router = useRouter();
  const [targets, setTargets] = useState<StorageTarget[]>([]);
  const [includeDb, setIncludeDb] = useState(true);
  const [includeMinio, setIncludeMinio] = useState(true);
  const [includeCaddy, setIncludeCaddy] = useState(true);
  const [storageTargetId, setStorageTargetId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTargets() {
      const api = getApiClient(getToken() ?? undefined);
      const { data } = await api.GET('/ops/storage-targets');
      const list = (data as any)?.data ?? [];
      setTargets(list.filter((t: StorageTarget) => t.isEnabled));
      if (list.length > 0) setStorageTargetId(list[0].id);
    }
    loadTargets();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      await api.POST('/ops/backups/full:run', {
        body: {
          includeDb,
          includeMinio,
          includeEnv: true,
          includeCaddy,
          passphraseMode: 'SERVER_MANAGED',
          storageTargetId: storageTargetId || null,
        },
      });
      router.push('/ops/backups');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to start backup');
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New Full Backup</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="border rounded-lg p-4 space-y-3">
          <legend className="text-sm font-semibold px-1">Include</legend>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDb}
              onChange={(e) => setIncludeDb(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Database (PostgreSQL dump)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeMinio}
              onChange={(e) => setIncludeMinio(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Object Storage (MinIO)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCaddy}
              onChange={(e) => setIncludeCaddy(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Caddy config</span>
          </label>
        </fieldset>

        <div className="space-y-2">
          <label className="text-sm font-medium">Storage Target</label>
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No enabled storage targets.{' '}
              <a href="/ops/storage" className="text-primary hover:underline">
                Add one →
              </a>
            </p>
          ) : (
            <select
              value={storageTargetId}
              onChange={(e) => setStorageTargetId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm bg-background"
            >
              <option value="">— Use default —</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type})
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Starting…' : 'Run Backup'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2 border rounded text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
