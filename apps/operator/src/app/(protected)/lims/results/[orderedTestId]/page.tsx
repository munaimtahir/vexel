'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useFeatureFlags, showSubmitAndVerify, showSubmitOnly } from '@/hooks/use-feature-flags';

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

const FLAG_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  high:     { bg: '#fee2e2', color: '#dc2626', label: 'H' },
  low:      { bg: '#dbeafe', color: '#2563eb', label: 'L' },
  normal:   { bg: '#f0fdf4', color: '#16a34a', label: 'N' },
  critical: { bg: '#fce7f3', color: '#9333ea', label: '!' },
};
const FLAG_CYCLE: (string | null)[] = [null, 'high', 'low', 'normal'];

function FlagBadge({ flag, locked, onClick }: { flag: string | null; locked: boolean; onClick: () => void }) {
  if (!flag) {
    return (
      <span
        onClick={locked ? undefined : onClick}
        title={locked ? undefined : 'Click to set flag'}
        style={{
          display: 'inline-block',
          width: '24px',
          height: '24px',
          lineHeight: '24px',
          textAlign: 'center',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          background: '#f1f5f9',
          color: '#94a3b8',
          cursor: locked ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      >—</span>
    );
  }
  const s = FLAG_COLORS[flag] ?? { bg: '#f1f5f9', color: '#64748b', label: flag.charAt(0).toUpperCase() };
  return (
    <span
      onClick={locked ? undefined : onClick}
      title={locked ? undefined : 'Click to cycle flag'}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        cursor: locked ? 'default' : 'pointer',
        userSelect: 'none',
      }}
    >{s.label}</span>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: '#1e293b',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 500,
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    }}>{message}</div>
  );
}

export default function ResultsEntryPage() {
  const params = useParams();
  const orderedTestId = params.orderedTestId as string;
  const router = useRouter();
  const { flags } = useFeatureFlags();

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

  const handleSave = async () => {
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
      setToast('Saved ✓');
    } catch {
      setActionError('Save failed');
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
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data, error: apiErr } = await api.POST('/results/tests/{orderedTestId}:submit', {
        params: { path: { orderedTestId } },
        body: {},
      });
      if (apiErr) { setActionError('Submit failed'); return; }
      if (data) setDetail(data);
      setToast('Submitted ✓');
      await navigateAfterAction(detail.encounterId);
    } catch {
      setActionError('Submit failed');
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

  if (loading) return <p style={{ color: '#64748b', padding: '24px' }}>Loading...</p>;
  if (error) return <p style={{ color: '#ef4444', padding: '24px' }}>{error}</p>;
  if (!detail) return null;

  const patient = detail.patient;
  const parameters: any[] = detail.parameters ?? [];

  const inputStyle = (locked: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    width: '160px',
    background: locked ? '#f8fafc' : 'white',
    color: locked ? '#64748b' : '#1e293b',
  });

  const btnBase: React.CSSProperties = {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'white',
        zIndex: 100,
        padding: '16px 0',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        marginBottom: '24px',
      }}>
        {/* Back button row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Link href="/lims/results" style={{ color: '#2563eb', fontSize: '14px', textDecoration: 'none', fontWeight: 500 }}>
            ← Back to Results
          </Link>
          {!specimenReady && (
            <Link
              href="/lims/sample-collection"
              style={{ color: '#f59e0b', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}
            >
              Go to Sample Collection
            </Link>
          )}
        </div>

        {/* Patient + test info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            {patient && (
              <div style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  {patient.firstName} {patient.lastName}
                </span>
                <span style={{ marginLeft: '10px', fontSize: '13px', color: '#64748b' }}>
                  {patient.mrn} · {patientLabel(patient)}
                </span>
              </div>
            )}
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Order: <span style={{ fontFamily: 'monospace', color: '#475569' }}>{detail.encounterCode ?? detail.encounterId?.slice(0, 12)}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>{detail.testName}</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {detail.specimenStatus && (
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, background: '#f0f9ff', color: '#0369a1' }}>
                  {detail.specimenStatus}
                </span>
              )}
              <span style={{
                padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                background: isSubmitted ? '#f0fdf4' : '#fff7ed',
                color: isSubmitted ? '#16a34a' : '#c2410c',
              }}>
                {detail.resultStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Specimen gate warning */}
      {!specimenReady && (
        <div style={{
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#c2410c' }}>
              Sample not collected. Collect the sample first before entering results.
            </span>
            <span style={{ marginLeft: '8px' }}>
              <Link href="/lims/sample-collection" style={{ color: '#2563eb', fontSize: '13px' }}>Go to Sample Collection →</Link>
            </span>
          </div>
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px 16px', marginBottom: '16px', color: '#dc2626', fontSize: '14px' }}>
          {actionError}
        </div>
      )}

      {/* Verify / publish status banner */}
      {verifyStatus === 'verifying' && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '14px 20px', marginBottom: '16px', color: '#0369a1', fontSize: '14px', fontWeight: 500 }}>
          Verifying…
        </div>
      )}
      {verifyStatus === 'verified' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 20px', marginBottom: '16px', color: '#16a34a', fontSize: '14px', fontWeight: 500 }}>
          ✅ Verified. Publishing report…
        </div>
      )}
      {verifyStatus === 'published' && publishedDoc && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 20px', marginBottom: '16px' }}>
          <div style={{ color: '#16a34a', fontWeight: 700, marginBottom: '10px' }}>✅ Report Published</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => handleOpenPdf(publishedDoc)} style={{ ...btnBase, background: '#2563eb', color: 'white' }}>Open PDF</button>
            <button onClick={() => handleDownloadPdf(publishedDoc)} style={{ ...btnBase, background: '#16a34a', color: 'white' }}>Download PDF</button>
            <button
              onClick={() => navigateAfterAction(detail.encounterId)}
              style={{ ...btnBase, background: '#f8fafc', color: '#1e293b', border: '1px solid #e2e8f0' }}
            >
              Next test →
            </button>
          </div>
        </div>
      )}

      {/* Parameters table */}
      {parameters.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', margin: 0 }}>No parameters defined for this test.</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Parameter', 'Value', 'Unit', 'Ref Range', 'Flag'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parameters.map((p: any) => {
                const isLocked = isSubmitted && p.locked;
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
                        style={inputStyle(isLocked)}
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
                        style={inputStyle(isLocked)}
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
                        style={inputStyle(isLocked)}
                      />
                    );
                  }
                  return (
                    <input
                      type="text"
                      readOnly={isLocked}
                      value={currentValue}
                      onChange={e => setLocalValues(v => ({ ...v, [p.parameterId]: e.target.value }))}
                      style={inputStyle(isLocked)}
                    />
                  );
                };

                return (
                  <tr key={p.parameterId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 16px', fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>
                      {p.name}
                      {isLocked && <span style={{ marginLeft: '6px', fontSize: '12px' }}>🔒</span>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {renderInput()}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#64748b' }}>
                      {p.unit ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: '#64748b' }}>
                      {p.referenceRange ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <FlagBadge flag={currentFlag} locked={isLocked} onClick={cycleFlag} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action buttons footer */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        padding: '16px 0',
        borderTop: '1px solid #e2e8f0',
      }}>
        <button
          onClick={handleSave}
          disabled={!specimenReady || saving}
          style={{ ...btnBase, background: specimenReady ? '#f8fafc' : '#f1f5f9', color: specimenReady ? '#1e293b' : '#94a3b8', border: '1px solid #e2e8f0', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {showSubmitOnly(flags) && (
          <button
            onClick={handleSubmit}
            disabled={!specimenReady || submitting}
            style={{ ...btnBase, background: specimenReady ? '#2563eb' : '#93c5fd', color: 'white', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        )}
        {showSubmitAndVerify(flags) && (
          <button
            onClick={handleSubmitAndVerify}
            disabled={!specimenReady || verifying || verifyStatus !== 'idle'}
            style={{ ...btnBase, background: specimenReady && verifyStatus === 'idle' ? '#16a34a' : '#86efac', color: 'white', opacity: verifying ? 0.7 : 1 }}
          >
            {verifying ? 'Verifying…' : 'Submit & Verify'}
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}
