'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { DataTable, EmptyState, PageHeader, SectionCard, SkeletonPage } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LIMIT = 20;
type InvoiceStatus = '' | 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';

export default function OpdBillingPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('');
  const [appointmentId, setAppointmentId] = useState('');
  const [visitId, setVisitId] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setAppointmentId(searchParams.get('appointmentId') ?? '');
    setVisitId(searchParams.get('visitId') ?? '');
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const api = getApiClient(getToken() ?? undefined);
        const query: Record<string, unknown> = { page, limit: LIMIT };
        if (search.trim()) query.search = search.trim();
        if (status) query.status = status;
        if (appointmentId.trim()) query.appointmentId = appointmentId.trim();
        if (visitId.trim()) query.visitId = visitId.trim();
        const { data, error: apiError } = await api.GET('/opd/billing/invoices' as any, { params: { query } });
        if (!active) return;
        if (apiError || !data) {
          setError('Failed to load OPD invoices');
          return;
        }
        const list = (data as any)?.data ?? [];
        const total = (data as any)?.pagination?.total ?? list.length;
        setRows(list);
        setHasMore(page * LIMIT < total);
      } catch {
        if (active) setError('Failed to load OPD invoices');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [page, search, status, appointmentId, visitId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="OPD Billing"
        description="Invoice list and cash collection workflow entry"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/opd/worklist">Worklist</Link>
            </Button>
            <Button asChild>
              <Link href={`/opd/billing/new${appointmentId ? `?appointmentId=${encodeURIComponent(appointmentId)}` : visitId ? `?visitId=${encodeURIComponent(visitId)}` : ''}`}>New Invoice</Link>
            </Button>
          </div>
        }
      />

      <SectionCard title="Filters">
        <div className="grid gap-3 md:grid-cols-5">
          <Input
            value={search}
            placeholder="Search invoice/patient"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={status || '__all__'}
            onValueChange={(value) => {
              setStatus(value === '__all__' ? '' : (value as InvoiceStatus));
              setPage(1);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ISSUED">Issued</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="VOID">Void</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={appointmentId}
            placeholder="Filter by appointmentId"
            onChange={(e) => {
              setAppointmentId(e.target.value);
              setPage(1);
            }}
          />
          <Input
            value={visitId}
            placeholder="Filter by visitId"
            onChange={(e) => {
              setVisitId(e.target.value);
              setPage(1);
            }}
          />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPage(1)}>Refresh</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Invoices">
        {loading ? (
          <SkeletonPage />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No invoices found" />
        ) : (
          <>
            <DataTable
              data={rows}
              keyExtractor={(row: any) => row.id}
              columns={[
                { key: 'invoiceNumber', header: 'Invoice', cell: (row: any) => row.invoiceNumber ?? row.id?.slice(0, 8) ?? '—' },
                { key: 'patientId', header: 'Patient', cell: (row: any) => <code className="text-xs">{row.patientId ?? '—'}</code> },
                { key: 'visitId', header: 'Visit', cell: (row: any) => <code className="text-xs">{row.visitId ?? '—'}</code> },
                { key: 'appointmentId', header: 'Appointment', cell: (row: any) => <code className="text-xs">{row.appointmentId ?? '—'}</code> },
                { key: 'status', header: 'Status', cell: (row: any) => row.status ?? '—' },
                { key: 'grandTotal', header: 'Total', cell: (row: any) => `${row.currency ?? 'PKR'} ${row.grandTotal ?? 0}` },
                { key: 'balanceDue', header: 'Balance', cell: (row: any) => `${row.currency ?? 'PKR'} ${row.balanceDue ?? 0}` },
                {
                  key: 'action',
                  header: 'Action',
                  cell: (row: any) => (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/opd/billing/invoices/${row.id}`}>Open</Link>
                    </Button>
                  ),
                },
              ]}
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button variant="outline" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
