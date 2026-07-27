'use client';
import { useCallback, useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard, EmptyState, SkeletonPage } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type TabKey = 'registrations' | 'worklist' | 'patient-history' | 'financial' | 'activity';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'registrations', label: 'Registrations' },
  { key: 'worklist', label: 'Worklist & Aging' },
  { key: 'patient-history', label: 'Patient History' },
  { key: 'financial', label: 'Financial' },
  { key: 'activity', label: 'Activity & Exceptions' },
];

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-sm text-foreground border-t border-border">{children}</td>;
}

function SimpleTable({ rows, columns, emptyLabel }: { rows: any[]; columns: { key: string; header: string; cell?: (r: any) => React.ReactNode }[]; emptyLabel: string }) {
  if (rows.length === 0) return <EmptyState title={emptyLabel} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>{columns.map((c) => <Th key={c.key}>{c.header}</Th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? r.labOrderId ?? i}>
              {columns.map((c) => <Td key={c.key}>{c.cell ? c.cell(r) : r[c.key]}</Td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OperationsReportsPage() {
  const [tab, setTab] = useState<TabKey>('registrations');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Registrations
  const [regFrom, setRegFrom] = useState('');
  const [regTo, setRegTo] = useState('');
  const [regData, setRegData] = useState<any>(null);

  // Worklist
  const [worklistData, setWorklistData] = useState<any>(null);

  // Patient history
  const [historyMrn, setHistoryMrn] = useState('');
  const [historyData, setHistoryData] = useState<any>(null);

  // Financial
  const [collectionDate, setCollectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [collectionData, setCollectionData] = useState<any>(null);
  const [duesData, setDuesData] = useState<any>(null);
  const [discountsData, setDiscountsData] = useState<any>(null);

  // Activity/Exceptions
  const [exceptionsData, setExceptionsData] = useState<any>(null);
  const [staffData, setStaffData] = useState<any>(null);

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const query: any = { limit: 100 };
      if (regFrom) query.from = new Date(regFrom).toISOString();
      if (regTo) query.to = new Date(regTo).toISOString();
      const { data, error: err } = await api.GET('/reports/registrations', { params: { query } });
      if (err) throw new Error('Failed to load registrations report');
      setRegData(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [regFrom, regTo]);

  const loadWorklist = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: err } = await api.GET('/reports/worklist-status', {});
      if (err) throw new Error('Failed to load worklist report');
      setWorklistData(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPatientHistory = useCallback(async () => {
    if (!historyMrn.trim()) return;
    setLoading(true);
    setError('');
    setHistoryData(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data: patients, error: perr } = await api.GET('/patients' as any, { params: { query: { mrn: historyMrn.trim(), limit: 1 } } });
      if (perr) throw new Error('Patient lookup failed');
      const found = (patients as any)?.data?.[0];
      if (!found) throw new Error(`No patient found for MRN ${historyMrn}`);
      const { data, error: err } = await api.GET('/reports/patient-history/{patientId}', { params: { path: { patientId: found.id } } });
      if (err) throw new Error('Failed to load patient history');
      setHistoryData(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [historyMrn]);

  const loadFinancial = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const [collRes, duesRes, discRes] = await Promise.all([
        api.GET('/reports/financial/daily-collection', { params: { query: { date: collectionDate } } }),
        api.GET('/reports/financial/outstanding-dues', {}),
        api.GET('/reports/financial/discounts', { params: { query: {} } }),
      ]);
      if (collRes.error || duesRes.error || discRes.error) throw new Error('Failed to load financial reports');
      setCollectionData(collRes.data);
      setDuesData(duesRes.data);
      setDiscountsData(discRes.data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [collectionDate]);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const [excRes, staffRes] = await Promise.all([
        api.GET('/reports/exceptions', { params: { query: {} } }),
        api.GET('/reports/staff-activity', { params: { query: {} } }),
      ]);
      if (excRes.error || staffRes.error) throw new Error('Failed to load activity reports');
      setExceptionsData(excRes.data);
      setStaffData(staffRes.data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'registrations') loadRegistrations();
    else if (tab === 'worklist') loadWorklist();
    else if (tab === 'financial') loadFinancial();
    else if (tab === 'activity') loadActivity();
  }, [tab, loadRegistrations, loadWorklist, loadFinancial, loadActivity]);

  return (
    <div>
      <PageHeader
        title="Operations Reports"
        description="Registration, worklist, patient history, financial and activity reports"
      />

      <div className="flex gap-1 border rounded-lg p-1 bg-muted/30 mb-4 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-destructive text-sm mb-3">{error}</p>}
      {loading && <SkeletonPage />}

      {!loading && tab === 'registrations' && (
        <SectionCard
          title="Date-Range Registrations"
          actions={(
            <div className="flex gap-2 items-center">
              <Input type="date" value={regFrom} onChange={(e) => setRegFrom(e.target.value)} className="w-40" />
              <Input type="date" value={regTo} onChange={(e) => setRegTo(e.target.value)} className="w-40" />
              <Button size="sm" variant="outline" onClick={loadRegistrations}>Apply</Button>
              <Button size="sm" onClick={() => regData?.data && downloadCsv('registrations.csv', regData.data)} disabled={!regData?.data?.length}>
                Export CSV
              </Button>
            </div>
          )}
        >
          {regData && (
            <>
              <div className="mb-3 flex flex-wrap gap-3">
                {regData.dailyCounts?.map((d: any) => (
                  <div key={d.date} className="px-3 py-1.5 rounded-lg bg-muted/40 text-sm">
                    {new Date(d.date).toLocaleDateString()}: <strong>{d.count}</strong>
                  </div>
                ))}
              </div>
              <SimpleTable
                emptyLabel="No registrations in this range"
                rows={regData.data ?? []}
                columns={[
                  { key: 'mrn', header: 'MRN' },
                  { key: 'name', header: 'Name', cell: (r) => `${r.firstName} ${r.lastName}` },
                  { key: 'gender', header: 'Gender' },
                  { key: 'mobile', header: 'Mobile' },
                  { key: 'createdAt', header: 'Registered', cell: (r) => new Date(r.createdAt).toLocaleString() },
                ]}
              />
            </>
          )}
        </SectionCard>
      )}

      {!loading && tab === 'worklist' && worklistData && (
        <div className="space-y-4">
          <SectionCard title="Status Counts">
            <div className="flex flex-wrap gap-3">
              {worklistData.statusCounts?.map((s: any) => (
                <div key={s.status} className="px-3 py-1.5 rounded-lg bg-muted/40 text-sm capitalize">
                  {s.status.replace('_', ' ')}: <strong>{s.count}</strong>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard
            title="Pending / Aging Worklist"
            actions={(
              <Button size="sm" onClick={() => downloadCsv('pending-worklist.csv', worklistData.pending)} disabled={!worklistData.pending?.length}>
                Export CSV
              </Button>
            )}
          >
            <SimpleTable
              emptyLabel="Nothing pending — worklist is clear"
              rows={worklistData.pending ?? []}
              columns={[
                { key: 'encounterCode', header: 'Encounter' },
                { key: 'patientName', header: 'Patient' },
                { key: 'mrn', header: 'MRN' },
                { key: 'testName', header: 'Test' },
                { key: 'status', header: 'Status' },
                { key: 'ageHours', header: 'Age', cell: (r) => `${r.ageHours}h` },
              ]}
            />
          </SectionCard>
        </div>
      )}

      {!loading && tab === 'patient-history' && (
        <SectionCard
          title="Patient Cumulative History"
          actions={(
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Enter MRN…"
                value={historyMrn}
                onChange={(e) => setHistoryMrn(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadPatientHistory()}
                className="w-48"
              />
              <Button size="sm" onClick={loadPatientHistory}>Search</Button>
            </div>
          )}
        >
          {!historyData && <EmptyState title="Search a patient by MRN to see their full history" />}
          {historyData && (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {historyData.patient.firstName} {historyData.patient.lastName} — MRN {historyData.patient.mrn} — {historyData.visitCount} visit(s)
              </p>
              <SimpleTable
                emptyLabel="No visits recorded"
                rows={historyData.encounters ?? []}
                columns={[
                  { key: 'encounterCode', header: 'Encounter' },
                  { key: 'status', header: 'Status' },
                  { key: 'labOrders', header: 'Tests', cell: (r) => r.labOrders.map((o: any) => o.testNameSnapshot).join(', ') || '—' },
                  { key: 'documents', header: 'Documents', cell: (r) => r.documents.map((d: any) => d.type).join(', ') || '—' },
                  { key: 'createdAt', header: 'Date', cell: (r) => new Date(r.createdAt).toLocaleString() },
                ]}
              />
            </>
          )}
        </SectionCard>
      )}

      {!loading && tab === 'financial' && (
        <div className="space-y-4">
          <SectionCard
            title="Daily Collection"
            actions={(
              <div className="flex gap-2 items-center">
                <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} className="w-40" />
                <Button size="sm" variant="outline" onClick={loadFinancial}>Apply</Button>
              </div>
            )}
          >
            {collectionData && (
              <>
                <p className="mb-2 text-sm">
                  Total collected: <strong>PKR {collectionData.total.toLocaleString()}</strong>
                </p>
                <div className="mb-3 flex flex-wrap gap-3">
                  {Object.entries(collectionData.byPaymentMode ?? {}).map(([mode, amt]: any) => (
                    <div key={mode} className="px-3 py-1.5 rounded-lg bg-muted/40 text-sm">
                      {mode}: <strong>PKR {Number(amt).toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
                <SimpleTable
                  emptyLabel="No collections on this date"
                  rows={collectionData.transactions ?? []}
                  columns={[
                    { key: 'encounterId', header: 'Encounter' },
                    { key: 'amount', header: 'Amount', cell: (r) => `PKR ${Number(r.amount).toLocaleString()}` },
                    { key: 'paymentMode', header: 'Mode' },
                    { key: 'actorName', header: 'Collected By' },
                    { key: 'createdAt', header: 'Time', cell: (r) => new Date(r.createdAt).toLocaleTimeString() },
                  ]}
                />
              </>
            )}
          </SectionCard>

          <SectionCard
            title="Outstanding Dues"
            actions={(
              <Button size="sm" onClick={() => downloadCsv('outstanding-dues.csv', duesData.data)} disabled={!duesData?.data?.length}>
                Export CSV
              </Button>
            )}
          >
            {duesData && (
              <>
                <p className="mb-2 text-sm">Total outstanding: <strong>PKR {duesData.totalDue.toLocaleString()}</strong></p>
                <SimpleTable
                  emptyLabel="No outstanding dues"
                  rows={duesData.data ?? []}
                  columns={[
                    { key: 'encounterCode', header: 'Encounter' },
                    { key: 'patientName', header: 'Patient' },
                    { key: 'mrn', header: 'MRN' },
                    { key: 'testName', header: 'Test' },
                    { key: 'dueAmount', header: 'Due', cell: (r) => `PKR ${Number(r.dueAmount ?? 0).toLocaleString()}` },
                  ]}
                />
              </>
            )}
          </SectionCard>

          <SectionCard
            title="Discounts Applied"
            actions={(
              <Button size="sm" onClick={() => downloadCsv('discounts.csv', discountsData.data)} disabled={!discountsData?.data?.length}>
                Export CSV
              </Button>
            )}
          >
            {discountsData && (
              <>
                <p className="mb-2 text-sm">Total discounted: <strong>PKR {discountsData.totalDiscounted.toLocaleString()}</strong></p>
                <SimpleTable
                  emptyLabel="No discounts recorded"
                  rows={discountsData.data ?? []}
                  columns={[
                    { key: 'patientName', header: 'Patient' },
                    { key: 'mrn', header: 'MRN' },
                    { key: 'amount', header: 'Amount', cell: (r) => `PKR ${Number(r.amount).toLocaleString()}` },
                    { key: 'reason', header: 'Reason' },
                    { key: 'actorName', header: 'Applied By' },
                    { key: 'createdAt', header: 'Date', cell: (r) => new Date(r.createdAt).toLocaleString() },
                  ]}
                />
              </>
            )}
          </SectionCard>
        </div>
      )}

      {!loading && tab === 'activity' && (
        <div className="space-y-4">
          <SectionCard
            title="Exceptions (Returns for Correction / Cancellations)"
            actions={(
              <Button size="sm" onClick={() => downloadCsv('exceptions.csv', exceptionsData.data)} disabled={!exceptionsData?.data?.length}>
                Export CSV
              </Button>
            )}
          >
            {exceptionsData && (
              <SimpleTable
                emptyLabel="No exceptions recorded"
                rows={exceptionsData.data ?? []}
                columns={[
                  { key: 'action', header: 'Action' },
                  { key: 'entityId', header: 'Entity' },
                  { key: 'actorName', header: 'Actor' },
                  { key: 'createdAt', header: 'Date', cell: (r) => new Date(r.createdAt).toLocaleString() },
                ]}
              />
            )}
          </SectionCard>

          <SectionCard title="Staff Activity Summary">
            {staffData && (
              <SimpleTable
                emptyLabel="No activity recorded"
                rows={staffData.summary ?? []}
                columns={[
                  { key: 'actorName', header: 'Staff' },
                  { key: 'total', header: 'Total Actions' },
                  { key: 'actionCounts', header: 'Breakdown', cell: (r) => Object.entries(r.actionCounts).map(([k, v]) => `${k}:${v}`).join(', ') },
                ]}
              />
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
