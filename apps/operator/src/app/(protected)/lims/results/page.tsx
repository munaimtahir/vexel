'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { EmptyState, PageHeader, SkeletonPage, WorkflowEncounterCard, type WorkflowTestChip } from '@/components/app';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Row = {
  id: string;
  encounterId: string;
  encounterCode?: string | null;
  testName: string;
  resultStatus: 'PENDING' | 'SUBMITTED';
  labOrderStatus?: string;
  filledCount?: number;
  totalCount?: number;
  createdAt: string;
  submittedAt?: string | null;
  specimenStatus?: string | null;
  patient?: {
    firstName: string;
    lastName: string;
    mrn: string;
    ageYears?: number | null;
    dateOfBirth?: string | null;
    gender?: string | null;
  };
};

type EncounterCard = {
  encounterId: string;
  encounterCode: string;
  patientName: string;
  ageGender: string;
  mrn: string;
  createdAt: string;
  tests: Row[];
  department?: string | null;
  priority?: string | null;
};

function ageLabel(p?: Row['patient']): string {
  if (!p) return '—';
  if (p.ageYears != null) return `${p.ageYears}y`;
  if (!p.dateOfBirth) return '—';
  const years = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years}y`;
}

function genderLabel(p?: Row['patient']): string {
  return p?.gender ? p.gender.charAt(0).toUpperCase() : '—';
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString([], { day: '2-digit', month: 'short' })}`;
}

function mapTestStatus(row: Row): WorkflowTestChip['status'] {
  const hasAny = (row.filledCount ?? 0) > 0;
  const allDone = (row.totalCount ?? 0) > 0 && (row.filledCount ?? 0) >= (row.totalCount ?? 0);
  if ((row.labOrderStatus ?? '').toLowerCase() === 'verified') return 'verified';
  if (row.resultStatus === 'SUBMITTED') return 'completed';
  if (allDone) return 'completed';
  if (hasAny) return 'in-progress';
  return 'pending';
}

function mapBoardColumn(rows: Row[]): 'pending' | 'in-progress' | 'ready' {
  const statuses = rows.map(mapTestStatus);
  if (statuses.every((s) => s === 'completed' || s === 'verified')) return 'ready';
  if (statuses.some((s) => s === 'in-progress' || s === 'completed')) return 'in-progress';
  return 'pending';
}

function group(rows: Row[]): EncounterCard[] {
  const map = new Map<string, EncounterCard>();
  for (const row of rows) {
    if (!map.has(row.encounterId)) {
      const p = row.patient;
      map.set(row.encounterId, {
        encounterId: row.encounterId,
        encounterCode: row.encounterCode ?? row.encounterId.slice(0, 8),
        patientName: p ? `${p.firstName} ${p.lastName}` : '—',
        ageGender: `${ageLabel(p)} / ${genderLabel(p)}`,
        mrn: p?.mrn ?? '—',
        createdAt: row.createdAt,
        tests: [],
      });
    }
    map.get(row.encounterId)!.tests.push(row);
  }
  return Array.from(map.values());
}

export default function ResultsBoardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const [pendingRes, submittedRes] = await Promise.all([
        api.GET('/results/tests/pending', { params: { query: { search: search || undefined, limit: 200 } } }),
        api.GET('/results/tests/submitted', { params: { query: { search: search || undefined, limit: 200 } } }),
      ]);
      const pending = ((pendingRes.data as any)?.data ?? []) as Row[];
      const submitted = ((submittedRes.data as any)?.data ?? []) as Row[];
      setRows([...pending, ...submitted]);
    } catch {
      setError('Failed to load results board');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const encounters = useMemo(() => group(rows), [rows]);

  const testTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.testName));
    return Array.from(set).sort();
  }, [rows]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    encounters.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [encounters]);

  const filtered = useMemo(() => {
    return encounters.filter((enc) => {
      if (filterType !== 'all' && !enc.tests.some((t) => t.testName === filterType)) return false;
      if (filterDept !== 'all' && enc.department !== filterDept) return false;
      return true;
    });
  }, [encounters, filterType, filterDept]);

  const columns = useMemo(() => {
    const col = {
      pending: [] as EncounterCard[],
      'in-progress': [] as EncounterCard[],
      ready: [] as EncounterCard[],
    };
    for (const enc of filtered) {
      const mapped = mapBoardColumn(enc.tests);
      if (mapped === 'pending') col.pending.push(enc);
      else if (mapped === 'in-progress') col['in-progress'].push(enc);
      else col.ready.push(enc);
    }
    return col;
  }, [filtered]);

  const markReady = async (encounterId: string) => {
    const target = filtered.find((e) => e.encounterId === encounterId);
    if (!target) return;
    setSubmitting((s) => ({ ...s, [encounterId]: true }));
    try {
      const api = getApiClient(getToken() ?? undefined);
      for (const t of target.tests.filter((x) => x.resultStatus !== 'SUBMITTED')) {
        const { error: submitErr } = await api.POST('/results/tests/{orderedTestId}:submit', {
          params: { path: { orderedTestId: t.id } },
          body: {},
        });
        if (submitErr) throw new Error('submit failed');
      }
      await load();
    } catch {
      setError('Unable to mark ready for verification');
    } finally {
      setSubmitting((s) => ({ ...s, [encounterId]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Result Entry Board"
        description="Card-based workflow: Pending → In Progress → Ready for Verification"
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
      {!loading && !error && filtered.length === 0 && <EmptyState title="No result-entry encounters" />}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-3">
          {[
            { key: 'pending', title: `Pending (${columns.pending.length})` },
            { key: 'in-progress', title: `In Progress (${columns['in-progress'].length})` },
            { key: 'ready', title: `Ready for Verification (${columns.ready.length})` },
          ].map((col) => (
            <section key={col.key} className="space-y-3">
              <h2 className="text-sm font-semibold">{col.title}</h2>
              <div className="grid gap-3">
                {(col.key === 'pending' ? columns.pending : col.key === 'in-progress' ? columns['in-progress'] : columns.ready).map((enc) => {
                  const chips: WorkflowTestChip[] = enc.tests.map((t) => ({
                    id: t.id,
                    label: t.testName,
                    status: mapTestStatus(t),
                  }));
                  const completed = chips.filter((c) => c.status === 'completed' || c.status === 'verified').length;
                  const pendingCount = chips.length - completed;
                  const openTest = enc.tests.find((t) => t.resultStatus !== 'SUBMITTED') ?? enc.tests[0];
                  return (
                    <WorkflowEncounterCard
                      key={enc.encounterId}
                      patientName={enc.patientName}
                      ageGender={enc.ageGender}
                      mrn={enc.mrn}
                      encounterCode={enc.encounterCode}
                      timeLabel={timeLabel(enc.createdAt)}
                      tests={chips}
                      totalTests={chips.length}
                      completedTests={completed}
                      pendingTests={pendingCount}
                      actions={[
                        {
                          label: 'Open Result Entry',
                          variant: 'outline',
                          onClick: () => router.push(`/lims/results/${openTest.id}`),
                        },
                        {
                          label: drafts.has(enc.encounterId) ? 'Continue Draft' : 'Save Draft',
                          variant: 'secondary',
                          onClick: () => setDrafts((d) => new Set(d).add(enc.encounterId)),
                        },
                        {
                          label: 'Mark Ready for Verification',
                          onClick: () => void markReady(enc.encounterId),
                          loading: !!submitting[enc.encounterId],
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
