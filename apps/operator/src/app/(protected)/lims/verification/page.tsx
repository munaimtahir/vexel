'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/use-current-user';
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
  const [selectedEncounterIds, setSelectedEncounterIds] = useState<Set<string>>(new Set());
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [toast, setToast] = useState('');
  const { user } = useCurrentUser();
  const canBulkVerify = Boolean(user?.isSuperAdmin || user?.permissions?.includes('result.verify'));

  const load = async (q: string, view: 'pending' | 'verified_today') => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiErr } = await api.GET('/verification/encounters/pending', {
        params: { query: { search: q || undefined, limit: 50, view } },
      });
      if (apiErr || !data) { setError('Failed to load verification queue'); return; }
      const list: VerificationSummary[] = Array.isArray((data as any).data)
        ? (data as any).data
        : Array.isArray(data) ? data : [];
      setQueue(list);
      setSelectedEncounterIds(new Set());
    } catch {
      setError('Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const view = tab === 'verified' ? 'verified_today' : 'pending';
    load(search, view);
  }, [tab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const view = tab === 'verified' ? 'verified_today' : 'pending';
    load(search, view);
  };

  const bulkVerify = async () => {
    if (!canBulkVerify || bulkVerifying || selectedEncounterIds.size === 0) return;
    setBulkVerifying(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const ids = Array.from(selectedEncounterIds);
      const settled = await Promise.allSettled(
        ids.map((encounterId) =>
          api.POST('/verification/encounters/{encounterId}:verify', {
            params: { path: { encounterId } },
          }),
        ),
      );
      const ok = settled.filter((r) => r.status === 'fulfilled' && !(r.value as any).error).length;
      const fail = settled.length - ok;
      setToast(fail > 0 ? `Bulk verification completed (${ok} success, ${fail} failed)` : `Bulk verification completed (${ok})`);
      const view = tab === 'verified' ? 'verified_today' : 'pending';
      await load(search, view);
    } finally {
      setBulkVerifying(false);
      setTimeout(() => setToast(''), 2500);
    }
  };

  return (
    <div>
      <PageHeader title="Verification" />
      {toast && (
        <div className="mb-3 rounded-md border border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-bg))] px-3 py-2 text-sm text-[hsl(var(--status-success-fg))]">
          {toast}
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'pending' | 'verified')} className="mb-5">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="verified">Verified today</TabsTrigger>
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
        {tab === 'pending' && canBulkVerify && (
          <Button
            type="button"
            onClick={bulkVerify}
            disabled={bulkVerifying || selectedEncounterIds.size === 0}
          >
            {bulkVerifying ? 'Verifying…' : `Bulk Verify (${selectedEncounterIds.size})`}
          </Button>
        )}
      </form>

      {loading && <p className="text-muted-foreground text-sm">Loading...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {!loading && !error && (
        queue.length === 0 ? (
          <EmptyState title={tab === 'verified' ? 'No patients verified today' : 'No patients pending verification'} />
        ) : (
          <DataTable
            data={queue}
            keyExtractor={(row) => row.encounterId}
            columns={[
              {
                key: 'select',
                header: (
                  tab === 'pending' ? (
                    <input
                      type="checkbox"
                      checked={queue.length > 0 && selectedEncounterIds.size === queue.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedEncounterIds(new Set(queue.map((q) => q.encounterId)));
                        else setSelectedEncounterIds(new Set());
                      }}
                    />
                  ) : null
                ),
                cell: (row) =>
                  tab === 'pending' ? (
                    <input
                      type="checkbox"
                      checked={selectedEncounterIds.has(row.encounterId)}
                      onChange={() =>
                        setSelectedEncounterIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.encounterId)) next.delete(row.encounterId);
                          else next.add(row.encounterId);
                          return next;
                        })
                      }
                    />
                  ) : null,
              },
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
                  <Badge variant="secondary" className="bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))]">
                    {row.submittedTestsCount} test{row.submittedTestsCount !== 1 ? 's' : ''}
                  </Badge>
                ),
              },
              {
                key: 'action',
                header: 'Action',
                cell: (row) => (
                  <Button size="sm" onClick={() => router.push(`/lims/verification/encounters/${row.encounterId}`)}>
                    {tab === 'verified' ? 'Open patient' : 'Verify patient'}
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
