'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type FilledParam = {
  parameterId?: string | null;
  name?: string;
  value?: string;
  unit?: string | null;
  referenceRange?: string | null;
  flag?: 'normal' | 'high' | 'low' | 'critical' | null;
};

type TestCard = {
  labOrderId: string;
  testName: string;
  resultStatus: 'SUBMITTED' | 'VERIFIED';
  submittedAt?: string | null;
  filledParameters?: FilledParam[];
};

type VerificationDetail = {
  encounter?: { id: string; encounterCode?: string | null };
  patient?: {
    id: string; firstName: string; lastName: string; mrn: string;
    dateOfBirth?: string | null; ageYears?: number | null; gender?: string | null;
  };
  submittedTestsCount?: number;
  pendingVerificationCount?: number;
  testCards?: TestCard[];
};

type QueueSummary = {
  encounterId: string;
  encounterCode?: string | null;
};

function calcAge(dob?: string | null, ageYears?: number | null): string {
  if (ageYears != null) return `${ageYears}y`;
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years}y`;
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' +
    d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function VerificationEncounterPage() {
  const router = useRouter();
  const params = useParams();
  const encounterId = params.encounterId as string;

  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadAll, setLoadAll] = useState(true);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  // Verify flow state
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verified, setVerified] = useState(false);
  const [renderedDocId, setRenderedDocId] = useState<string | null>(null);
  const [pollingMsg, setPollingMsg] = useState('');

  // Queue navigation
  const [nextEncounterId, setNextEncounterId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiErr } = await api.GET('/verification/encounters/{encounterId}', {
        params: { path: { encounterId } },
      });
      if (apiErr || !data) { setError('Failed to load encounter'); return; }
      setDetail(data as VerificationDetail);
      const cards = (data as VerificationDetail).testCards ?? [];
      if (cards.length > 0 && !selectedTest) setSelectedTest(cards[0].labOrderId);
    } catch {
      setError('Failed to load encounter');
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async (): Promise<QueueSummary[]> => {
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data } = await api.GET('/verification/encounters/pending', {
        params: { query: { limit: 50 } },
      });
      const list: QueueSummary[] = Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray(data) ? data : [];
      return list;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    loadDetail();
    loadQueue().then(queue => {
      const idx = queue.findIndex(q => q.encounterId === encounterId);
      // next is the one after current in queue (excluding current)
      const rest = queue.filter(q => q.encounterId !== encounterId);
      if (rest.length > 0) setNextEncounterId(rest[0].encounterId);
    });
  }, [encounterId]);

  // Cleanup countdown on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const scrollToTest = (labOrderId: string) => {
    setSelectedTest(labOrderId);
    if (!loadAll) return; // card is already visible in loadAll mode via id
    const el = document.getElementById(`test-card-${labOrderId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pollForDocument = async () => {
    setPollingMsg('Waiting for report to finish rendering…');
    const start = Date.now();
    const api = getApiClient(getToken() ?? undefined);
    return new Promise<string | null>((resolve) => {
      const interval = setInterval(async () => {
        if (Date.now() - start > 30000) {
          clearInterval(interval);
          setPollingMsg('Report rendering took longer than expected. Check documents later.');
          resolve(null);
          return;
        }
        try {
          const { data } = await api.GET('/documents', {
            params: { query: { encounterId, docType: 'LAB_REPORT', limit: 1 } },
          });
          const docs: any[] = Array.isArray(data) ? data : [];
          if (docs.length > 0) {
            const doc = docs[0];
            if (doc.status === 'RENDERED' || doc.status === 'PUBLISHED') {
              clearInterval(interval);
              resolve(doc.id);
            }
          }
        } catch { /* continue polling */ }
      }, 2000);
    });
  };

  const startCountdown = (nextId: string | null) => {
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current!);
          if (nextId) router.push(`/lims/verification/encounters/${nextId}`);
          else router.push('/lims/verification');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiErr } = await api.POST('/verification/encounters/{encounterId}:verify', {
        params: { path: { encounterId } },
      });
      if (apiErr) {
        setVerifyError('Verification failed. Please try again.');
        return;
      }
      setVerified(true);

      // Reload queue to find next patient
      const freshQueue = await loadQueue();
      const nextId = freshQueue.length > 0 ? freshQueue[0].encounterId : null;
      setNextEncounterId(nextId);

      // Poll for rendered document
      const docId = await pollForDocument();
      setRenderedDocId(docId);
      setPollingMsg('');

      startCountdown(nextId);
    } catch {
      setVerifyError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleNavigateNext = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (nextEncounterId) router.push(`/lims/verification/encounters/${nextEncounterId}`);
    else router.push('/lims/verification');
  };

  if (loading) return <div className="p-10 text-muted-foreground">Loading...</div>;
  if (error) return <div className="p-10 text-destructive">{error}</div>;
  if (!detail) return null;

  const { patient: p, encounter, submittedTestsCount = 0, pendingVerificationCount = 0, testCards = [] } = detail;
  const age = p ? calcAge(p.dateOfBirth, p.ageYears) : '—';
  const sex = p?.gender ? p.gender.charAt(0).toUpperCase() : '—';
  const visibleCards = loadAll ? testCards : testCards.filter(c => c.labOrderId === selectedTest);

  return (
    <div className="flex flex-col h-full relative">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Patient info */}
          <div>
            <div className="text-lg font-bold text-foreground">
              {p ? `${p.firstName} ${p.lastName}` : '—'}
              <span className="font-normal text-sm text-muted-foreground ml-3">
                MRN: {p?.mrn ?? '—'} · {age}/{sex}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              Order: <span className="font-mono font-semibold">{encounter?.encounterCode ?? '—'}</span>
              <span className="ml-4">
                Submitted: <strong>{submittedTestsCount}</strong> tests ·{' '}
                Pending: <strong className={pendingVerificationCount > 0 ? 'text-[hsl(var(--status-warning-fg))]' : 'text-[hsl(var(--status-success-fg))]'}>
                  {pendingVerificationCount}
                </strong>
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 items-center flex-wrap">
            <Button variant="outline" size="sm" onClick={() => router.push('/lims/verification')}>← Back</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLoadAll(v => !v)}
              className={cn(loadAll ? "bg-muted border-border text-primary" : "")}
            >
              {loadAll ? 'Show one test' : 'Load all tests'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/lims/verification')}>Skip</Button>
            {!verified && (
              <Button
                onClick={handleVerify}
                disabled={verifying || pendingVerificationCount === 0}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {verifying ? 'Verifying…' : '✅ Verify patient'}
              </Button>
            )}
          </div>
        </div>

        {verifyError && (
          <div className="mt-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
            {verifyError}
          </div>
        )}
      </div>

      {/* Success banner */}
      {verified && (
        <div className="mx-6 mt-4 p-4 chip-success rounded-lg">
          <div className="text-base font-semibold text-[hsl(var(--status-success-fg))] mb-1.5">
            ✅ All tests verified. Report rendering started…
          </div>
          {pollingMsg && (
            <div className="text-sm text-[hsl(var(--status-success-fg))]">{pollingMsg}</div>
          )}
          {renderedDocId && (
            <div className="mt-2 flex gap-3 items-center">
              <span className="text-sm font-medium text-[hsl(var(--status-success-fg))]">📄 Report rendered</span>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white" asChild>
                <a href={`/lims/encounters/${encounterId}/publish`}>Publish report</a>
              </Button>
            </div>
          )}
          <div className="mt-3 flex gap-2.5 items-center">
            <Button onClick={handleNavigateNext} className="mt-3">
              {countdown !== null
                ? `Next patient in ${countdown}…`
                : nextEncounterId ? 'Next patient →' : 'Back to worklist'}
            </Button>
          </div>
        </div>
      )}

      {/* Body: sidebar + cards */}
      <div className="flex flex-1 overflow-hidden mt-4">
        {/* Left sidebar */}
        <div className="w-40 flex-shrink-0 sticky top-[130px] self-start px-2 pl-4 max-h-[calc(100vh-130px)] overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Tests</div>
          {testCards.map(card => (
            <button
              key={card.labOrderId}
              onClick={() => scrollToTest(card.labOrderId)}
              className={cn("flex items-center gap-1.5 w-full text-left rounded-md px-2 py-1.5 text-xs mb-0.5 cursor-pointer border-none", selectedTest === card.labOrderId ? "bg-muted text-primary font-medium" : "text-muted-foreground hover:bg-muted/50")}
            >
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", card.resultStatus === 'VERIFIED' ? "bg-[hsl(var(--status-success-bg))]0" : "bg-primary")} />
              <span className="leading-snug">{card.testName}</span>
            </button>
          ))}
        </div>

        {/* Main scroll area */}
        <div className="flex-1 overflow-y-auto px-6 pb-20">
          {visibleCards.length === 0 && (
            <div className="text-muted-foreground py-8 text-center">No test cards to display</div>
          )}
          {visibleCards.map(card => (
            <div
              key={card.labOrderId}
              id={`test-card-${card.labOrderId}`}
              className="border rounded-xl mb-4 bg-card shadow-sm"
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="font-bold text-base text-foreground">{card.testName}</div>
                <div className="flex gap-3 items-center">
                  {card.resultStatus === 'VERIFIED'
                    ? <Badge className="bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))] border-[hsl(var(--status-success-border))]">Verified</Badge>
                    : <Badge className="bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))] border-[hsl(var(--status-warning-border))]">Pending Verification</Badge>
                  }
                  <span className="text-xs text-muted-foreground ml-2">{fmtTime(card.submittedAt)}</span>
                </div>
              </div>

              {/* Card body */}
              <div className="px-4 py-3">
                {!card.filledParameters || card.filledParameters.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No results entered yet</p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/30">
                        {['Parameter', 'Result', 'Unit', 'Ref Range', 'H/L'].map(h => (
                          <th key={h} className="px-2.5 py-2 text-left font-semibold text-muted-foreground border-b border-border">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {card.filledParameters.map((fp, i) => {
                        const flagLabel = fp.flag === 'high' ? 'H' : fp.flag === 'low' ? 'L'
                          : fp.flag === 'critical' ? 'C!' : fp.flag === 'normal' ? 'N' : '—';
                        return (
                          <tr key={fp.parameterId ?? i} className="border-b border-muted/30">
                            <td className="px-2.5 py-2 text-muted-foreground">{fp.name ?? '—'}</td>
                            <td className={cn("px-2.5 py-2 font-semibold", fp.flag && fp.flag !== 'normal' ? "text-destructive" : "text-foreground")}>
                              {fp.value ?? '—'}
                            </td>
                            <td className="px-2.5 py-2 text-muted-foreground">{fp.unit ?? '—'}</td>
                            <td className="px-2.5 py-2 text-muted-foreground">{fp.referenceRange ?? '—'}</td>
                            <td className="px-2.5 py-2">
                              {fp.flag ? (
                                fp.flag !== 'normal'
                                  ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-[hsl(var(--status-destructive-bg))] text-[hsl(var(--status-destructive-fg))]">{flagLabel}</span>
                                  : <span className="px-2 py-0.5 rounded text-xs font-bold bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))]">{flagLabel}</span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
