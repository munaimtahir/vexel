'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { EncounterStatusBadge } from '@/components/status-badge';
import { DataTable, type DataTableColumn } from '@vexel/ui-system';

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
        if (apiError || !data) {
          setError('Failed to load encounters');
          return;
        }
        setEncounters((data as any).data ?? []);
        setPagination((data as any).pagination ?? null);
      })
      .catch(() => setError('Failed to load encounters'))
      .finally(() => setLoading(false));
  }, []);

  const columns = useMemo<DataTableColumn<any>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        cell: (enc) => <span className="text-xs text-muted-foreground font-mono">{enc.id.slice(0, 8)}…</span>,
      },
      {
        key: 'patient',
        header: 'Patient',
        cell: (enc) => (
          <span className="text-sm text-foreground font-medium">
            {enc.patient ? `${enc.patient.firstName} ${enc.patient.lastName}` : enc.patientId.slice(0, 8)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        cell: (enc) => <EncounterStatusBadge status={enc.status} />,
      },
      {
        key: 'createdAt',
        header: 'Created',
        cell: (enc) => <span className="text-sm text-muted-foreground">{new Date(enc.createdAt).toLocaleDateString()}</span>,
      },
    ],
    [],
  );

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
        <DataTable
          columns={columns}
          data={encounters}
          keyExtractor={(enc) => enc.id}
          onRowClick={(enc) => router.push(`/lims/encounters/${enc.id}`)}
        />
      )}
    </div>
  );
}
