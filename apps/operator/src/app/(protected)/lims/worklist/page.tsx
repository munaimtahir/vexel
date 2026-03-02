'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/use-current-user';
import { PageHeader, SectionCard, DataTable, EmptyState } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type SortDirection = 'asc' | 'desc';

function minutesSince(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

function fmtSla(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function sortBySla<T extends { slaMinutes: number }>(rows: T[], direction: SortDirection): T[] {
  const sorted = [...rows].sort((a, b) => b.slaMinutes - a.slaMinutes);
  return direction === 'desc' ? sorted : sorted.reverse();
}

export default function OperatorQueueDashboardPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sorts, setSorts] = useState<Record<string, SortDirection>>({
    assigned: 'desc',
    results: 'desc',
    verify: 'desc',
    failedDocs: 'desc',
    published: 'desc',
  });

  const [assignedRows, setAssignedRows] = useState<any[]>([]);
  const [resultsRows, setResultsRows] = useState<any[]>([]);
  const [verifyRows, setVerifyRows] = useState<any[]>([]);
  const [failedDocs, setFailedDocs] = useState<any[]>([]);
  const [publishedToday, setPublishedToday] = useState<any[]>([]);

  const toggleSort = (key: string) =>
    setSorts((prev) => ({ ...prev, [key]: prev[key] === 'desc' ? 'asc' : 'desc' }));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [resultsRes, verifyRes, failedRes, publishedRes, encounterRes] = await Promise.all([
        api.GET('/results/tests/pending', { params: { query: { limit: 100 } as any } }),
        api.GET('/verification/encounters/pending', { params: { query: { limit: 100, view: 'pending' as any } as any } }),
        api.GET('/documents' as any, { params: { query: { status: 'FAILED', docType: 'LAB_REPORT', limit: 100 } } }),
        api.GET('/documents' as any, { params: { query: { status: 'PUBLISHED', docType: 'LAB_REPORT', fromDate: startOfToday.toISOString(), limit: 100 } } }),
        api.GET('/encounters' as any, { params: { query: { limit: 100 } } }),
      ]);

      const pendingTests: any[] = (resultsRes.data as any)?.data ?? [];
      const verifyQueue: any[] = (verifyRes.data as any)?.data ?? [];
      const failed: any[] = Array.isArray(failedRes.data) ? failedRes.data : ((failedRes.data as any)?.data ?? []);
      const published: any[] = Array.isArray(publishedRes.data) ? publishedRes.data : ((publishedRes.data as any)?.data ?? []);
      const encounters: any[] = (encounterRes.data as any)?.data ?? [];

      const resultRows = pendingTests.map((r: any) => ({
        id: r.id,
        encounterId: r.encounterId,
        patientName: r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '—',
        mrn: r.patient?.mrn ?? '—',
        testName: r.testName ?? r.testNameSnapshot ?? '—',
        slaMinutes: minutesSince(r.createdAt ?? r.submittedAt),
      }));
      setResultsRows(resultRows);

      const verifyRowsMapped = verifyQueue.map((r: any) => ({
        id: r.encounterId,
        encounterId: r.encounterId,
        encounterCode: r.encounterCode ?? '—',
        patientName: r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '—',
        submittedTestsCount: r.submittedTestsCount ?? 0,
        slaMinutes: minutesSince(r.oldestSubmittedAt ?? r.createdAt),
      }));
      setVerifyRows(verifyRowsMapped);

      const failedRows = failed.map((d: any) => ({
        id: d.id,
        encounterId: d.encounterId ?? d.sourceRef ?? '—',
        createdAt: d.createdAt,
        slaMinutes: minutesSince(d.createdAt),
        reason: d.errorMessage ?? d.errorSummary ?? 'Render failed',
      }));
      setFailedDocs(failedRows);

      const publishedRows = published.map((d: any) => ({
        id: d.id,
        encounterId: d.encounterId ?? d.sourceRef ?? '—',
        publishedAt: d.publishedAt ?? d.createdAt,
        slaMinutes: minutesSince(d.publishedAt ?? d.createdAt),
      }));
      setPublishedToday(publishedRows);

      const assigned = encounters
        .filter((e: any) => {
          const assignee = e.assignedToUserId ?? e.assigneeId ?? e.assignedUserId ?? e.createdByUserId;
          if (!user?.userId || !assignee) return false;
          return assignee === user.userId;
        })
        .map((e: any) => ({
          id: e.id,
          encounterId: e.id,
          encounterCode: e.encounterCode ?? e.refNumber ?? e.id.slice(0, 8),
          status: e.status ?? '—',
          patientName: e.patient ? `${e.patient.firstName} ${e.patient.lastName}` : '—',
          slaMinutes: minutesSince(e.createdAt),
        }));
      setAssignedRows(assigned);
    } catch {
      setError('Failed to load operator queues');
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedAssigned = useMemo(() => sortBySla(assignedRows, sorts.assigned), [assignedRows, sorts.assigned]);
  const sortedResults = useMemo(() => sortBySla(resultsRows, sorts.results), [resultsRows, sorts.results]);
  const sortedVerify = useMemo(() => sortBySla(verifyRows, sorts.verify), [verifyRows, sorts.verify]);
  const sortedFailedDocs = useMemo(() => sortBySla(failedDocs, sorts.failedDocs), [failedDocs, sorts.failedDocs]);
  const sortedPublished = useMemo(() => sortBySla(publishedToday, sorts.published), [publishedToday, sorts.published]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Operator Work Queue"
        description="Prioritized by SLA time"
        actions={<Button onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>}
      />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <SectionCard title="My Assigned">
        {sortedAssigned.length === 0 ? (
          <EmptyState title="No directly assigned encounters" description="Assignments appear here when encounter assignee metadata is present." />
        ) : (
          <DataTable
            data={sortedAssigned}
            keyExtractor={(r) => r.id}
            columns={[
              { key: 'enc', header: 'Encounter', cell: (r) => <span className="font-mono text-xs">{r.encounterCode}</span> },
              { key: 'patient', header: 'Patient', cell: (r) => r.patientName },
              { key: 'status', header: 'Status', cell: (r) => <Badge variant="outline">{r.status}</Badge> },
              {
                key: 'sla',
                header: <button className="text-xs font-semibold" onClick={() => toggleSort('assigned')}>SLA {sorts.assigned === 'desc' ? '↓' : '↑'}</button>,
                cell: (r) => <span className="font-mono text-xs">{fmtSla(r.slaMinutes)}</span>,
                numeric: true,
              },
              {
                key: 'act',
                header: '',
                cell: (r) => <Button size="sm" onClick={() => router.push(`/lims/encounters/${r.encounterId}`)}>Open</Button>,
              },
            ]}
          />
        )}
      </SectionCard>

      <SectionCard title="Awaiting Results Entry">
        <DataTable
          data={sortedResults}
          keyExtractor={(r) => r.id}
          emptyMessage="No tests awaiting result entry"
          columns={[
            { key: 'patient', header: 'Patient', cell: (r) => <div><div className="font-medium">{r.patientName}</div><div className="text-xs text-muted-foreground">{r.mrn}</div></div> },
            { key: 'test', header: 'Test', cell: (r) => r.testName },
            {
              key: 'sla',
              header: <button className="text-xs font-semibold" onClick={() => toggleSort('results')}>SLA {sorts.results === 'desc' ? '↓' : '↑'}</button>,
              cell: (r) => <span className="font-mono text-xs">{fmtSla(r.slaMinutes)}</span>,
              numeric: true,
            },
            { key: 'act', header: '', cell: (r) => <Button size="sm" onClick={() => router.push(`/lims/results/${r.id}`)}>Enter</Button> },
          ]}
        />
      </SectionCard>

      <SectionCard title="Awaiting Verification">
        <DataTable
          data={sortedVerify}
          keyExtractor={(r) => r.id}
          emptyMessage="No encounters awaiting verification"
          columns={[
            { key: 'enc', header: 'Encounter', cell: (r) => <span className="font-mono text-xs">{r.encounterCode}</span> },
            { key: 'patient', header: 'Patient', cell: (r) => r.patientName },
            { key: 'tests', header: 'Tests', cell: (r) => <Badge variant="secondary">{r.submittedTestsCount}</Badge>, numeric: true },
            {
              key: 'sla',
              header: <button className="text-xs font-semibold" onClick={() => toggleSort('verify')}>SLA {sorts.verify === 'desc' ? '↓' : '↑'}</button>,
              cell: (r) => <span className="font-mono text-xs">{fmtSla(r.slaMinutes)}</span>,
              numeric: true,
            },
            { key: 'act', header: '', cell: (r) => <Button size="sm" onClick={() => router.push(`/lims/verification/encounters/${r.encounterId}`)}>Verify</Button> },
          ]}
        />
      </SectionCard>

      <SectionCard title="Failed Documents">
        <DataTable
          data={sortedFailedDocs}
          keyExtractor={(r) => r.id}
          emptyMessage="No failed documents"
          columns={[
            { key: 'enc', header: 'Encounter', cell: (r) => <span className="font-mono text-xs">{String(r.encounterId).slice(0, 12)}</span> },
            { key: 'reason', header: 'Failure', cell: (r) => <span className="text-xs text-destructive">{r.reason}</span> },
            {
              key: 'sla',
              header: <button className="text-xs font-semibold" onClick={() => toggleSort('failedDocs')}>SLA {sorts.failedDocs === 'desc' ? '↓' : '↑'}</button>,
              cell: (r) => <span className="font-mono text-xs">{fmtSla(r.slaMinutes)}</span>,
              numeric: true,
            },
            { key: 'act', header: '', cell: (r) => <Button size="sm" onClick={() => router.push(`/lims/encounters/${r.encounterId}/publish`)}>Open</Button> },
          ]}
        />
      </SectionCard>

      <SectionCard title="Today Published">
        <DataTable
          data={sortedPublished}
          keyExtractor={(r) => r.id}
          emptyMessage="No reports published today"
          columns={[
            { key: 'enc', header: 'Encounter', cell: (r) => <span className="font-mono text-xs">{String(r.encounterId).slice(0, 12)}</span> },
            { key: 'publishedAt', header: 'Published At', cell: (r) => new Date(r.publishedAt).toLocaleString() },
            {
              key: 'sla',
              header: <button className="text-xs font-semibold" onClick={() => toggleSort('published')}>SLA {sorts.published === 'desc' ? '↓' : '↑'}</button>,
              cell: (r) => <span className="font-mono text-xs">{fmtSla(r.slaMinutes)}</span>,
              numeric: true,
            },
            { key: 'act', header: '', cell: (r) => <Button size="sm" onClick={() => router.push(`/lims/print/${r.id}`)}>Print</Button> },
          ]}
        />
      </SectionCard>
    </div>
  );
}

