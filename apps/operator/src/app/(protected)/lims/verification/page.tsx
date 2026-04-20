'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { EmptyState, PageHeader, SkeletonPage, WorkflowEncounterCard, type WorkflowTestChip } from '@/components/app';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type VerificationRow = {
  encounterId: string;
  encounterCode?: string | null;
  submittedTestsCount: number;
  oldestSubmittedAt?: string | null;
  createdAt: string;
  patient?: {
    firstName: string;
    lastName: string;
    mrn: string;
    ageYears?: number | null;
    dateOfBirth?: string | null;
    gender?: string | null;
  };
};

type VerificationDetail = {
  submittedTestsCount?: number;
  pendingVerificationCount?: number;
  testCards?: Array<{
    labOrderId: string;
    testName: string;
    resultStatus: 'SUBMITTED' | 'VERIFIED';
    filledParameters?: Array<{ flag?: 'normal' | 'high' | 'low' | 'critical' | null }>;
  }>;
};

type EncounterCard = VerificationRow & {
  patientName: string;
  ageGender: string;
};

function ageLabel(p?: VerificationRow['patient']): string {
  if (!p) return '—';
  if (p.ageYears != null) return `${p.ageYears}y`;
  if (!p.dateOfBirth) return '—';
  const years = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years}y`;
}

function genderLabel(p?: VerificationRow['patient']): string {
  return p?.gender ? p.gender.charAt(0).toUpperCase() : '—';
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString([], { day: '2-digit', month: 'short' })}`;
}

function columnFromDetails(detail: VerificationDetail): 'waiting' | 'flagged' | 'verified' {
  const cards = detail.testCards ?? [];
  if (cards.length > 0 && cards.every((c) => c.resultStatus === 'VERIFIED')) return 'verified';
  const hasFlag = cards.some((c) => (c.filledParameters ?? []).some((p) => p.flag && p.flag !== 'normal'));
  if (hasFlag) return 'flagged';
  return 'waiting';
}

export default function VerificationBoardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [details, setDetails] = useState<Record<string, VerificationDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiErr } = await api.GET('/verification/encounters/pending', {
        params: { query: { search: search || undefined, limit: 120, view: 'pending' } },
      });
      if (apiErr || !data) throw new Error('queue');
      const queue: VerificationRow[] = Array.isArray((data as any).data)
        ? (data as any).data
        : (Array.isArray(data) ? (data as any) : []);
      setRows(queue);

      const detailPairs = await Promise.all(
        queue.map(async (q) => {
          const { data: detailData } = await api.GET('/verification/encounters/{encounterId}', {
            params: { path: { encounterId: q.encounterId } },
          });
          return [q.encounterId, (detailData as VerificationDetail) ?? {}] as const;
        }),
      );
      setDetails(Object.fromEntries(detailPairs));
    } catch {
      setError('Failed to load verification board');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const encounters: EncounterCard[] = useMemo(
    () => rows.map((r) => ({
      ...r,
      patientName: r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '—',
      ageGender: `${ageLabel(r.patient)} / ${genderLabel(r.patient)}`,
    })),
    [rows],
  );

  const testTypes = useMemo(() => {
    const set = new Set<string>();
    Object.values(details).forEach((d) => (d.testCards ?? []).forEach((c) => set.add(c.testName)));
    return Array.from(set).sort();
  }, [details]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    return Array.from(set);
  }, []);

  const filtered = useMemo(() => {
    return encounters.filter((enc) => {
      const d = details[enc.encounterId];
      if (filterType !== 'all' && !(d?.testCards ?? []).some((t) => t.testName === filterType)) return false;
      if (filterDept !== 'all') return false;
      return true;
    });
  }, [encounters, details, filterType, filterDept]);

  const columns = useMemo(() => {
    const col = { waiting: [] as EncounterCard[], flagged: [] as EncounterCard[], verified: [] as EncounterCard[] };
    for (const enc of filtered) {
      const mapped = columnFromDetails(details[enc.encounterId] ?? {});
      col[mapped].push(enc);
    }
    return col;
  }, [filtered, details]);

  const verify = async (encounterId: string) => {
    setBusy((b) => ({ ...b, [encounterId]: true }));
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiErr } = await api.POST('/verification/encounters/{encounterId}:verify', {
        params: { path: { encounterId } },
      });
      if (apiErr) throw new Error('verify');
      await load();
    } catch {
      setError('Verification command failed');
    } finally {
      setBusy((b) => ({ ...b, [encounterId]: false }));
    }
  };

  const verifyAndGenerate = async (encounterId: string) => {
    await verify(encounterId);
  };

  const returnForCorrection = async (encounterId: string) => {
    setBusy((b) => ({ ...b, [encounterId]: true }));
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiErr } = await api.POST('/verification/encounters/{encounterId}:return-for-correction', {
        params: { path: { encounterId } },
        body: {},
      });
      if (apiErr) throw new Error('return');
      await load();
    } catch {
      setError('Return-for-correction command failed');
    } finally {
      setBusy((b) => ({ ...b, [encounterId]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Verification Board"
        description="Card-based workflow: Waiting → Flagged/Needs Review → Verified"
        actions={<Button onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>}
      />

      <div className="sticky top-0 z-20 bg-background border border-border rounded-lg p-3 grid gap-3 md:grid-cols-4">
        <Input
          placeholder="Search name / MR / mobile"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger><SelectValue placeholder="Test type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All test types</SelectItem>
            {testTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground self-center">
          Encounters: {filtered.length}
        </div>
      </div>

      {loading && <SkeletonPage />}
      {error && <p className="text-destructive text-sm">{error}</p>}
      {!loading && !error && filtered.length === 0 && <EmptyState title="No verification encounters" />}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-3">
          {[
            { key: 'waiting', title: `Waiting (${columns.waiting.length})` },
            { key: 'flagged', title: `Flagged / Needs Review (${columns.flagged.length})` },
            { key: 'verified', title: `Verified (${columns.verified.length})` },
          ].map((col) => (
            <section key={col.key} className="space-y-3">
              <h2 className="text-sm font-semibold">{col.title}</h2>
              <div className="grid gap-3">
                {(col.key === 'waiting' ? columns.waiting : col.key === 'flagged' ? columns.flagged : columns.verified).map((enc) => {
                  const d = details[enc.encounterId] ?? {};
                  const chips: WorkflowTestChip[] = (d.testCards ?? []).map((t) => ({
                    id: t.labOrderId,
                    label: t.testName,
                    status:
                      t.resultStatus === 'VERIFIED'
                        ? 'verified'
                        : (t.filledParameters ?? []).some((p) => p.flag && p.flag !== 'normal')
                          ? 'flagged'
                          : 'completed',
                  }));
                  const completed = chips.filter((c) => c.status === 'verified' || c.status === 'completed').length;
                  const pending = chips.length - completed;
                  return (
                    <WorkflowEncounterCard
                      key={enc.encounterId}
                      patientName={enc.patientName}
                      ageGender={enc.ageGender}
                      mrn={enc.patient?.mrn ?? '—'}
                      encounterCode={enc.encounterCode ?? enc.encounterId.slice(0, 8)}
                      timeLabel={timeLabel(enc.oldestSubmittedAt ?? enc.createdAt)}
                      tests={chips}
                      totalTests={chips.length}
                      completedTests={completed}
                      pendingTests={pending}
                      actions={[
                        {
                          label: 'Open Verification',
                          variant: 'outline',
                          onClick: () => router.push(`/lims/verification/encounters/${enc.encounterId}`),
                        },
                        {
                          label: 'View Flagged Results',
                          variant: 'secondary',
                          onClick: () => router.push(`/lims/verification/encounters/${enc.encounterId}`),
                        },
                        {
                          label: 'Verify',
                          onClick: () => void verify(enc.encounterId),
                          loading: !!busy[enc.encounterId],
                        },
                        {
                          label: 'Verify + Generate',
                          variant: 'default',
                          onClick: () => void verifyAndGenerate(enc.encounterId),
                          loading: !!busy[enc.encounterId],
                        },
                        {
                          label: 'Return for Correction',
                          variant: 'destructive',
                          onClick: () => void returnForCorrection(enc.encounterId),
                          loading: !!busy[enc.encounterId],
                        },
                      ]}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
