'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function OpdProviderDetailPage() {
  const params = useParams<{ providerId: string }>();
  const providerId = params?.providerId ?? '';
  const [provider, setProvider] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!providerId) return;
      setLoading(true);
      setError('');
      try {
        const api = getApiClient(getToken() ?? undefined);
        const { data, error: apiError } = await api.GET('/opd/providers/{providerId}' as any, {
          params: { path: { providerId } },
        });
        if (!active) return;
        if (apiError || !data) {
          setError('Failed to load provider');
          return;
        }
        setProvider(data as any);
      } catch {
        if (active) setError('Failed to load provider');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [providerId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opd/providers" className="text-primary">← OPD Providers</Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">OPD Provider Detail</h1>
        <p className="mt-2 text-sm text-muted-foreground">Read-only provider detail loaded from the OPD provider detail endpoint.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading provider...</p>
        ) : error ? (
          <p className="text-sm text-[hsl(var(--status-destructive-fg))]">{error}</p>
        ) : !provider ? (
          <p className="text-sm text-muted-foreground">Provider not found.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div><span className="text-muted-foreground">ID:</span> <code>{provider.id}</code></div>
            <div><span className="text-muted-foreground">Code:</span> {provider.code ?? '—'}</div>
            <div><span className="text-muted-foreground">Name:</span> {provider.name ?? '—'}</div>
            <div><span className="text-muted-foreground">Title:</span> {provider.title ?? '—'}</div>
            <div><span className="text-muted-foreground">Specialty:</span> {provider.specialty ?? '—'}</div>
            <div><span className="text-muted-foreground">Active:</span> {provider.isActive ? 'Yes' : 'No'}</div>
            <div><span className="text-muted-foreground">Created:</span> {provider.createdAt ? new Date(provider.createdAt).toLocaleString() : '—'}</div>
            <div><span className="text-muted-foreground">Updated:</span> {provider.updatedAt ? new Date(provider.updatedAt).toLocaleString() : '—'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
