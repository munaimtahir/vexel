'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, DocumentStatusBadge, DataTable, EmptyState, SkeletonPage } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const DOC_TYPE_LABELS: Record<string, string> = {
  LAB_REPORT: 'Lab Report',
  RECEIPT: 'Receipt',
};

type DatePreset = 'today' | '3days' | 'week' | 'all';

function getDateRange(preset: DatePreset): { fromDate?: string; toDate?: string } {
  const now = new Date();
  const pad = (d: Date) => d.toISOString().split('T')[0];
  if (preset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { fromDate: start.toISOString() };
  }
  if (preset === '3days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 3);
    start.setHours(0, 0, 0, 0);
    return { fromDate: start.toISOString() };
  }
  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return { fromDate: start.toISOString() };
  }
  return {};
}

function patientFromDoc(doc: any): { name: string; mrn: string } {
  const p = doc.payloadJson as any;
  if (!p) return { name: '—', mrn: '—' };
  const name = p.patientName ?? ([p.firstName, p.lastName].filter(Boolean).join(' ') || '—');
  const mrn = p.patientMrn ?? p.mrn ?? '—';
  return { name, mrn };
}

function encounterCodeFromDoc(doc: any): string {
  const p = doc.payloadJson as any;
  return p?.encounterCode ?? p?.reportNumber ?? doc.sourceRef?.slice(0, 12) ?? '—';
}

export default function ReportsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [search, setSearch] = useState('');

  // Patient search drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerQuery, setDrawerQuery] = useState('');
  const [drawerSearchType, setDrawerSearchType] = useState<'mobile' | 'mrn' | 'lastName'>('mobile');
  const [drawerPatients, setDrawerPatients] = useState<any[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [patientEncounterIds, setPatientEncounterIds] = useState<string[]>([]);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const range = getDateRange(datePreset);
      const query: any = {
        status: 'PUBLISHED',
        limit: 100,
        ...range,
      };
      // If a patient is selected, fetch their encounter IDs and filter by first one (or all)
      // We'll fetch all docs and filter client-side by encounterId
      const { data, error: err } = await api.GET('/documents' as any, { params: { query } });
      if (err) throw new Error('Failed to load documents');
      let rows: any[] = Array.isArray(data) ? data : ((data as any)?.items ?? (data as any)?.data ?? []);

      // Filter by selected patient
      if (patientEncounterIds.length > 0) {
        rows = rows.filter((d: any) => patientEncounterIds.includes(d.sourceRef));
      }

      // Client-side search filter (by patient name / mrn / order code from payloadJson)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter((d: any) => {
          const p = d.payloadJson as any ?? {};
          const name = (p.patientName ?? '').toLowerCase();
          const mrn = (p.patientMrn ?? p.mrn ?? '').toLowerCase();
          const code = (p.encounterCode ?? p.reportNumber ?? d.sourceRef ?? '').toLowerCase();
          return name.includes(q) || mrn.includes(q) || code.includes(q);
        });
      }

      setDocs(rows);
    } catch (e: any) {
      setError(e.message ?? 'Error loading documents');
    } finally {
      setLoading(false);
    }
  }, [datePreset, search, patientEncounterIds]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleDownload = async (doc: any) => {
    setDownloading(doc.id);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.GET('/documents/{id}/download' as any, {
        params: { path: { id: doc.id } },
        parseAs: 'blob',
      });
      if (!res.data) throw new Error('Download failed');
      const blob = res.data as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const { name, mrn } = patientFromDoc(doc);
      const code = encounterCodeFromDoc(doc);
      a.download = `lab-report-${mrn !== '—' ? mrn : code}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: try URL-based download
      try {
        const api = getApiClient(getToken() ?? undefined);
        const { data } = await api.GET('/documents/{id}/download' as any, {
          params: { path: { id: doc.id } },
        });
        const url = (data as any)?.url;
        if (url) window.open(url, '_blank');
      } catch { /* ignore */ }
    } finally {
      setDownloading(null);
    }
  };

  // Patient search in drawer
  const handlePatientSearch = async () => {
    if (!drawerQuery.trim()) return;
    setDrawerLoading(true);
    setDrawerError('');
    setDrawerPatients([]);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const q: any = { limit: 20 };
      q[drawerSearchType] = drawerQuery.trim();
      const { data, error: err } = await api.GET('/patients' as any, { params: { query: q } });
      if (err) throw new Error('Search failed');
      setDrawerPatients((data as any)?.data ?? (Array.isArray(data) ? data : []));
    } catch (e: any) {
      setDrawerError(e.message ?? 'Search failed');
    } finally {
      setDrawerLoading(false);
    }
  };

  const selectPatient = async (patient: any) => {
    setDrawerLoading(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data } = await api.GET('/encounters' as any, {
        params: { query: { patientId: patient.id, limit: 50 } },
      });
      const encounters: any[] = (data as any)?.data ?? [];
      const ids = encounters.map((e: any) => e.id);
      setPatientEncounterIds(ids);
      setSelectedPatientId(patient.id);
      setSelectedPatientName(`${patient.firstName} ${patient.lastName}`);
      setDrawerOpen(false);
    } catch {
      setDrawerError('Failed to load patient encounters');
    } finally {
      setDrawerLoading(false);
    }
  };

  const clearPatientFilter = () => {
    setPatientEncounterIds([]);
    setSelectedPatientId(null);
    setSelectedPatientName('');
    setDrawerPatients([]);
    setDrawerQuery('');
  };

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '3days', label: 'Last 3 days' },
    { key: 'week', label: 'Last week' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div>
      <PageHeader
        title="Published Reports"
        description="Lab reports and receipts for your lab"
        actions={<Button variant="outline" size="sm" onClick={fetchDocs}>Refresh</Button>}
      />

      {/* Filters row */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        {/* Date preset buttons */}
        <div className="flex gap-1 border rounded-lg p-1 bg-muted/30">
          {presets.map(p => (
            <button
              key={p.key}
              onClick={() => setDatePreset(p.key)}
              className={[
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                datePreset === p.key
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <Input
          placeholder="Search name, MRN, order ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56"
        />

        {/* Patient search drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              🔍 Find patient
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-96 sm:w-[440px]">
            <SheetHeader>
              <SheetTitle>Find patient</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {/* Search type selector */}
              <div className="flex gap-1 border rounded-lg p-1 bg-muted/30">
                {([
                  { key: 'mobile', label: 'Mobile' },
                  { key: 'mrn', label: 'MRN' },
                  { key: 'lastName', label: 'Last name' },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setDrawerSearchType(t.key)}
                    className={[
                      'flex-1 px-2 py-1.5 rounded-md text-sm font-medium transition-colors',
                      drawerSearchType === t.key
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder={
                    drawerSearchType === 'mobile' ? 'Enter mobile number…'
                    : drawerSearchType === 'mrn' ? 'Enter MRN…'
                    : 'Enter last name…'
                  }
                  value={drawerQuery}
                  onChange={e => setDrawerQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePatientSearch()}
                  className="flex-1"
                />
                <Button onClick={handlePatientSearch} disabled={drawerLoading}>
                  {drawerLoading ? '…' : 'Search'}
                </Button>
              </div>

              {drawerError && <p className="text-destructive text-sm">{drawerError}</p>}

              {drawerPatients.length === 0 && !drawerLoading && drawerQuery && (
                <p className="text-muted-foreground text-sm text-center py-4">No patients found</p>
              )}

              <div className="space-y-2">
                {drawerPatients.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="font-semibold text-foreground text-sm">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.mrn && <span className="mr-2">MRN: {p.mrn}</span>}
                      {p.mobile && <span>📱 {p.mobile}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Active patient filter chip */}
        {selectedPatientName && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
            <span>👤 {selectedPatientName}</span>
            <button
              onClick={clearPatientFilter}
              className="ml-1 hover:text-destructive transition-colors"
              title="Clear patient filter"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {loading && <SkeletonPage />}
      {error && <p className="text-destructive">{error}</p>}

      {!loading && !error && docs.length === 0 && (
        <EmptyState
          title={selectedPatientName ? `No reports for ${selectedPatientName}` : 'No published reports'}
          description={datePreset !== 'all' ? 'Try expanding the date range or selecting "All"' : undefined}
        />
      )}

      {!loading && !error && docs.length > 0 && (
        <DataTable
          data={docs}
          keyExtractor={(doc: any) => doc.id}
          columns={[
            {
              key: 'type',
              header: 'Type',
              cell: (doc: any) => (
                <Badge variant="secondary">
                  {DOC_TYPE_LABELS[doc.type ?? doc.docType] ?? (doc.type ?? doc.docType)}
                </Badge>
              ),
            },
            {
              key: 'patient',
              header: 'Patient',
              cell: (doc: any) => {
                const { name, mrn } = patientFromDoc(doc);
                return (
                  <div>
                    <div className="font-semibold text-foreground text-sm">{name}</div>
                    {mrn !== '—' && (
                      <div className="text-xs text-muted-foreground">MRN: {mrn}</div>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'orderId',
              header: 'Order / Report #',
              cell: (doc: any) => (
                <span className="font-mono text-sm text-muted-foreground">
                  {encounterCodeFromDoc(doc)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (doc: any) => <DocumentStatusBadge status={doc.status} />,
            },
            {
              key: 'date',
              header: 'Date & Time',
              cell: (doc: any) => (
                <span className="text-muted-foreground text-sm whitespace-nowrap">
                  {(doc.publishedAt ?? doc.createdAt)
                    ? new Date(doc.publishedAt ?? doc.createdAt).toLocaleString()
                    : '—'}
                </span>
              ),
            },
            {
              key: 'action',
              header: '',
              cell: (doc: any) => (
                doc.status === 'PUBLISHED' ? (
                  <Button size="sm" onClick={() => handleDownload(doc)} disabled={downloading === doc.id}>
                    {downloading === doc.id ? 'Downloading…' : '⬇ Download'}
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">Not available</span>
                )
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
