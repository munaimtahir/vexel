'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { EncounterStatusBadge, DueBadge, SkeletonPage, EmptyState, DataTable, PageHeader } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LIMIT = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'registered', label: 'Registered' },
  { value: 'lab_ordered', label: 'Ordered' },
  { value: 'specimen_collected', label: 'Collected' },
  { value: 'specimen_received', label: 'Received' },
  { value: 'resulted', label: 'Resulted' },
  { value: 'verified', label: 'Verified' },
  { value: 'cancelled', label: 'Cancelled' },
];

function nextActionLink(enc: any): { text: string; href: string; disabled?: boolean } {
  switch (enc.status) {
    case 'registered':         return { text: 'Place Order', href: `/lims/encounters/${enc.id}/order` };
    case 'lab_ordered':        return { text: 'Collect Sample', href: `/lims/encounters/${enc.id}/sample` };
    case 'specimen_collected': return { text: 'Enter Results', href: `/lims/encounters/${enc.id}/results` };
    case 'specimen_received':  return { text: 'Enter Results', href: `/lims/encounters/${enc.id}/results` };
    case 'partial_resulted':   return { text: 'Enter Results', href: `/lims/encounters/${enc.id}/results` };
    case 'resulted':           return { text: 'Verify', href: `/lims/encounters/${enc.id}/verify` };
    case 'verified':           return { text: 'View Reports', href: `/lims/encounters/${enc.id}/reports` };
    case 'cancelled':          return { text: 'Cancelled', href: '#', disabled: true };
    default:                   return { text: 'View', href: `/lims/encounters/${enc.id}` };
  }
}

export default function WorklistPage() {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async (p: number, status: string) => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const query: any = { page: p, limit: LIMIT };
      if (status) query.status = status;
      const { data, error: apiErr } = await api.GET('/encounters', { params: { query } });
      if (apiErr || !data) { setError('Failed to load worklist'); return; }
      const list = Array.isArray(data) ? data : (data as any)?.data ?? [];
      const total = (data as any)?.total ?? list.length;
      setEncounters(list);
      setHasMore(p * LIMIT < total);
    } catch {
      setError('Failed to load worklist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page, statusFilter); }, [page, statusFilter]);

  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };

  return (
    <div>
      <PageHeader
        title="Worklist"
        actions={
          <Button asChild>
            <Link href="/lims/registrations/new">+ New Registration</Link>
          </Button>
        }
      />

      <div className="mb-4">
          <Select value={statusFilter === '' ? '__all__' : statusFilter} onValueChange={(v) => handleStatusChange(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value === '' ? '__all__' : o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-destructive mb-4">{error}</p>}

      {loading ? (
        <SkeletonPage />
      ) : encounters.length === 0 ? (
        <EmptyState title="No encounters found" />
      ) : (
        <DataTable
          data={encounters}
          keyExtractor={(enc: any) => enc.id}
          columns={[
            {
              key: 'date',
              header: 'Date/Time',
              cell: (enc: any) => (
                <span className="text-muted-foreground text-sm">
                  {enc.createdAt ? new Date(enc.createdAt).toLocaleString() : '—'}
                </span>
              ),
            },
            {
              key: 'patient',
              header: 'Patient',
              cell: (enc: any) => {
                const p = enc.patient;
                const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : enc.patientId ?? '—';
                return (
                  <div>
                    <div className="font-medium text-foreground">{name}</div>
                    {p?.mrn && <div className="text-xs text-muted-foreground">MRN: {p.mrn}</div>}
                  </div>
                );
              },
            },
            {
              key: 'encounterCode',
              header: 'Encounter ID',
              cell: (enc: any) => (
                <Link href={`/lims/encounters/${enc.id}`} className="font-mono text-primary text-sm underline">
                  {enc.encounterCode ?? enc.id?.slice(0, 8)}
                </Link>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (enc: any) => (
                <div className="flex items-center gap-1.5">
                  <EncounterStatusBadge status={enc.status} />
                  <DueBadge amount={enc.labOrders?.find((o: any) => Number(o.dueAmount) > 0)?.dueAmount} />
                </div>
              ),
            },
            {
              key: 'action',
              header: 'Next Action',
              cell: (enc: any) => {
                const action = nextActionLink(enc);
                return action.disabled ? (
                  <Button variant="ghost" size="sm" disabled>{action.text}</Button>
                ) : (
                  <Button asChild size="sm">
                    <Link href={action.href}>{action.text}</Link>
                  </Button>
                );
              },
            },
          ]}
        />
      )}

      {!loading && (
        <div className="flex gap-3 justify-end items-center mt-4">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            ← Prev
          </Button>
          <span className="text-sm text-muted-foreground px-2">Page {page}</span>
          <Button variant="outline" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
