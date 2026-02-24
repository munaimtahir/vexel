'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { EncounterStatusBadge } from '@/components/status-badge';

export default function EncountersPage() {
  const router = useRouter();
  const [encounters, setEncounters] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/encounters')
      .then(({ data, error: apiError }) => {
        if (apiError || !data) { setError('Failed to load encounters'); return; }
        setEncounters((data as any).data ?? []);
        setPagination((data as any).pagination ?? null);
      })
      .catch(() => setError('Failed to load encounters'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Encounters</h2>
          {pagination && <p className="text-muted-foreground mt-1 text-sm">{pagination.total} total</p>}
        </div>
        <Link
          href="/lims/encounters/new"
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          + New Encounter
        </Link>
      </div>

      {loading && <p className="text-muted-foreground">Loading encounters…</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && encounters.length === 0 && (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground text-base">No encounters yet.</p>
          <Link href="/lims/encounters/new" className="text-primary hover:underline">Register the first encounter →</Link>
        </div>
      )}

      {!loading && encounters.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {['ID', 'Patient', 'Status', 'Created'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {encounters.map((enc: any) => (
                <tr
                  key={enc.id}
                  className="border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => router.push(`/lims/encounters/${enc.id}`)}
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{enc.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-sm text-foreground font-medium">
                    {enc.patient ? `${enc.patient.firstName} ${enc.patient.lastName}` : enc.patientId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3"><EncounterStatusBadge status={enc.status} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(enc.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
