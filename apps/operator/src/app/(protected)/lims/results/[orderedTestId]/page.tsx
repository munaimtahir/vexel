'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FlagBadge as StatusFlagBadge } from '@/components/status-badge';
import { DataTable, type DataTableColumn } from '@vexel/ui-system';

const SPECIMEN_READY_STATUSES = ['specimen_collected', 'specimen_received', 'partial_resulted', 'resulted', 'verified'];

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
  if (!p) return '';
  const age = patientAge(p);
  const gender = p.gender ? p.gender.toString().charAt(0).toUpperCase() : '';
  return [age, gender].filter(Boolean).join('');
}

const FLAG_CYCLE: (string | null)[] = [null, 'high', 'low', 'normal'];

function parseRange(referenceRange?: string | null): { low: number; high: number } | null {
  if (!referenceRange) return null;
  const m = referenceRange.match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const low = Number(m[1]);
  const high = Number(m[2]);
  if (Number.isNaN(low) || Number.isNaN(high)) return null;
  return { low, high };
}

function derivedFlagForValue(p: any, value: string): string | null {
  if (p?.dataType !== 'number') return null;
  const n = Number(value);
  if (value === '' || Number.isNaN(n)) return null;
  const range = parseRange(p.referenceRange);
  if (!range) return null;
  if (n < range.low) return 'low';
  if (n > range.high) return 'high';
  return 'normal';
}

function FlagBadge({ flag, locked, onClick }: { flag: string | null; locked: boolean; onClick: () => void }) {
  if (!flag) {
    return (
      <span
        onClick={locked ? undefined : onClick}
        title={locked ? undefined : 'Click to set flag'}
        className={cn(
          'inline-block w-6 h-6 leading-6 text-center rounded text-xs font-bold bg-muted text-muted-foreground select-none',
          locked ? 'cursor-default' : 'cursor-pointer'
        )}
      >—</span>
    );
  }
  return (
    <span
      onClick={locked ? undefined : onClick}
      title={locked ? undefined : 'Click to cycle flag'}
      className={cn('select-none', locked ? 'cursor-default' : 'cursor-pointer')}
    >
      <StatusFlagBadge flag={flag} />
    </span>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 bg-foreground text-background px-5 py-3 rounded-lg text-sm font-medium z-50 shadow-lg">
      {message}
    </div>
  );
}

export default function ResultsEntryPage() {
  const params = useParams();
  const orderedTestId = params.orderedTestId as string;
  const router = useRouter();

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [localFlags, setLocalFlags] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  const fetchDetail = useCallback(async () => {
    const api = getApiClient(getToken() ?? undefined);
    try {
      // @ts-ignore
      const { data, error: apiErr } = await api.GET('/results/tests/{orderedTestId}', {
        params: { path: { orderedTestId } },
      });
      if (apiErr || !data) { setError('Failed to load test'); return; }
      setDetail(data);
      const initValues: Record<string, string> = {};
      const initFlags: Record<string, string | null> = {};
      const params_list = (data as any).parameters ?? [];
      for (const p of params_list) {
        initValues[p.parameterId] = p.value ?? p.defaultValue ?? '';
        initFlags[p.parameterId] = p.flag ?? null;
      }
      setLocalValues(initValues);
      setLocalFlags(initFlags);
    } catch {
      setError('Failed to load test');
    } finally {
      setLoading(false);
    }
  }, [orderedTestId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const specimenReady = detail
    ? SPECIMEN_READY_STATUSES.some(s => (detail.specimenStatus ?? '').toLowerCase().includes(s))
    : false;

  const isSubmitted = detail?.resultStatus === 'SUBMITTED';
  const isVerified = detail
    ? ((detail.specimenStatus ?? '').toLowerCase() === 'verified') ||
      ((detail.parameters ?? []) as any[]).some((p) => !!p.verifiedAt || !!p.locked)
    : false;

  const saveCurrentValues = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!detail || saving) return;
    setSaving(true);
    setActionError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const params_list = (detail.parameters ?? []) as any[];
      const values = params_list
        .filter(p => !p.locked && localValues[p.parameterId] !== undefined && localValues[p.parameterId] !== '')
        .map(p => ({ parameterId: p.parameterId, value: localValues[p.parameterId] }));
      // @ts-ignore
      const { data, error: apiErr } = await api.POST('/results/tests/{orderedTestId}:save', {
        params: { path: { orderedTestId } },
        body: { values },
      });
      if (apiErr) { setActionError('Save failed'); return; }
      // refresh from response
      if (data) {
        setDetail(data);
        const params_list2 = (data as any).parameters ?? [];
        const newVals: Record<string, string> = {};
        const newFlags: Record<string, string | null> = {};
        for (const p of params_list2) {
          newVals[p.parameterId] = localValues[p.parameterId] ?? p.value ?? '';
          newFlags[p.parameterId] = localFlags[p.parameterId] ?? p.flag ?? null;
        }
        setLocalValues(newVals);
        setLocalFlags(newFlags);
      }
      if (!silent) setToast('Saved ✓');
      return true;
    } catch {
      setActionError('Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const navigateAfterAction = async (currentEncounterId: string) => {
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/results/tests/pending', { params: { query: {} } });
      const pending = (data as any)?.data ?? [];
      const next = pending.find((t: any) => t.encounterId === currentEncounterId && t.id !== orderedTestId);
      if (next) {
        router.push(`/lims/results/${next.id}`);
      } else {
        router.push('/lims/results');
      }
    } catch {
      router.push('/lims/results');
    }
  };

  const handleSubmit = async () => {
    if (!detail || submitting) return;
    setSubmitting(true);
    setActionError('');
    try {
      const saved = await saveCurrentValues({ silent: true });
      if (!saved) return;
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data, error: apiErr } = await api.POST('/results/tests/{orderedTestId}:submit', {
        params: { path: { orderedTestId } },
        body: {},
      });
      if (apiErr) { setActionError('Save failed'); return; }
      if (data) setDetail(data);
      setToast('Saved and forwarded ✓');
      await navigateAfterAction(detail.encounterId);
    } catch {
      setActionError('Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const patient = detail?.patient;
  const parameters: any[] = detail?.parameters ?? [];
  const editableIds = useMemo(
    () => parameters.filter((p) => !p.locked && !p.verifiedAt).map((p) => p.parameterId),
    [parameters],
  );
  const incompleteCount = useMemo(
    () => parameters.filter((p) => !p.locked && !p.verifiedAt && !String(localValues[p.parameterId] ?? '').trim()).length,
    [parameters, localValues],
  );
  const hasIncompleteParameters = incompleteCount > 0;

  useEffect(() => {
    const firstEmpty = parameters.find((p) => !p.locked && !p.verifiedAt && !String(localValues[p.parameterId] ?? '').trim());
    if (!firstEmpty) return;
    const el = inputRefs.current[firstEmpty.parameterId];
    if (el && document.activeElement !== el) {
      el.focus();
    }
  }, [orderedTestId, parameters]);

  const inputCls = (locked: boolean) => cn(
    'px-2.5 py-1.5 border rounded-md text-sm w-40 transition-colors',
    locked
      ? 'bg-muted/50 text-muted-foreground border-transparent cursor-default'
      : 'bg-white dark:bg-slate-800 border-border dark:border-slate-600 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm'
  );

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, parameterId: string) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!hasIncompleteParameters) {
          void handleSubmit();
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        void saveCurrentValues();
        return;
      }
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const idx = editableIds.indexOf(parameterId);
      if (idx < 0) return;
      const nextIdx = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= editableIds.length) return;
      const nextEl = inputRefs.current[editableIds[nextIdx]];
      if (nextEl) nextEl.focus();
    },
    [editableIds, hasIncompleteParameters, saveCurrentValues, handleSubmit],
  );

  if (loading) return <p className="text-muted-foreground p-6">Loading...</p>;
  if (error) return <p className="text-destructive p-6">{error}</p>;
  if (!detail) return null;

  return (
    <div className="pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 bg-background z-10 py-4 border-b shadow-sm mb-6">
        {/* Back button row */}
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lims/results">← Back to Results</Link>
          </Button>
          {!specimenReady && (
            <Button variant="ghost" size="sm" asChild className="text-[hsl(var(--status-warning-fg))]">
              <Link href="/lims/sample-collection">Go to Sample Collection</Link>
            </Button>
          )}
        </div>

        {/* Patient + test info */}
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            {patient && (
              <div className="mb-1">
                <span className="text-base font-bold text-foreground">
                  {patient.firstName} {patient.lastName}
                </span>
                <span className="ml-2.5 text-sm text-muted-foreground">
                  {patient.mrn} · {patientLabel(patient)}
                </span>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Order: <span className="font-mono text-foreground">{detail.encounterCode ?? detail.encounterId?.slice(0, 12)}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xl font-bold text-foreground">{detail.testName}</div>
            <div className="flex gap-2 mt-1 justify-end flex-wrap">
              {detail.specimenStatus && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                  {detail.specimenStatus}
                </span>
              )}
              <span className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-semibold',
                isSubmitted ? 'bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))]' : 'bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))]'
              )}>
                {detail.resultStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Specimen gate warning */}
      {!specimenReady && (
        <div className="chip-warning rounded-lg p-4 mb-6 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <span className="text-sm font-semibold text-[hsl(var(--status-warning-fg))]">
              Sample not collected. Collect the sample first before entering results.
            </span>
            <span className="ml-2">
              <Link href="/lims/sample-collection" className="text-primary text-sm">Go to Sample Collection →</Link>
            </span>
          </div>
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 mb-4 text-destructive text-sm">
          {actionError}
        </div>
      )}

      {isSubmitted && (
        <div className="bg-[hsl(var(--status-warning-bg))] border border-[hsl(var(--status-warning-border))] rounded-lg px-5 py-3.5 mb-4 text-[hsl(var(--status-warning-fg))] text-sm font-medium">
          Forwarded for verification. Verify this encounter from the verification queue.
        </div>
      )}

      {/* Parameters table */}
      {parameters.length === 0 ? (
        <SectionCard>
          <p className="text-muted-foreground text-center py-4">No parameters defined for this test.</p>
        </SectionCard>
      ) : (
        <SectionCard noPadding className="mb-6">
          <DataTable
            columns={[
              {
                key: 'parameter',
                header: 'Parameter',
                cell: (p) => (
                  <span className="text-sm text-foreground font-medium">
                    {p.name}
                    {(p.locked || p.verifiedAt) && <span className="ml-1.5 text-xs">🔒</span>}
                  </span>
                ),
              },
              {
                key: 'value',
                header: 'Value',
                cell: (p) => {
                  const isLocked = !!p.locked || !!p.verifiedAt;
                  const currentValue = localValues[p.parameterId] ?? '';
                  const autoFlag = derivedFlagForValue(p, currentValue);
                  const resolvedFlag = (localFlags[p.parameterId] ?? autoFlag) as string | null;
                  const valueToneClass = resolvedFlag === 'high' || resolvedFlag === 'low'
                    ? 'text-[hsl(var(--status-destructive-fg))] border-[hsl(var(--status-destructive-border))]'
                    : resolvedFlag === 'normal'
                      ? 'text-[hsl(var(--status-success-fg))] border-[hsl(var(--status-success-border))]'
                      : '';
                  if (p.dataType === 'select' && Array.isArray(p.allowedValues) && p.allowedValues.length > 0) {
                    return (
                      <select
                        ref={(el) => { inputRefs.current[p.parameterId] = el; }}
                        disabled={isLocked}
                        value={currentValue}
                        onChange={(e) => setLocalValues((v) => ({ ...v, [p.parameterId]: e.target.value }))}
                        onKeyDown={(e) => handleGridKeyDown(e, p.parameterId)}
                        className={cn(inputCls(isLocked), valueToneClass)}
                      >
                        <option value="">—</option>
                        {p.allowedValues.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    );
                  }
                  if (p.dataType === 'boolean') {
                    return (
                      <select
                        ref={(el) => { inputRefs.current[p.parameterId] = el; }}
                        disabled={isLocked}
                        value={currentValue}
                        onChange={(e) => setLocalValues((v) => ({ ...v, [p.parameterId]: e.target.value }))}
                        onKeyDown={(e) => handleGridKeyDown(e, p.parameterId)}
                        className={cn(inputCls(isLocked), valueToneClass)}
                      >
                        <option value="">—</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    );
                  }
                  if (p.dataType === 'number') {
                    return (
                      <input
                        ref={(el) => { inputRefs.current[p.parameterId] = el; }}
                        type="number"
                        step="any"
                        readOnly={isLocked}
                        value={currentValue}
                        onChange={(e) => setLocalValues((v) => ({ ...v, [p.parameterId]: e.target.value }))}
                        onKeyDown={(e) => handleGridKeyDown(e, p.parameterId)}
                        className={cn(inputCls(isLocked), valueToneClass)}
                      />
                    );
                  }
                  return (
                    <input
                      ref={(el) => { inputRefs.current[p.parameterId] = el; }}
                      type="text"
                      readOnly={isLocked}
                      value={currentValue}
                      onChange={(e) => setLocalValues((v) => ({ ...v, [p.parameterId]: e.target.value }))}
                      onKeyDown={(e) => handleGridKeyDown(e, p.parameterId)}
                      className={cn(inputCls(isLocked), valueToneClass)}
                    />
                  );
                },
              },
              { key: 'unit', header: 'Unit', cell: (p) => <span className="text-sm text-muted-foreground">{p.unit ?? '—'}</span> },
              { key: 'referenceRange', header: 'Ref Range', cell: (p) => <span className="text-sm text-muted-foreground">{p.referenceRange ?? '—'}</span> },
              {
                key: 'flag',
                header: 'Flag',
                cell: (p) => {
                  const isLocked = !!p.locked || !!p.verifiedAt;
                  const currentValue = localValues[p.parameterId] ?? '';
                  const autoFlag = derivedFlagForValue(p, currentValue);
                  const currentFlag = (localFlags[p.parameterId] ?? autoFlag) as string | null;
                  const cycleFlag = () => {
                    if (isLocked) return;
                    const idx = FLAG_CYCLE.indexOf(currentFlag);
                    const next = FLAG_CYCLE[(idx + 1) % FLAG_CYCLE.length];
                    setLocalFlags((f) => ({ ...f, [p.parameterId]: next }));
                  };
                  return <FlagBadge flag={currentFlag} locked={isLocked} onClick={cycleFlag} />;
                },
              },
            ] as DataTableColumn<any>[]}
            data={parameters}
            keyExtractor={(p) => p.parameterId}
            rowClassName={(p) =>
              cn(
                !p.locked && !p.verifiedAt && 'bg-muted/30 dark:bg-slate-800/30 hover:bg-muted/50',
                (p.locked || p.verifiedAt) && 'bg-muted/20',
              )
            }
          />
        </SectionCard>
      )}

      {/* Action buttons footer */}
      <div className="flex gap-3 flex-wrap pt-4 border-t">
        <Button
          onClick={handleSubmit}
          disabled={!specimenReady || submitting || saving || isVerified}
          title={isVerified ? 'Verified results are locked' : 'Saves changes and forwards to verification'}
        >
          {submitting || saving ? 'Saving…' : 'Save & Forward'}
        </Button>
        <Button
          variant="outline"
          asChild
        >
          <Link href="/lims/verification">Open Verification Queue</Link>
        </Button>
        <span className="self-center text-xs text-muted-foreground">
          Enter: save, Ctrl+Enter: save & next
        </span>
      </div>
      {hasIncompleteParameters && (
        <p className="mt-2 text-xs text-[hsl(var(--status-warning-fg))]">
          {incompleteCount} parameter{incompleteCount > 1 ? 's are' : ' is'} incomplete. Verify/publish is disabled.
        </p>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
