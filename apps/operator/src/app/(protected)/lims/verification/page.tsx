'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, EmptyState, DataTable } from '@/components/app';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type VerificationSummary = {
  encounterId: string;
  encounterCode?: string | null;
  submittedTestsCount: number;
  oldestSubmittedAt?: string | null;
  createdAt: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth?: string | null;
    ageYears?: number | null;
    gender?: string | null;
  };
};

function calcAge(dob?: string | null, ageYears?: number | null): string {
  if (ageYears != null) return `${ageYears}y`;
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years}y`;
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' +
    d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function VerificationPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<VerificationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'pending' | 'verified'>('pending');

  const load = async (q: string) => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiErr } = await api.GET('/verification/encounters/pending', {
        params: { query: { search: q || undefined, limit: 50 } },
      });
      if (apiErr || !data) { setError('Failed to load verification queue'); return; }
      const list: VerificationSummary[] = Array.isArray((data as any).data)
        ? (data as any).data
        : Array.isArray(data) ? data : [];
      setQueue(list);
    } catch {
      setError('Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(search); }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(search); };

  return (
    <div>
      <PageHeader title="Verification" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'pending' | 'verified')} className="mb-5">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="verified" disabled>Verified today</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <Input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by patient name or MRN..."
          className="max-w-sm"
        />
        <Button type="submit">Search</Button>
      </form>

      {loading && <p className="text-muted-foreground text-sm">Loading...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {!loading && !error && (
        queue.length === 0 ? (
          <EmptyState title="No patients pending verification" />
        ) : (
          <DataTable
            data={queue}
            keyExtractor={(row) => row.encounterId}
            columns={[
              {
                key: 'time',
                header: 'Time',
                cell: (row) => (
                  <span className="text-muted-foreground text-sm whitespace-nowrap">
                    {fmtTime(row.oldestSubmittedAt ?? row.createdAt)}
                  </span>
                ),
              },
              {
                key: 'patient',
                header: 'Patient',
                cell: (row) => {
                  const p = row.patient;
                  const age = p ? calcAge(p.dateOfBirth, p.ageYears) : '—';
                  const sex = p?.gender ? p.gender.charAt(0).toUpperCase() : '—';
                  return p ? (
                    <div>
                      <div className="font-semibold text-foreground">{p.firstName} {p.lastName}</div>
                      <div className="text-xs text-muted-foreground">MRN: {p.mrn} · {age}/{sex}</div>
                    </div>
                  ) : <span className="text-muted-foreground">—</span>;
                },
              },
              {
                key: 'orderId',
                header: 'Order ID',
                cell: (row) => (
                  <span className="font-mono text-sm text-muted-foreground">{row.encounterCode ?? '—'}</span>
                ),
              },
              {
                key: 'tests',
                header: 'Tests',
                cell: (row) => (
                  <Badge variant="secondary" className="bg-amber-50 text-amber-800">
                    {row.submittedTestsCount} test{row.submittedTestsCount !== 1 ? 's' : ''}
                  </Badge>
                ),
              },
              {
                key: 'action',
                header: 'Action',
                cell: (row) => (
                  <Button size="sm" onClick={() => router.push(`/lims/verification/encounters/${row.encounterId}`)}>
                    Verify patient
                  </Button>
                ),
              },
            ]}
          />
        )
      )}
    </div>
  );
}
