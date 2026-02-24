'use client';
import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useFeatureFlags, isReceiveSeparate, isBarcodeEnabled } from '@/hooks/use-feature-flags';

type SpecimenStatus = 'PENDING' | 'COLLECTED' | 'POSTPONED' | 'RECEIVED';
type FilterStatus = 'PENDING' | 'POSTPONED' | 'RECEIVED' | '';

const STATUS_COLOR: Record<SpecimenStatus, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  COLLECTED: { bg: '#d1fae5', color: '#065f46', label: 'Collected' },
  POSTPONED: { bg: '#fee2e2', color: '#991b1b', label: 'Postponed' },
  RECEIVED:  { bg: '#dbeafe', color: '#1e40af', label: 'Received' },
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

  const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, ...extra,
  });

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', color: 'white', padding: '12px 20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999, fontSize: '14px' }}>
          {toast}
        </div>
      )}

      {/* Postpone Modal */}
      {postponeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}>
          <div style={{ background: 'white', borderRadius: '10px', padding: '28px', width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Postpone Specimen</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>{postponeModal.label}</p>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                Reason * <span style={{ color: '#94a3b8' }}>({postponeReason.length} chars)</span>
              </label>
              <textarea
                value={postponeReason}
                onChange={e => { setPostponeReason(e.target.value); setPostponeError(''); }}
                rows={3}
                placeholder="Enter reason for postponement…"
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${postponeError ? '#ef4444' : '#e2e8f0'}`, borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
              />
              {postponeError && <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0' }}>{postponeError}</p>}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setPostponeModal(null); setPostponeReason(''); setPostponeError(''); }} style={btn({ background: 'white', border: '1px solid #e2e8f0', color: '#64748b', padding: '8px 18px' })}>
                Cancel
              </button>
              <button onClick={confirmPostpone} disabled={postponing} style={btn({ background: postponing ? '#94a3b8' : '#ef4444', color: 'white', padding: '8px 18px', cursor: postponing ? 'not-allowed' : 'pointer' })}>
                {postponing ? 'Postponing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>Sample Collection</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
          Collect, postpone, and{receiveSeparate ? ' receive' : ''} specimens
          {barcodeEnabled && <span style={{ marginLeft: '8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', padding: '1px 8px', fontSize: '12px' }}>Barcode labels enabled</span>}
        </p>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '6px', padding: '3px' }}>
          {(['', 'PENDING', 'POSTPONED', 'RECEIVED'] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{ padding: '5px 14px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: statusFilter === s ? 600 : 400, background: statusFilter === s ? 'white' : 'transparent', color: statusFilter === s ? '#1e293b' : '#64748b', boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
            >
              {s === '' ? 'All' : s[0] + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
          <label>From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px' }} />
          <label>To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '13px' }} />
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="MRN, name, or encounter…"
          style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', width: '200px', outline: 'none' }}
        />
        <button onClick={load} style={{ padding: '6px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          Search
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 130px 60px 140px 60px', gap: '0', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <div>Time</div>
          <div>Patient</div>
          <div>Order ID</div>
          <div>Tests</div>
          <div>Specimens</div>
          <div></div>
        </div>

        {loading && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        )}
        {error && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧪</div>
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
            <div key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              {/* Main row */}
              <div
                style={{ display: 'grid', gridTemplateColumns: '80px 1fr 130px 60px 140px 60px', gap: '0', padding: '12px 16px', alignItems: 'center', cursor: 'pointer', background: isOpen ? '#fafbfc' : 'white' }}
                onClick={() => toggleExpand(row.id)}
              >
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  <div>{fmtDate(row.createdAt)}</div>
                  <div>{fmt(row.createdAt)}</div>
                </div>
                <div>
                  {patient ? (
                    <>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>{patientName}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        MRN: {patient.mrn}
                        {displayAge && ` · ${displayAge}`}
                        {patient.gender && ` · ${patient.gender.charAt(0).toUpperCase()}`}
                      </div>
                    </>
                  ) : <span style={{ color: '#94a3b8', fontSize: '13px' }}>—</span>}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                  {row.encounterCode ?? row.id.slice(0, 8)}
                </div>
                <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>
                  {row.testCount ?? row.labOrders?.length ?? '—'}
                </div>
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: row.pendingCount > 0 ? '#d97706' : '#64748b', fontWeight: row.pendingCount > 0 ? 600 : 400 }}>
                    {row.pendingCount}/{row.totalCount} pending
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{isOpen ? '▼' : '▶'}</span>
                </div>
              </div>

              {/* Expanded: specimen rows */}
              {isOpen && (
                <div style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', padding: '0 16px 12px 48px' }}>
                  {/* Tests summary */}
                  {testNames.length > 0 && (
                    <div style={{ paddingTop: '10px', fontSize: '12px', color: '#64748b' }}>
                      Tests: <span style={{ color: '#1e293b', fontWeight: 500 }}>{testNames.join(' · ')}</span>
                    </div>
                  )}

                  {/* Collect all button */}
                  {pendingSpecimens.length > 1 && (
                    <div style={{ paddingTop: '10px', marginBottom: '8px' }}>
                      <button
                        onClick={() => collectSpecimens(row.id, [])}
                        disabled={acting.has(`all-${row.id}`)}
                        style={btn({ background: '#059669', color: 'white', padding: '6px 14px', opacity: acting.has(`all-${row.id}`) ? 0.6 : 1 })}
                      >
                        ✓ {receiveSeparate ? 'Collect All' : 'Collect & Receive All'}
                      </button>
                    </div>
                  )}

                  {specimens.length === 0 && (
                    <p style={{ color: '#94a3b8', fontSize: '13px', padding: '12px 0' }}>No specimen items found for this encounter</p>
                  )}

                  {specimens.map((sp: any) => {
                    const colors = STATUS_COLOR[sp.status as SpecimenStatus] ?? STATUS_COLOR.PENDING;
                    const isActing = acting.has(sp.id);
                    const specimenLabel = sp.catalogSpecimenType || '—';
                    // When barcode enabled, barcode = encounterCode
                    const barcodeValue = barcodeEnabled ? (row.encounterCode ?? row.id.slice(0, 8)) : sp.barcode;

                    return (
                      <div key={sp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginTop: '6px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{ background: colors.bg, color: colors.color, borderRadius: '4px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>
                            {colors.label}
                          </span>
                          <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{specimenLabel}</span>
                          {barcodeEnabled && (
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                              #{barcodeValue}
                            </span>
                          )}
                          {sp.postponeReason && (
                            <span style={{ fontSize: '12px', color: '#dc2626', fontStyle: 'italic' }}>Reason: {sp.postponeReason}</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {barcodeEnabled && sp.status !== 'POSTPONED' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); printBarcodeLabel(row.encounterCode ?? row.id.slice(0, 8), patientName, specimenLabel); }}
                              style={btn({ background: 'white', border: '1px solid #e2e8f0', color: '#64748b' })}
                              title="Print barcode label"
                            >
                              🖨 Label
                            </button>
                          )}
                          {sp.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => collectSpecimens(row.id, [sp.id])}
                                disabled={isActing}
                                style={btn({ background: '#059669', color: 'white', opacity: isActing ? 0.6 : 1 })}
                              >
                                {receiveSeparate ? 'Collect' : 'Collect & Receive'}
                              </button>
                              <button
                                onClick={() => { setPostponeModal({ encounterId: row.id, specimenItemId: sp.id, label: specimenLabel }); setPostponeReason(''); setPostponeError(''); }}
                                style={btn({ background: '#f59e0b', color: 'white' })}
                              >
                                Postpone
                              </button>
                            </>
                          )}
                          {sp.status === 'COLLECTED' && receiveSeparate && (
                            <button
                              onClick={() => receiveSpecimen(row.id, sp.id)}
                              disabled={isActing}
                              style={btn({ background: '#2563eb', color: 'white', opacity: isActing ? 0.6 : 1 })}
                            >
                              Receive
                            </button>
                          )}
                          {sp.status === 'POSTPONED' && (
                            <button
                              onClick={() => collectSpecimens(row.id, [sp.id])}
                              disabled={isActing}
                              style={btn({ background: '#8b5cf6', color: 'white', opacity: isActing ? 0.6 : 1 })}
                            >
                              Re-collect
                            </button>
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

