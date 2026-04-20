'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable, EmptyState, ErrorState, PageHeader, SectionCard, SkeletonPage } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

type Status = '' | 'DRAFT' | 'READY_FOR_PRINT' | 'COMPLETED' | 'CANCELLED';
type Row = {
  id: string;
  patientId: string;
  doctorId: string;
  status: Exclude<Status, ''>;
  visitCode: string;
  chiefComplaint?: string | null;
  createdAt: string;
};

const LIMIT = 20;

export default function OpdEncountersPage() {
  const { flags, loading: flagsLoading } = useFeatureFlags();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const opdEnabled = Boolean(flags['module.opd']);

  useEffect(() => {
    if (flagsLoading || !opdEnabled) {
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const api = getApiClient(getToken() ?? undefined);
        const query: Record<string, unknown> = { page, limit: LIMIT };
        if (search.trim()) query.search = search.trim();
        if (status) query.status = status;
        const { data, error: apiError } = await api.GET('/opd/encounters', { params: { query } });
        if (!active) return;
        if (apiError || !data) {
          setError('Failed to load OPD encounters');
          setRows([]);
          return;
        }
        const list = ((data as any).data ?? []) as Row[];
        const total = Number((data as any)?.pagination?.total ?? list.length);
        setRows(list);
        setHasMore(page * LIMIT < total);
      } catch {
        if (active) {
          setError('Failed to load OPD encounters');
          setRows([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [flagsLoading, opdEnabled, page, search, status]);

  const counts = useMemo(() => {
    const completed = rows.filter((r) => r.status === 'COMPLETED').length;
    const ready = rows.filter((r) => r.status === 'READY_FOR_PRINT').length;
    const draft = rows.filter((r) => r.status === 'DRAFT').length;
    return { completed, ready, draft };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="OPD Encounters"
        description="Command-driven OPD workflow: registration, intake, and prescription publish."
        actions={
          <Button asChild>
            <Link href="/opd/encounters/new">New OPD Registration</Link>
          </Button>
        }
      />

      {!opdEnabled && !flagsLoading ? (
        <ErrorState title="OPD module disabled" message="Enable `module.opd` for this tenant to use OPD encounters." />
      ) : null}

      <SectionCard title="Filters">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Search by visit code"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={status || '__all__'}
            onValueChange={(value) => {
              setStatus(value === '__all__' ? '' : (value as Status));
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              <SelectItem value="DRAFT">DRAFT</SelectItem>
              <SelectItem value="READY_FOR_PRINT">READY_FOR_PRINT</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-border bg-muted p-2 text-center">
              <p className="font-semibold text-foreground">{counts.draft}</p>
              <p className="text-muted-foreground">Draft</p>
            </div>
            <div className="rounded-md border border-border bg-muted p-2 text-center">
              <p className="font-semibold text-foreground">{counts.ready}</p>
              <p className="text-muted-foreground">Ready</p>
            </div>
            <div className="rounded-md border border-border bg-muted p-2 text-center">
              <p className="font-semibold text-foreground">{counts.completed}</p>
              <p className="text-muted-foreground">Completed</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Encounter Worklist">
        {loading ? <SkeletonPage /> : null}
        {!loading && error ? <ErrorState title="Failed to load encounters" message={error} /> : null}
        {!loading && !error && rows.length === 0 ? <EmptyState title="No OPD encounters found" /> : null}
        {!loading && !error && rows.length > 0 ? (
          <>
            <DataTable
              data={rows}
              keyExtractor={(row) => row.id}
              columns={[
                { key: 'visitCode', header: 'Visit Code', cell: (row) => row.visitCode },
                { key: 'status', header: 'Status', cell: (row) => row.status },
                { key: 'patientId', header: 'Patient ID', cell: (row) => <span className="font-mono text-xs">{row.patientId}</span> },
                { key: 'doctorId', header: 'Doctor ID', cell: (row) => <span className="font-mono text-xs">{row.doctorId}</span> },
                { key: 'chiefComplaint', header: 'Chief Complaint', cell: (row) => row.chiefComplaint || '—' },
                {
                  key: 'createdAt',
                  header: 'Created',
                  cell: (row) => new Date(row.createdAt).toLocaleString(),
                },
                {
                  key: 'action',
                  header: 'Action',
                  cell: (row) => (
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/opd/encounters/${row.id}/intake`}>Intake</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/opd/encounters/${row.id}/doctor`}>Doctor</Link>
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button variant="outline" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </>
        ) : null}
      </SectionCard>
    </div>
  );
}
