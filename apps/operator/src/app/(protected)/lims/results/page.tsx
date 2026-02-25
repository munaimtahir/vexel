'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, EmptyState, SkeletonPage, DataTable } from '@/components/app';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Tab = 'pending' | 'submitted' | 'verified';

function patientAge(p: any): string {
  if (!p) return '';
  if (p.ageYears != null) return `${p.ageYears}`;
  if (p.dateOfBirth) {
    const diff = Date.now() - new Date(p.dateOfBirth).getTime();
    return `${Math.floor(diff / (365.25 * 24 * 3600 * 1000))}`;
  }
  return '';
}

function patientLabel(p: any): string {
  if (!p) return '—';
  const age = patientAge(p);
  const gender = p.gender ? p.gender.toString().charAt(0).toUpperCase() : '';
  return `${age}${gender}`;
}

export default function ResultsWorklistPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pending');  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      if (tab === 'pending') {
        // @ts-ignore
        const { data, error: apiErr } = await api.GET('/results/tests/pending', {
          params: { query: search ? { search } : {} },
        });
        if (apiErr) { setError('Failed to load'); return; }
        setRows((data as any)?.data ?? []);
      } else {
        // submitted tab shows both submitted (awaiting verification) and verified tests
        // @ts-ignore
        const { data, error: apiErr } = await api.GET('/results/tests/submitted', {
          params: { query: search ? { search } : {} },
        });
        if (apiErr) { setError('Failed to load'); return; }
        setRows((data as any)?.data ?? []);
      }
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <PageHeader title="Results" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">Pending entry</TabsTrigger>
          <TabsTrigger value="submitted">Submitted / Verified</TabsTrigger>
        </TabsList>
      </Tabs>

      <Input
        placeholder="Search by name, MRN, order ID or test name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm mb-4"
      />

      {loading && <SkeletonPage />}
      {error && <p className="text-destructive">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <EmptyState title={tab === 'pending' ? 'No pending tests' : 'No submitted tests'} />
      )}

      {!loading && !error && rows.length > 0 && (
        <DataTable
          data={rows}
          keyExtractor={(row: any) => row.id}
          columns={[
            {
              key: 'time',
              header: 'Time',
              cell: (row: any) => (
                <span className="text-muted-foreground text-sm">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                </span>
              ),
            },
            {
              key: 'patient',
              header: 'Patient',
              cell: (row: any) => row.patient ? (
                <div>
                  <div className="font-semibold text-foreground text-sm">
                    {row.patient.firstName} {row.patient.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.patient.mrn} · {patientLabel(row.patient)}
                  </div>
                </div>
              ) : <span className="text-muted-foreground">—</span>,
            },
            {
              key: 'orderId',
              header: 'Order ID',
              cell: (row: any) => (
                <span className="font-mono text-sm text-muted-foreground">
                  {row.encounterCode ?? row.encounterId?.slice(0, 8) ?? '—'}
                </span>
              ),
            },
            {
              key: 'testName',
              header: 'Test name',
              cell: (row: any) => (
                <span className="font-medium text-foreground">{row.testName}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (row: any) => {
                const s = row.resultStatus;
                const labStatus = row.labOrderStatus;
                const isVerified = labStatus === 'verified';
                return (
                  <span className={
                    isVerified
                      ? 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700'
                      : s === 'SUBMITTED'
                        ? 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))]'
                        : 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))]'
                  }>
                    {isVerified ? 'Verified' : s}
                  </span>
                );
              },
            },
            {
              key: 'action',
              header: 'Action',
              cell: (row: any) => (
                <Button size="sm" onClick={() => router.push(`/lims/results/${row.id}`)}>
                  {tab === 'pending' ? 'Enter results' : 'View / Add missing'}
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
