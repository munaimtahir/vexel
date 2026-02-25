'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useFeatureFlags, showSubmitAndVerify, showSubmitOnly } from '@/hooks/use-feature-flags';
import { PageHeader, SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { FlagBadge as StatusFlagBadge } from '@/components/status-badge';

const SPECIMEN_READY_STATUSES = [
  'specimen_collected', 'specimen_received', 'partial_resulted', 'resulted', 'verified',
];

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

const inputCls = (locked: boolean) => cn(
  'px-2.5 py-1.5 border rounded-md text-sm w-40 transition-colors',
  locked
    ? 'bg-muted/50 text-muted-foreground border-transparent cursor-default'
    : 'bg-white dark:bg-slate-800 border-border dark:border-slate-600 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm'
);

interface TestDetail {
  id: string;
  testName: string;
  resultStatus: string;
  specimenStatus?: string;
  encounterCode?: string;
  encounterId: string;
  patient?: any;
  parameters: any[];
}

export default function EncounterResultsPage() {
  const params = useParams();
  const encounterId = params.encounterId as string;
  const router = useRouter();
  const { flags } = useFeatureFlags();

  const [tests, setTests] = useState<TestDetail[]>([]);
  const [activeTestId, setActiveTestId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Per-test local state: values and flags
  const [localValues, setLocalValues] = useState<Record<string, Record<string, string>>>({});
  const [localFlags, setLocalFlags] = useState<Record<string, Record<string, string | null>>>({});

  // Action state per test
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});

  // Global action state
  const [savingAll, setSavingAll] = useState(false);
  const [submittingAll, setSubmittingAll] = useState(false);

  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');

  // For submit-and-verify result
  const [verifyStatus, setVerifyStatus] = useState<Record<string, 'idle' | 'verifying' | 'verified' | 'published'>>({});
  const [publishedDocs, setPublishedDocs] = useState<Record<string, any>>({});
  const pollRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const initTestState = useCallback((detail: TestDetail) => {
    const vals: Record<string, string> = {};
    const flags_: Record<string, string | null> = {};
    for (const p of detail.parameters ?? []) {
      vals[p.parameterId] = p.value ?? p.defaultValue ?? '';
      flags_[p.parameterId] = p.flag ?? null;
    }
    setLocalValues(prev => ({ ...prev, [detail.id]: vals }));
    setLocalFlags(prev => ({ ...prev, [detail.id]: flags_ }));
    setVerifyStatus(prev => ({ ...prev, [detail.id]: 'idle' }));
  }, []);

  const loadEncounterTests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);

      // Fetch pending and submitted in parallel
      const [pendingRes, submittedRes] = await Promise.all([
        // @ts-ignore
        api.GET('/results/tests/pending', { params: { query: {} } }),
        // @ts-ignore
        api.GET('/results/tests/submitted', { params: { query: {} } }),
      ]);

      const pending: any[] = (pendingRes.data as any)?.data ?? [];
      const submitted: any[] = (submittedRes.data as any)?.data ?? [];

      // Filter to this encounter, deduplicate by id
      const forEncounter = [
        ...pending.filter((t: any) => t.encounterId === encounterId),
        ...submitted.filter((t: any) => t.encounterId === encounterId),
      ];
      const uniqueIds = [...new Set(forEncounter.map((t: any) => t.id))];
      const summaries = uniqueIds.map(id => forEncounter.find((t: any) => t.id === id)!);

      if (summaries.length === 0) {
        setTests([]);
        setLoading(false);
        return;
      }

      // Load full details for each test in parallel
      const detailResults = await Promise.all(
        summaries.map(s =>
          // @ts-ignore
          api.GET('/results/tests/{orderedTestId}', { params: { path: { orderedTestId: s.id } } })
        )
      );

      const loaded: TestDetail[] = detailResults
        .map(r => r.data as TestDetail)
        .filter(Boolean);

      setTests(loaded);
      if (loaded.length > 0) {
        setActiveTestId(loaded[0].id);
        loaded.forEach(initTestState);
      }
    } catch {
      setError('Failed to load encounter tests');
    } finally {
      setLoading(false);
    }
  }, [encounterId, initTestState]);

  useEffect(() => {
    loadEncounterTests();
    return () => {
      Object.values(pollRefs.current).forEach(clearTimeout);
    };
  }, [loadEncounterTests]);

  const refreshTest = async (testId: string) => {
    const api = getApiClient(getToken() ?? undefined);
    // @ts-ignore
    const { data } = await api.GET('/results/tests/{orderedTestId}', {
      params: { path: { orderedTestId: testId } },
    });
    if (!data) return;
    const detail = data as TestDetail;
    setTests(prev => prev.map(t => t.id === testId ? detail : t));
    // Preserve user's local edits — only reset if test is now submitted (locked)
    if (detail.resultStatus === 'SUBMITTED') {
      initTestState(detail);
    }
  };

  // Save a single test
  const handleSave = async (testId: string) => {
    const test = tests.find(t => t.id === testId);
    if (!test) return;
    setSaving(prev => ({ ...prev, [testId]: true }));
    setActionError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const isSubmitted = test.resultStatus === 'SUBMITTED';
      const vals = localValues[testId] ?? {};
      const values = (test.parameters ?? [])
        .filter(p => !isSubmitted || !p.locked)
        .filter(p => vals[p.parameterId] !== undefined && vals[p.parameterId] !== '')
        .map(p => ({ parameterId: p.parameterId, value: vals[p.parameterId] }));
      // @ts-ignore
      const { error: apiErr } = await api.POST('/results/tests/{orderedTestId}:save', {
        params: { path: { orderedTestId: testId } },
        body: { values },
      });
      if (apiErr) { setActionError('Save failed'); return; }
      await refreshTest(testId);
      setToast('Saved ✓');
    } catch {
      setActionError('Save failed');
    } finally {
      setSaving(prev => ({ ...prev, [testId]: false }));
    }
  };

  // Submit a single test
  const handleSubmit = async (testId: string) => {
    setSubmitting(prev => ({ ...prev, [testId]: true }));
    setActionError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { error: apiErr } = await api.POST('/results/tests/{orderedTestId}:submit', {
        params: { path: { orderedTestId: testId } },
        body: {},
      });
      if (apiErr) { setActionError('Submit failed'); return; }
      await refreshTest(testId);
      setToast('Submitted ✓');
      // Move to next pending test tab
      const nextPending = tests.find(t => t.id !== testId && t.resultStatus !== 'SUBMITTED');
      if (nextPending) setActiveTestId(nextPending.id);
    } catch {
      setActionError('Submit failed');
    } finally {
      setSubmitting(prev => ({ ...prev, [testId]: false }));
    }
  };

  const pollForDocument = (testId: string, eid: string, attempt = 0) => {
    if (attempt >= 15) {
      setVerifyStatus(prev => ({ ...prev, [testId]: 'verified' }));
      return;
    }
    pollRefs.current[testId] = setTimeout(async () => {
      try {
        const api = getApiClient(getToken() ?? undefined);
        // @ts-ignore
        const { data } = await api.GET('/documents', {
          params: { query: { encounterId: eid, docType: 'LAB_REPORT', status: 'PUBLISHED' } },
        });
        const docs = Array.isArray(data) ? data : (data as any)?.data ?? [];
        const published = docs.find(
          (d: any) => d.status === 'PUBLISHED' && (d.type === 'LAB_REPORT' || d.docType === 'LAB_REPORT')
        );
        if (published) {
          setPublishedDocs(prev => ({ ...prev, [testId]: published }));
          setVerifyStatus(prev => ({ ...prev, [testId]: 'published' }));
        } else {
          pollForDocument(testId, eid, attempt + 1);
        }
      } catch {
        pollForDocument(testId, eid, attempt + 1);
      }
    }, 2000);
  };

  // Submit & Verify a single test
  const handleSubmitAndVerify = async (testId: string) => {
    const test = tests.find(t => t.id === testId);
    if (!test) return;
    setVerifying(prev => ({ ...prev, [testId]: true }));
    setVerifyStatus(prev => ({ ...prev, [testId]: 'verifying' }));
    setActionError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data, error: apiErr } = await api.POST('/results/tests/{orderedTestId}:submit-and-verify', {
        params: { path: { orderedTestId: testId } },
        body: {},
      });
      if (apiErr) { setActionError('Verify failed'); setVerifyStatus(prev => ({ ...prev, [testId]: 'idle' })); return; }
      if ((data as any)?.orderedTest) {
        const updated = (data as any).orderedTest as TestDetail;
        setTests(prev => prev.map(t => t.id === testId ? updated : t));
      }
      setVerifyStatus(prev => ({ ...prev, [testId]: 'verified' }));
      setToast('✅ Verified. Publishing report…');
      pollForDocument(testId, test.encounterId);
    } catch {
      setActionError('Verify failed');
      setVerifyStatus(prev => ({ ...prev, [testId]: 'idle' }));
    } finally {
      setVerifying(prev => ({ ...prev, [testId]: false }));
    }
  };

  // Save all tests at once
  const handleSaveAll = async () => {
    setSavingAll(true);
    setActionError('');
    try {
      await Promise.all(tests.map(t => handleSave(t.id)));
      setToast('All tests saved ✓');
    } catch {
      setActionError('Save all failed');
    } finally {
      setSavingAll(false);
    }
  };

  // Submit all pending tests
  const handleSubmitAll = async () => {
    setSubmittingAll(true);
    setActionError('');
    try {
      const pending = tests.filter(t => t.resultStatus !== 'SUBMITTED');
      for (const t of pending) {
        await handleSubmit(t.id);
      }
      setToast('All tests submitted ✓');
    } catch {
      setActionError('Submit all failed');
    } finally {
      setSubmittingAll(false);
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

  if (loading) return <p className="text-muted-foreground p-6">Loading…</p>;
  if (error) return <p className="text-destructive p-6">{error}</p>;
  if (tests.length === 0) return (
    <div className="p-6">
      <Link href="/lims/results" className="text-primary text-sm">← Back to Results</Link>
      <p className="mt-4 text-muted-foreground">No tests found for this encounter.</p>
    </div>
  );

  const patient = tests[0]?.patient;
  const encounterCode = tests[0]?.encounterCode ?? encounterId.slice(0, 12);
  const specimenReady = (tests[0]?.specimenStatus ?? '')
    ? SPECIMEN_READY_STATUSES.some(s => (tests[0].specimenStatus ?? '').toLowerCase().includes(s))
    : false;

  const activeTest = tests.find(t => t.id === activeTestId) ?? tests[0];
  const isTestSubmitted = activeTest?.resultStatus === 'SUBMITTED';
  const testValues = localValues[activeTest?.id] ?? {};
  const testFlags = localFlags[activeTest?.id] ?? {};
  const parameters: any[] = activeTest?.parameters ?? [];

  const allPendingDone = tests.every(t => t.resultStatus === 'SUBMITTED');

  return (
    <div className="pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 bg-background z-10 py-4 border-b shadow-sm mb-6">
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

        {/* Patient info */}
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
              Order: <span className="font-mono text-foreground">{encounterCode}</span>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {tests.map(t => {
              const isVerif = (verifyStatus[t.id] === 'verified' || verifyStatus[t.id] === 'published') || t.resultStatus === 'SUBMITTED';
              return (
                <Badge
                  key={t.id}
                  variant="outline"
                  className={
                    verifyStatus[t.id] === 'published'
                      ? 'bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))] border-[hsl(var(--status-success-border))] text-xs'
                      : isVerif
                        ? 'bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))] border-transparent text-xs'
                        : 'bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))] border-transparent text-xs'
                  }
                >
                  {t.testName}
                </Badge>
              );
            })}
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

      {/* Verify/publish banners for active test */}
      {verifyStatus[activeTest?.id] === 'verifying' && (
        <div className="chip-neutral rounded-lg px-5 py-3.5 mb-4 text-muted-foreground text-sm font-medium">
          Verifying…
        </div>
      )}
      {verifyStatus[activeTest?.id] === 'verified' && (
        <div className="bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-border))] rounded-lg px-5 py-3.5 mb-4 text-[hsl(var(--status-success-fg))] text-sm font-medium">
          ✅ Verified. Publishing report…
        </div>
      )}
      {verifyStatus[activeTest?.id] === 'published' && publishedDocs[activeTest?.id] && (
        <div className="bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-border))] rounded-lg px-5 py-4 mb-4">
          <div className="font-bold text-[hsl(var(--status-success-fg))] mb-2.5">✅ Report Published</div>
          <div className="flex gap-2.5 flex-wrap">
            <Button onClick={() => handleOpenPdf(publishedDocs[activeTest.id])}>Open PDF</Button>
          </div>
        </div>
      )}

      {/* Test tabs */}
      <Tabs value={activeTestId} onValueChange={setActiveTestId} className="mb-4">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {tests.map(t => {
            const isSubmit = t.resultStatus === 'SUBMITTED';
            const isVerif = verifyStatus[t.id] === 'published';
            return (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className={cn(
                  'gap-1.5',
                  isVerif && 'data-[state=active]:bg-[hsl(var(--status-success-bg))] data-[state=active]:text-[hsl(var(--status-success-fg))]',
                  isSubmit && !isVerif && 'data-[state=active]:bg-[hsl(var(--status-success-bg))] data-[state=active]:text-[hsl(var(--status-success-fg))]'
                )}
              >
                {t.testName}
                {isVerif
                  ? <span className="ml-1 text-xs">✅</span>
                  : isSubmit
                    ? <span className="ml-1 text-xs text-[hsl(var(--status-success-fg))]">✓</span>
                    : <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[hsl(var(--status-warning-fg))] inline-block" />
                }
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Parameters table for active test */}
      {parameters.length === 0 ? (
        <SectionCard>
          <p className="text-muted-foreground text-center py-4">No parameters defined for this test.</p>
        </SectionCard>
      ) : (
        <SectionCard noPadding className="mb-4">
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
                const isLocked = isTestSubmitted && p.locked;
                const currentValue = testValues[p.parameterId] ?? '';
                const currentFlag = testFlags[p.parameterId] ?? null;

                const cycleFlag = () => {
                  if (isLocked) return;
                  const idx = FLAG_CYCLE.indexOf(currentFlag);
                  const next = FLAG_CYCLE[(idx + 1) % FLAG_CYCLE.length];
                  setLocalFlags(f => ({
                    ...f,
                    [activeTest.id]: { ...f[activeTest.id], [p.parameterId]: next },
                  }));
                };

                const onValueChange = (val: string) => {
                  setLocalValues(v => ({
                    ...v,
                    [activeTest.id]: { ...v[activeTest.id], [p.parameterId]: val },
                  }));
                };

                const renderInput = () => {
                  if (p.dataType === 'select' && Array.isArray(p.allowedValues) && p.allowedValues.length > 0) {
                    return (
                      <select disabled={isLocked} value={currentValue} onChange={e => onValueChange(e.target.value)} className={inputCls(isLocked)}>
                        <option value="">—</option>
                        {p.allowedValues.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    );
                  }
                  if (p.dataType === 'boolean') {
                    return (
                      <select disabled={isLocked} value={currentValue} onChange={e => onValueChange(e.target.value)} className={inputCls(isLocked)}>
                        <option value="">—</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    );
                  }
                  if (p.dataType === 'number') {
                    return (
                      <input type="number" step="any" readOnly={isLocked} value={currentValue} onChange={e => onValueChange(e.target.value)} className={inputCls(isLocked)} />
                    );
                  }
                  return (
                    <input type="text" readOnly={isLocked} value={currentValue} onChange={e => onValueChange(e.target.value)} className={inputCls(isLocked)} />
                  );
                };

                return (
                  <tr key={p.parameterId} className={cn(
                    'border-t border-muted/50',
                    !isLocked && 'bg-muted/30 dark:bg-slate-800/30 hover:bg-muted/50',
                    isLocked && 'bg-muted/20',
                  )}>
                    <td className="px-4 py-2.5 text-sm text-foreground font-medium">
                      {p.name}{isLocked && <span className="ml-1.5 text-xs">🔒</span>}
                    </td>
                    <td className="px-4 py-2.5">{renderInput()}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.unit ?? '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.referenceRange ?? '—'}</td>
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

      {/* Per-test action buttons */}
      <div className="flex gap-2 flex-wrap mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSave(activeTest.id)}
          disabled={!specimenReady || saving[activeTest.id]}
        >
          {saving[activeTest.id] ? 'Saving…' : 'Save'}
        </Button>
        {showSubmitOnly(flags) && !isTestSubmitted && (
          <Button
            size="sm"
            onClick={() => handleSubmit(activeTest.id)}
            disabled={!specimenReady || submitting[activeTest.id]}
          >
            {submitting[activeTest.id] ? 'Submitting…' : 'Submit'}
          </Button>
        )}
        {showSubmitAndVerify(flags) && !isTestSubmitted && (
          <Button
            size="sm"
            onClick={() => handleSubmitAndVerify(activeTest.id)}
            disabled={!specimenReady || verifying[activeTest.id] || (verifyStatus[activeTest.id] ?? 'idle') !== 'idle'}
            className="bg-primary hover:bg-primary/90"
          >
            {verifying[activeTest.id] ? 'Verifying…' : 'Submit & Verify'}
          </Button>
        )}
      </div>

      {/* Divider + bulk actions */}
      {tests.length > 1 && (
        <div className="border-t pt-4 flex gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground self-center">All tests:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAll}
            disabled={!specimenReady || savingAll}
          >
            {savingAll ? 'Saving all…' : 'Save all'}
          </Button>
          {showSubmitOnly(flags) && !allPendingDone && (
            <Button
              size="sm"
              onClick={handleSubmitAll}
              disabled={!specimenReady || submittingAll}
            >
              {submittingAll ? 'Submitting all…' : 'Submit all'}
            </Button>
          )}
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
