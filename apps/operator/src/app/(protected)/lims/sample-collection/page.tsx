'use client';
import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useFeatureFlags, isReceiveSeparate, isBarcodeEnabled } from '@/hooks/use-feature-flags';
import { PageHeader } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SpecimenStatus = 'PENDING' | 'COLLECTED' | 'POSTPONED' | 'RECEIVED';
type FilterStatus = 'PENDING' | 'POSTPONED' | 'RECEIVED' | '';

const SPECIMEN_STATUS_CLASS: Record<SpecimenStatus, string> = {
  PENDING:   'bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded',
  COLLECTED: 'bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded',
  POSTPONED: 'bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5 rounded',
  RECEIVED:  'bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded',
};

const SPECIMEN_STATUS_LABEL: Record<SpecimenStatus, string> = {
  PENDING:   'Pending',
  COLLECTED: 'Collected',
  POSTPONED: 'Postponed',
  RECEIVED:  'Received',
};

function defaultFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return d.toISOString().split('T')[0];
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function fmt(dt: string) { return new Date(dt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }); }
function fmtDate(dt: string) { return new Date(dt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }); }

function ageFromDob(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear() - (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  return `${years}y`;
}

function printBarcodeLabel(encounterCode: string, patientName: string, specimenType: string) {
  const win = window.open('', '_blank', 'width=400,height=200');
  if (!win) return;
  win.document.write(`
    <html><head><title>Barcode Label</title>
    <style>body{font-family:monospace;padding:16px;font-size:13px;}h2{margin:0 0 6px;font-size:16px;}p{margin:2px 0;}</style>
    </head><body>
    <h2>${encounterCode}</h2>
    <p>Patient: ${patientName}</p>
    <p>Specimen: ${specimenType}</p>
    <script>window.print();window.close();</script>
    </body></html>
  `);
}

export default function SampleCollectionPage() {
  const { flags } = useFeatureFlags();
  const receiveSeparate = isReceiveSeparate(flags);
  const barcodeEnabled = isBarcodeEnabled(flags);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filters
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('PENDING');
  const [fromDate, setFromDate] = useState(defaultFromDate());
  const [toDate, setToDate] = useState(todayStr());
  const [search, setSearch] = useState('');

  // Postpone modal
  const [postponeModal, setPostponeModal] = useState<{ encounterId: string; specimenItemId: string; label: string } | null>(null);
  const [postponeReason, setPostponeReason] = useState('');
  const [postponeError, setPostponeError] = useState('');
  const [postponing, setPostponing] = useState(false);

  // Per-row action loading (key: specimenItemId or `all-{encounterId}`)
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── load worklist ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const params: Record<string, string> = { fromDate, toDate };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      // @ts-ignore
      const { data, error: apiErr } = await api.GET('/sample-collection/worklist', { params: { query: params as any } });
      if (apiErr) { setError('Failed to load worklist'); return; }
      const loaded: any[] = (data as any)?.data ?? [];
      setRows(loaded);
      // Auto-expand rows that have pending specimens
      setExpanded(new Set(loaded.filter((r: any) => r.pendingCount > 0).map((r: any) => r.id)));
    } catch {
      setError('Failed to load worklist');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, fromDate, toDate, search]);

  useEffect(() => { load(); }, [load]);

  // ── expand toggle ────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // ── collect specimens ────────────────────────────────────────────
  const collectSpecimens = async (encounterId: string, specimenItemIds: string[]) => {
    const key = specimenItemIds.length === 1 ? specimenItemIds[0] : `all-${encounterId}`;
    setActing(prev => new Set(prev).add(key));
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { error: apiErr } = await api.POST('/encounters/{encounterId}:collect-specimens', {
        params: { path: { encounterId } },
        body: { specimenItemIds } as any,
      });
      if (apiErr) { showToast('Error: ' + ((apiErr as any)?.message ?? 'Collect failed')); return; }
      showToast(receiveSeparate ? 'Specimen collected' : 'Specimen collected & received');
      load();
    } catch {
      showToast('Collect failed');
    } finally {
      setActing(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  // ── postpone specimen ────────────────────────────────────────────
  const confirmPostpone = async () => {
    if (!postponeModal) return;
    if (postponeReason.trim().length < 3) { setPostponeError('Reason must be at least 3 characters'); return; }
    setPostponing(true); setPostponeError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { error: apiErr } = await api.POST('/encounters/{encounterId}:postpone-specimen', {
        params: { path: { encounterId: postponeModal.encounterId } },
        body: { specimenItemId: postponeModal.specimenItemId, reason: postponeReason.trim() } as any,
      });
      if (apiErr) { setPostponeError((apiErr as any)?.message ?? 'Postpone failed'); return; }
      setPostponeModal(null);
      setPostponeReason('');
      showToast('Specimen postponed');
      load();
    } catch {
      setPostponeError('Postpone failed');
    } finally {
      setPostponing(false);
    }
  };

  // ── receive specimen ─────────────────────────────────────────────
  const receiveSpecimen = async (encounterId: string, specimenItemId: string) => {
    setActing(prev => new Set(prev).add(specimenItemId));
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { error: apiErr } = await api.POST('/encounters/{encounterId}:receive-specimens', {
        params: { path: { encounterId } },
        body: { specimenItemIds: [specimenItemId] } as any,
      });
      if (apiErr) {
        const status = (apiErr as any)?.status ?? 0;
        showToast(status === 403 ? 'Receive feature not enabled' : 'Receive failed');
        return;
      }
      showToast('Specimen received');
      load();
    } catch {
      showToast('Receive failed');
    } finally {
      setActing(prev => { const n = new Set(prev); n.delete(specimenItemId); return n; });
    }
  };


  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-foreground text-background px-5 py-3 rounded-lg shadow-lg z-[9999] text-sm">
          {toast}
        </div>
      )}

      {/* Postpone Modal */}
      <Dialog open={!!postponeModal} onOpenChange={(open) => { if (!open) { setPostponeModal(null); setPostponeReason(''); setPostponeError(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Postpone Specimen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{postponeModal?.label}</p>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Reason * <span className="text-muted-foreground">({postponeReason.length} chars)</span>
            </Label>
            <Textarea
              value={postponeReason}
              onChange={e => { setPostponeReason(e.target.value); setPostponeError(''); }}
              rows={3}
              placeholder="Enter reason for postponement…"
              className={postponeError ? 'border-destructive' : ''}
            />
            {postponeError && <p className="text-destructive text-xs mt-1">{postponeError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPostponeModal(null); setPostponeReason(''); setPostponeError(''); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmPostpone} disabled={postponing}>
              {postponing ? 'Postponing…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <PageHeader
        title="Sample Collection"
        description={`Collect, postpone, and${receiveSeparate ? ' receive' : ''} specimens`}
        actions={barcodeEnabled ? (
          <span className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs font-medium">Barcode labels enabled</span>
        ) : undefined}
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-4 items-center p-4">
          {/* Status tabs */}
          <div className="flex gap-1 bg-muted rounded-md p-0.5">
            {(['', 'PENDING', 'POSTPONED', 'RECEIVED'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3.5 py-1.5 rounded text-sm border-none cursor-pointer transition-colors',
                  statusFilter === s
                    ? 'bg-background shadow-sm text-foreground font-semibold'
                    : 'text-muted-foreground bg-transparent font-normal'
                )}
              >
                {s === '' ? 'All' : s[0] + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <label>From</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36 h-8 text-sm" />
            <label>To</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36 h-8 text-sm" />
          </div>

          {/* Search */}
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="MRN, name, or encounter…"
            className="w-48 h-8 text-sm"
          />
          <Button size="sm" onClick={load}>Search</Button>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {/* Table header */}
        <div className="grid bg-muted/50 border-b px-4 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wide"
          style={{ gridTemplateColumns: '80px 1fr 130px 60px 140px 60px' }}>
          <div>Time</div>
          <div>Patient</div>
          <div>Order ID</div>
          <div>Tests</div>
          <div>Specimens</div>
          <div></div>
        </div>

        {loading && (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        )}
        {error && (
          <div className="p-6 text-center text-destructive">{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <div className="text-3xl mb-2">🧪</div>
            <div>No specimen work items found for the selected date range</div>
          </div>
        )}

        {!loading && rows.map((row: any) => {
          const isOpen = expanded.has(row.id);
          const patient = row.patient;
          const specimens: any[] = row.specimenItems ?? [];
          const pendingSpecimens = specimens.filter((s: any) => s.status === 'PENDING');
          const testNames: string[] = (row.labOrders ?? []).map((o: any) => o.testNameSnapshot).filter(Boolean);
          const patientName = patient ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() : '—';
          const displayAge = patient?.dateOfBirth ? ageFromDob(patient.dateOfBirth) : patient?.ageYears != null ? `${patient.ageYears}y` : null;

          return (
            <div key={row.id} className="border-b border-muted/50">
              {/* Main row */}
              <div
                className={cn('grid items-center px-4 py-3 cursor-pointer transition-colors hover:bg-muted/20', isOpen ? 'bg-muted/10' : '')}
                style={{ gridTemplateColumns: '80px 1fr 130px 60px 140px 60px' }}
                onClick={() => toggleExpand(row.id)}
              >
                <div className="text-xs text-muted-foreground">
                  <div>{fmtDate(row.createdAt)}</div>
                  <div>{fmt(row.createdAt)}</div>
                </div>
                <div>
                  {patient ? (
                    <>
                      <div className="font-semibold text-sm text-foreground">{patientName}</div>
                      <div className="text-xs text-muted-foreground">
                        MRN: {patient.mrn}
                        {displayAge && ` · ${displayAge}`}
                        {patient.gender && ` · ${patient.gender.charAt(0).toUpperCase()}`}
                      </div>
                    </>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {row.encounterCode ?? row.id.slice(0, 8)}
                </div>
                <div className="text-sm text-foreground font-medium">
                  {row.testCount ?? row.labOrders?.length ?? '—'}
                </div>
                <div className="text-xs">
                  <span className={cn(row.pendingCount > 0 ? 'text-amber-600 font-semibold' : 'text-muted-foreground')}>
                    {row.pendingCount}/{row.totalCount} pending
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">{isOpen ? '▼' : '▶'}</span>
                </div>
              </div>

              {/* Expanded: specimen rows */}
              {isOpen && (
                <div className="bg-muted/20 border-t border-muted/30 px-4 pb-3 pl-12">
                  {/* Tests summary */}
                  {testNames.length > 0 && (
                    <div className="pt-2.5 text-xs text-muted-foreground">
                      Tests: <span className="text-foreground font-medium">{testNames.join(' · ')}</span>
                    </div>
                  )}

                  {/* Collect all button */}
                  {pendingSpecimens.length > 1 && (
                    <div className="pt-2.5 mb-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => collectSpecimens(row.id, [])}
                        disabled={acting.has(`all-${row.id}`)}
                      >
                        ✓ {receiveSeparate ? 'Collect All' : 'Collect & Receive All'}
                      </Button>
                    </div>
                  )}

                  {specimens.length === 0 && (
                    <p className="text-muted-foreground text-sm py-3">No specimen items found for this encounter</p>
                  )}

                  {specimens.map((sp: any) => {
                    const isActing = acting.has(sp.id);
                    const specimenLabel = sp.catalogSpecimenType || '—';
                    const barcodeValue = barcodeEnabled ? (row.encounterCode ?? row.id.slice(0, 8)) : sp.barcode;

                    return (
                      <div key={sp.id} className="flex justify-between items-center px-3.5 py-2.5 mt-1.5 bg-background rounded-md border border-border">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={SPECIMEN_STATUS_CLASS[sp.status as SpecimenStatus] ?? SPECIMEN_STATUS_CLASS.PENDING}>
                            {SPECIMEN_STATUS_LABEL[sp.status as SpecimenStatus] ?? sp.status}
                          </span>
                          <span className="text-sm text-foreground font-medium">{specimenLabel}</span>
                          {barcodeEnabled && (
                            <span className="text-xs text-muted-foreground font-mono">#{barcodeValue}</span>
                          )}
                          {sp.postponeReason && (
                            <span className="text-xs text-destructive italic">Reason: {sp.postponeReason}</span>
                          )}
                        </div>

                        <div className="flex gap-2 items-center">
                          {barcodeEnabled && sp.status !== 'POSTPONED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); printBarcodeLabel(row.encounterCode ?? row.id.slice(0, 8), patientName, specimenLabel); }}
                              title="Print barcode label"
                            >
                              🖨 Label
                            </Button>
                          )}
                          {sp.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => collectSpecimens(row.id, [sp.id])}
                                disabled={isActing}
                              >
                                {receiveSeparate ? 'Collect' : 'Collect & Receive'}
                              </Button>
                              <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={() => { setPostponeModal({ encounterId: row.id, specimenItemId: sp.id, label: specimenLabel }); setPostponeReason(''); setPostponeError(''); }}
                              >
                                Postpone
                              </Button>
                            </>
                          )}
                          {sp.status === 'COLLECTED' && receiveSeparate && (
                            <Button
                              size="sm"
                              onClick={() => receiveSpecimen(row.id, sp.id)}
                              disabled={isActing}
                            >
                              Receive
                            </Button>
                          )}
                          {sp.status === 'POSTPONED' && (
                            <Button
                              size="sm"
                              className="bg-violet-600 hover:bg-violet-700 text-white"
                              onClick={() => collectSpecimens(row.id, [sp.id])}
                              disabled={isActing}
                            >
                              Re-collect
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

