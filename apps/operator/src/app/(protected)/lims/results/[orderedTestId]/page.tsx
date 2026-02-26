'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { FlagBadge as StatusFlagBadge } from '@/components/status-badge';

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
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'verifying' | 'verified' | 'published'>('idle');
  const [publishedDoc, setPublishedDoc] = useState<any>(null);
  const [actionError, setActionError] = useState('');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
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

  const pollForDocument = (encounterId: string, attempt = 0) => {
    if (attempt >= 15) {
      setVerifyStatus('verified');
      return;
    }
    pollRef.current = setTimeout(async () => {
      try {
        const api = getApiClient(getToken() ?? undefined);
        // @ts-ignore
        const { data } = await api.GET('/documents', {
          params: { query: { encounterId, docType: 'LAB_REPORT', status: 'PUBLISHED' } },
        });
        const docs = Array.isArray(data) ? data : (data as any)?.data ?? [];
        const published = docs.find((d: any) => d.status === 'PUBLISHED' && (d.type === 'LAB_REPORT' || d.docType === 'LAB_REPORT'));
        if (published) {
          setPublishedDoc(published);
          setVerifyStatus('published');
        } else {
          pollForDocument(encounterId, attempt + 1);
        }
      } catch {
        pollForDocument(encounterId, attempt + 1);
      }
    }, 2000);
  };

  const handleSubmitAndVerify = async () => {
    if (!detail || verifying) return;
    setVerifying(true);
    setVerifyStatus('verifying');
    setActionError('');
    try {
      const saved = await saveCurrentValues({ silent: true });
      if (!saved) { setVerifyStatus('idle'); return; }
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data, error: apiErr } = await api.POST('/results/tests/{orderedTestId}:submit-and-verify', {
        params: { path: { orderedTestId } },
        body: {},
      });
      if (apiErr) { setActionError('Verify failed'); setVerifyStatus('idle'); return; }
      if ((data as any)?.orderedTest) setDetail((data as any).orderedTest);
      setVerifyStatus('verified');
      setToast('✅ Verified. Publishing report…');
      pollForDocument(detail.encounterId);
    } catch {
      setActionError('Verify failed');
      setVerifyStatus('idle');
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenPdf = async (doc: any) => {
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const res = await api.GET('/documents/{id}/download', {
        params: { path: { id: doc.id } },
        parseAs: 'blob',
      });
      if (!res.data) return;
      const blob = res.data as unknown as Blob;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch { /* ignore */ }
  };

  const handleDownloadPdf = async (doc: any) => {
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const res = await api.GET('/documents/{id}/download', {
        params: { path: { id: doc.id } },
        parseAs: 'blob',
      });
      if (!res.data) return;
      const blob = res.data as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lab-report-${doc.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  if (loading) return <p className="text-muted-foreground p-6">Loading...</p>;
  if (error) return <p className="text-destructive p-6">{error}</p>;
  if (!detail) return null;

  const patient = detail.patient;
  const parameters: any[] = detail.parameters ?? [];

  const inputCls = (locked: boolean) => cn(
    'px-2.5 py-1.5 border rounded-md text-sm w-40 transition-colors',
    locked
      ? 'bg-muted/50 text-muted-foreground border-transparent cursor-default'
      : 'bg-white dark:bg-slate-800 border-border dark:border-slate-600 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm'
  );

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

      {/* Verify / publish status banners */}
      {verifyStatus === 'verifying' && (
        <div className="chip-neutral rounded-lg px-5 py-3.5 mb-4 text-muted-foreground text-sm font-medium">
          Verifying…
        </div>
      )}
      {verifyStatus === 'verified' && (
        <div className="bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-border))] rounded-lg px-5 py-3.5 mb-4 text-[hsl(var(--status-success-fg))] text-sm font-medium">
          ✅ Verified. Publishing report…
        </div>
      )}
      {verifyStatus === 'published' && publishedDoc && (
        <div className="bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-border))] rounded-lg px-5 py-4 mb-4">
          <div className="font-bold text-[hsl(var(--status-success-fg))] mb-2.5">✅ Report Published</div>
          <div className="flex gap-2.5 flex-wrap">
            <Button onClick={() => handleOpenPdf(publishedDoc)}>Open PDF</Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => handleDownloadPdf(publishedDoc)}>Download PDF</Button>
            <Button variant="outline" onClick={() => navigateAfterAction(detail.encounterId)}>Next test →</Button>
          </div>
        </div>
      )}

      {/* Parameters table */}
      {parameters.length === 0 ? (
        <SectionCard>
          <p className="text-muted-foreground text-center py-4">No parameters defined for this test.</p>
        </SectionCard>
      ) : (
        <SectionCard noPadding className="mb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                {['Parameter', 'Value', 'Unit', 'Ref Range', 'Flag'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parameters.map((p: any) => {
                const isLocked = !!p.locked || !!p.verifiedAt;
                const currentValue = localValues[p.parameterId] ?? '';
                const currentFlag = localFlags[p.parameterId] ?? null;

                const cycleFlag = () => {
                  if (isLocked) return;
                  const idx = FLAG_CYCLE.indexOf(currentFlag);
                  const next = FLAG_CYCLE[(idx + 1) % FLAG_CYCLE.length];
                  setLocalFlags(f => ({ ...f, [p.parameterId]: next }));
                };

                const renderInput = () => {
                  if (p.dataType === 'select' && Array.isArray(p.allowedValues) && p.allowedValues.length > 0) {
                    return (
                      <select
                        disabled={isLocked}
                        value={currentValue}
                        onChange={e => setLocalValues(v => ({ ...v, [p.parameterId]: e.target.value }))}
                        className={inputCls(isLocked)}
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
                        disabled={isLocked}
                        value={currentValue}
                        onChange={e => setLocalValues(v => ({ ...v, [p.parameterId]: e.target.value }))}
                        className={inputCls(isLocked)}
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
                        type="number"
                        step="any"
                        readOnly={isLocked}
                        value={currentValue}
                        onChange={e => setLocalValues(v => ({ ...v, [p.parameterId]: e.target.value }))}
                        className={inputCls(isLocked)}
                      />
                    );
                  }
                  return (
                    <input
                      type="text"
                      readOnly={isLocked}
                      value={currentValue}
                      onChange={e => setLocalValues(v => ({ ...v, [p.parameterId]: e.target.value }))}
                      className={inputCls(isLocked)}
                    />
                  );
                };

                return (
                  <tr key={p.parameterId} className={cn(
                    'border-t border-muted/50',
                    !isLocked && 'bg-muted/30 dark:bg-slate-800/30 hover:bg-muted/50',
                    isLocked && 'bg-muted/20',
                  )}>
                    <td className="px-4 py-2.5 text-sm text-foreground font-medium">
                      {p.name}
                      {isLocked && <span className="ml-1.5 text-xs">🔒</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {renderInput()}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {p.unit ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {p.referenceRange ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <FlagBadge flag={currentFlag} locked={isLocked} onClick={cycleFlag} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
