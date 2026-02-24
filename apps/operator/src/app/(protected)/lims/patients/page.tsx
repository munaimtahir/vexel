'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, DataTable, EmptyState } from '@/components/app';
import { Button } from '@/components/ui/button';

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/patients')
      .then(({ data, error: apiError }) => {
        if (apiError || !data) { setError('Failed to load patients'); return; }
        setPatients((data as any).data ?? []);
        setPagination((data as any).pagination ?? null);
      })
      .catch(() => setError('Failed to load patients'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Patients"
        description={pagination ? `${pagination.total} total` : undefined}
        actions={
          <Button asChild>
            <Link href="/lims/patients/new">+ New Patient</Link>
          </Button>
        }
      />

      {loading && <p className="text-muted-foreground">Loading patients...</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && patients.length === 0 && (
        <EmptyState title="No patients yet" />
      )}

      {!loading && patients.length > 0 && (
        <DataTable
          data={patients}
          keyExtractor={(p: any) => p.id}
          columns={[
            { key: 'mrn', header: 'MRN', cell: (p: any) => <span className="font-mono text-sm text-muted-foreground">{p.mrn}</span> },
            { key: 'name', header: 'Name', cell: (p: any) => <span className="font-medium text-foreground">{p.firstName} {p.lastName}</span> },
            { key: 'dob', header: 'DOB', cell: (p: any) => <span className="text-muted-foreground text-sm">{p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : '—'}</span> },
            { key: 'gender', header: 'Gender', cell: (p: any) => <span className="text-muted-foreground text-sm">{p.gender ?? '—'}</span> },
            { key: 'created', header: 'Created', cell: (p: any) => <span className="text-muted-foreground text-sm">{new Date(p.createdAt).toLocaleDateString()}</span> },
          ]}
        />
      )}
    </div>
  );
}
