'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, EmptyState, SkeletonPage, DataTable } from '@/components/app';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Tab = 'pending' | 'submitted';

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

/** Group flat test rows by encounterId, returning one row per encounter */
function groupByEncounter(rows: any[]): any[] {
  const map = new Map<string, any>();
  for (const row of rows) {
    const key = row.encounterId;
    if (!map.has(key)) {
      map.set(key, {
        encounterId: key,
        encounterCode: row.encounterCode,
        patient: row.patient,
        createdAt: row.createdAt,
        tests: [],
      });
    }
    map.get(key).tests.push(row);
  }
  return Array.from(map.values());
}

export default function ResultsWorklistPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
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

  const encounters = groupByEncounter(rows);

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
        placeholder="Search by name, MRN, order ID…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm mb-4"
      />

      {loading && <SkeletonPage />}
      {error && <p className="text-destructive">{error}</p>}

      {!loading && !error && encounters.length === 0 && (
        <EmptyState title={tab === 'pending' ? 'No patients with pending tests' : 'No submitted tests'} />
      )}

      {!loading && !error && encounters.length > 0 && (
        <DataTable
          data={encounters}
          keyExtractor={(enc: any) => enc.encounterId}
          columns={[
            {
              key: 'time',
              header: 'Time',
              cell: (enc: any) => (
                <span className="text-muted-foreground text-sm">
                  {enc.createdAt ? new Date(enc.createdAt).toLocaleString() : '—'}
                </span>
              ),
            },
            {
              key: 'patient',
              header: 'Patient',
              cell: (enc: any) => enc.patient ? (
                <div>
                  <div className="font-semibold text-foreground text-sm">
                    {enc.patient.firstName} {enc.patient.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {enc.patient.mrn} · {patientLabel(enc.patient)}
                  </div>
                </div>
              ) : <span className="text-muted-foreground">—</span>,
            },
            {
              key: 'orderId',
              header: 'Order ID',
              cell: (enc: any) => (
                <span className="font-mono text-sm text-muted-foreground">
                  {enc.encounterCode ?? enc.encounterId?.slice(0, 8) ?? '—'}
                </span>
              ),
            },
            {
              key: 'tests',
              header: 'Tests',
              cell: (enc: any) => (
                <div className="flex flex-wrap gap-1">
                  {enc.tests.map((t: any) => {
                    const isVerified = t.labOrderStatus === 'verified';
                    const isSubmitted = t.resultStatus === 'SUBMITTED';
                    return (
                      <Badge
                        key={t.id}
                        variant="outline"
                        className={
                          isVerified
                            ? 'bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))] border-[hsl(var(--status-success-border))] text-xs'
                            : isSubmitted
                              ? 'bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))] border-transparent text-xs'
                              : 'bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))] border-transparent text-xs'
                        }
                      >
                        {t.testName}
                      </Badge>
                    );
                  })}
                </div>
              ),
            },
            {
              key: 'action',
              header: '',
              cell: (enc: any) => (
                <Button
                  size="sm"
                  onClick={() => router.push(`/lims/results/encounters/${enc.encounterId}`)}
                >
                  {tab === 'pending' ? 'Enter results' : 'View results'}
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
