'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

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

const HEADER_HEIGHT = 130;

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
  const [publishedDocUrl, setPublishedDocUrl] = useState<string | null>(null);
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
    setPollingMsg('Waiting for report to publish…');
    const start = Date.now();
    const api = getApiClient(getToken() ?? undefined);
    return new Promise<string | null>((resolve) => {
      const interval = setInterval(async () => {
        if (Date.now() - start > 30000) {
          clearInterval(interval);
          setPollingMsg('Report publishing took longer than expected. Check documents later.');
          resolve(null);
          return;
        }
        try {
          const { data } = await api.GET('/documents', {
            params: { query: { encounterId, status: 'PUBLISHED', limit: 1 } },
          });
          const docs: any[] = Array.isArray(data) ? data : [];
          if (docs.length > 0 && docs[0].fileUrl) {
            clearInterval(interval);
            resolve(docs[0].fileUrl as string);
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
          if (nextId) router.push(`/verification/encounters/${nextId}`);
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

      // Poll for published document
      const docUrl = await pollForDocument();
      setPublishedDocUrl(docUrl);
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
    if (nextEncounterId) router.push(`/verification/encounters/${nextEncounterId}`);
    else router.push('/lims/verification');
  };

  if (loading) return <div style={{ padding: '40px', color: '#64748b' }}>Loading...</div>;
  if (error) return <div style={{ padding: '40px', color: '#ef4444' }}>{error}</div>;
  if (!detail) return null;

  const { patient: p, encounter, submittedTestsCount = 0, pendingVerificationCount = 0, testCards = [] } = detail;
  const age = p ? calcAge(p.dateOfBirth, p.ageYears) : '—';
  const sex = p?.gender ? p.gender.charAt(0).toUpperCase() : '—';
  const visibleCards = loadAll ? testCards : testCards.filter(c => c.labOrderId === selectedTest);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10, background: 'white',
        borderBottom: '1px solid #e2e8f0', padding: '16px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          {/* Patient info */}
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              {p ? `${p.firstName} ${p.lastName}` : '—'}
              <span style={{ fontWeight: 400, fontSize: '14px', color: '#64748b', marginLeft: '12px' }}>
                MRN: {p?.mrn ?? '—'} · {age}/{sex}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>
              Order: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{encounter?.encounterCode ?? '—'}</span>
              <span style={{ marginLeft: '16px' }}>
                Submitted: <strong>{submittedTestsCount}</strong> tests ·{' '}
                Pending: <strong style={{ color: pendingVerificationCount > 0 ? '#d97706' : '#16a34a' }}>
                  {pendingVerificationCount}
                </strong>
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/lims/verification')}
              style={{
                padding: '6px 14px', background: 'none', border: '1px solid #cbd5e1',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#475569',
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => setLoadAll(v => !v)}
              style={{
                padding: '6px 14px', background: loadAll ? '#eff6ff' : 'none',
                border: '1px solid ' + (loadAll ? '#bfdbfe' : '#cbd5e1'),
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                color: loadAll ? '#2563eb' : '#475569',
              }}
            >
              {loadAll ? 'Show one test' : 'Load all tests'}
            </button>
            <button
              onClick={() => router.push('/lims/verification')}
              style={{
                padding: '6px 14px', background: 'none', border: '1px solid #cbd5e1',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#475569',
              }}
            >
              Skip
            </button>
            {!verified && (
              <button
                onClick={handleVerify}
                disabled={verifying || pendingVerificationCount === 0}
                style={{
                  padding: '8px 18px', background: pendingVerificationCount === 0 ? '#e2e8f0' : '#16a34a',
                  color: pendingVerificationCount === 0 ? '#94a3b8' : 'white',
                  border: 'none', borderRadius: '6px', cursor: pendingVerificationCount === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 600,
                }}
              >
                {verifying ? 'Verifying…' : '✅ Verify patient'}
              </button>
            )}
          </div>
        </div>

        {verifyError && (
          <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fef2f2', borderRadius: '6px', color: '#dc2626', fontSize: '13px' }}>
            {verifyError}
          </div>
        )}
      </div>

      {/* Success banner */}
      {verified && (
        <div style={{
          margin: '16px 24px 0', padding: '16px', background: '#f0fdf4',
          border: '1px solid #86efac', borderRadius: '8px',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#15803d', marginBottom: '6px' }}>
            ✅ All tests verified. Publishing report…
          </div>
          {pollingMsg && (
            <div style={{ fontSize: '13px', color: '#166534' }}>{pollingMsg}</div>
          )}
          {publishedDocUrl && (
            <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#15803d', fontWeight: 500 }}>📄 Report published</span>
              <a href={publishedDocUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  padding: '6px 14px', background: '#16a34a', color: 'white',
                  borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 500,
                }}
              >
                Open PDF
              </a>
            </div>
          )}
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleNavigateNext}
              style={{
                padding: '8px 18px', background: '#2563eb', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              }}
            >
              {countdown !== null
                ? `Next patient in ${countdown}…`
                : nextEncounterId ? 'Next patient →' : 'Back to worklist'}
            </button>
          </div>
        </div>
      )}

      {/* Body: sidebar + cards */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', marginTop: '16px' }}>
        {/* Left sidebar */}
        <div style={{
          width: '160px', flexShrink: 0,
          position: 'sticky', top: HEADER_HEIGHT, alignSelf: 'flex-start',
          padding: '0 8px 0 16px', maxHeight: `calc(100vh - ${HEADER_HEIGHT}px)`, overflowY: 'auto',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
            Tests
          </div>
          {testCards.map(card => (
            <button
              key={card.labOrderId}
              onClick={() => scrollToTest(card.labOrderId)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                textAlign: 'left', background: selectedTest === card.labOrderId ? '#eff6ff' : 'none',
                border: 'none', borderRadius: '6px', padding: '7px 8px', cursor: 'pointer',
                fontSize: '12px', color: selectedTest === card.labOrderId ? '#1d4ed8' : '#475569',
                marginBottom: '2px',
              }}
            >
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: card.resultStatus === 'VERIFIED' ? '#16a34a' : '#d97706',
              }} />
              <span style={{ lineHeight: 1.3 }}>{card.testName}</span>
            </button>
          ))}
        </div>

        {/* Main scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 80px' }}>
          {visibleCards.length === 0 && (
            <div style={{ color: '#94a3b8', padding: '32px 0', textAlign: 'center' }}>
              No test cards to display
            </div>
          )}
          {visibleCards.map(card => (
            <div
              key={card.labOrderId}
              id={`test-card-${card.labOrderId}`}
              style={{
                border: '1px solid #e2e8f0', borderRadius: '10px',
                marginBottom: '16px', background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              {/* Card header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                  {card.testName}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                    background: card.resultStatus === 'VERIFIED' ? '#dcfce7' : '#fef3c7',
                    color: card.resultStatus === 'VERIFIED' ? '#15803d' : '#92400e',
                  }}>
                    {card.resultStatus === 'VERIFIED' ? 'Verified' : 'Pending Verification'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {fmtTime(card.submittedAt)}
                  </span>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: '14px 18px' }}>
                {!card.filledParameters || card.filledParameters.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No results entered yet</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Parameter', 'Result', 'Unit', 'Ref Range', 'H/L'].map(h => (
                          <th key={h} style={{
                            padding: '8px 10px', textAlign: 'left', fontWeight: 600,
                            color: '#475569', borderBottom: '1px solid #e2e8f0',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {card.filledParameters.map((fp, i) => {
                        const flagColor = fp.flag === 'high' || fp.flag === 'critical' ? '#dc2626'
                          : fp.flag === 'low' ? '#2563eb' : '#16a34a';
                        const flagLabel = fp.flag === 'high' ? 'H' : fp.flag === 'low' ? 'L'
                          : fp.flag === 'critical' ? 'C!' : fp.flag === 'normal' ? 'N' : '—';
                        return (
                          <tr key={fp.parameterId ?? i} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '8px 10px', color: '#334155' }}>{fp.name ?? '—'}</td>
                            <td style={{
                              padding: '8px 10px', fontWeight: 600,
                              color: fp.flag && fp.flag !== 'normal' ? flagColor : '#0f172a',
                            }}>
                              {fp.value ?? '—'}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>{fp.unit ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#64748b' }}>{fp.referenceRange ?? '—'}</td>
                            <td style={{ padding: '8px 10px' }}>
                              {fp.flag ? (
                                <span style={{
                                  padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                                  background: fp.flag !== 'normal' ? '#fef2f2' : '#f0fdf4',
                                  color: flagColor,
                                }}>
                                  {flagLabel}
                                </span>
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
