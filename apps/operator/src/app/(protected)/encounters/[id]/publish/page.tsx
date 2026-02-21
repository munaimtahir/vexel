'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import IdentityHeader from '@/components/identity-header';

const DOC_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT:      { bg: '#f1f5f9', text: '#475569' },
  RENDERING:  { bg: '#fef3c7', text: '#b45309' },
  RENDERED:   { bg: '#d1fae5', text: '#065f46' },
  PUBLISHED:  { bg: '#bbf7d0', text: '#14532d' },
  FAILED:     { bg: '#fee2e2', text: '#991b1b' },
};

export default function PublishPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loadingEncounter, setLoadingEncounter] = useState(true);
  const [encounterError, setEncounterError] = useState('');

  const [document, setDocument] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionError, setActionError] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } })
      .then(({ data, error: apiError }) => {
        if (apiError || !data) { setEncounterError('Failed to load encounter'); return; }
        setEncounter(data);
      })
      .catch(() => setEncounterError('Failed to load encounter'))
      .finally(() => setLoadingEncounter(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  const startPolling = (docId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const api = getApiClient(getToken() ?? undefined);
      const { data } = await api.GET('/documents/{id}', { params: { path: { id: docId } } });
      if (data) {
        setDocument(data);
        const status = (data as any).status;
        if (status === 'RENDERED' || status === 'PUBLISHED' || status === 'FAILED') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      }
    }, 3000);
  };

  const handleGenerate = async () => {
    if (!encounter) return;
    setGenerating(true);
    setActionError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const orders: any[] = encounter.labOrders ?? [];
      const body = {
        reportNumber: `RPT-${id.slice(0, 8).toUpperCase()}`,
        issuedAt: new Date().toISOString(),
        patientName: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
        patientMrn: encounter.patient.mrn,
        patientDob: encounter.patient.dateOfBirth
          ? new Date(encounter.patient.dateOfBirth).toISOString().split('T')[0]
          : undefined,
        patientGender: encounter.patient.gender ?? undefined,
        encounterId: id,
        tests: orders.map((order: any) => ({
          testCode: order.test?.code ?? order.id,
          testName: order.test?.name ?? 'Unknown',
          parameters: order.result ? [{
            parameterCode: 'result',
            parameterName: 'Result',
            value: order.result.value,
            unit: order.result.unit ?? undefined,
            referenceRange: order.result.referenceRange ?? undefined,
            flag: order.result.flag ?? undefined,
          }] : [],
        })),
      };
      const { data, error: apiError } = await api.POST('/documents/report:generate', { body: body as any });
      if (apiError || !data) { setActionError('Failed to generate report'); return; }
      setDocument(data);
      const status = (data as any).status;
      if (status !== 'RENDERED' && status !== 'PUBLISHED' && status !== 'FAILED') {
        startPolling((data as any).id);
      }
    } catch {
      setActionError('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!document) return;
    setPublishing(true);
    setActionError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.POST('/documents/{id}:publish', {
        params: { path: { id: document.id } },
      });
      if (apiError || !data) { setActionError('Failed to publish document'); return; }
      setDocument(data);
    } catch {
      setActionError('Failed to publish document');
    } finally {
      setPublishing(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;
    const api = getApiClient(getToken() ?? undefined);
    const { data, error: apiError } = await api.GET('/documents/{id}/download', {
      params: { path: { id: document.id } },
    });
    if (apiError || !data) { setActionError('Download not available yet'); return; }
    const url = (data as any).url ?? (data as any).signedUrl;
    if (url) window.open(url, '_blank');
    else setActionError('PDF download URL not available');
  };

  if (loadingEncounter) return <p style={{ color: '#64748b' }}>Loading encounter...</p>;
  if (encounterError) return <p style={{ color: '#ef4444' }}>{encounterError}</p>;
  if (!encounter) return null;

  const docStatus: string | undefined = document?.status;
  const docColors = docStatus ? (DOC_STATUS_COLORS[docStatus] ?? DOC_STATUS_COLORS.DRAFT) : null;

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href={`/encounters/${id}`} style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Encounter</Link>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ fontSize: '14px', color: '#64748b' }}>Publish Report</span>
      </div>

      <IdentityHeader
        patient={encounter.patient}
        encounterId={encounter.id}
        status={encounter.status}
        createdAt={encounter.createdAt}
      />

      {actionError && (
        <p style={{ color: '#ef4444', marginBottom: '16px', background: '#fee2e2', padding: '10px 16px', borderRadius: '6px', fontSize: '14px' }}>
          {actionError}
        </p>
      )}

      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '32px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Lab Report</h3>
        <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '14px' }}>
          Generate and publish the official lab report PDF for this encounter.
        </p>

        {/* Document status */}
        {document && docColors && (
          <div style={{ marginBottom: '24px', padding: '12px 16px', borderRadius: '6px', background: docColors.bg, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 700, color: docColors.text }}>Document: </span>
            <span style={{ color: docColors.text, fontWeight: 600 }}>{docStatus}</span>
            {docStatus === 'RENDERING' && <span style={{ color: docColors.text, fontSize: '13px' }}>⏳ Generating PDF...</span>}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: docColors.text, fontFamily: 'monospace' }}>{document.id?.slice(0, 8)}…</span>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {/* Step 1: Generate */}
          {encounter.status === 'verified' && (!document || docStatus === 'FAILED') && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{ padding: '12px 28px', background: generating ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}
            >
              {generating ? 'Generating...' : '📄 Generate Lab Report'}
            </button>
          )}

          {/* Retry on failure */}
          {docStatus === 'FAILED' && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{ padding: '12px 24px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Retry
            </button>
          )}

          {/* Step 2: Publish (when RENDERED) */}
          {docStatus === 'RENDERED' && (
            <>
              <button
                onClick={handlePublish}
                disabled={publishing}
                style={{ padding: '12px 28px', background: publishing ? '#94a3b8' : '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: publishing ? 'not-allowed' : 'pointer' }}
              >
                {publishing ? 'Publishing...' : '✅ Publish Document'}
              </button>
              <button
                onClick={handleDownload}
                style={{ padding: '12px 24px', background: 'white', color: '#3b82f6', border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                ⬇ Download PDF
              </button>
            </>
          )}

          {/* Step 3: Download + Print (when PUBLISHED) */}
          {docStatus === 'PUBLISHED' && (
            <>
              <button
                onClick={handleDownload}
                style={{ padding: '12px 28px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                ⬇ Download PDF
              </button>
              <button
                onClick={() => window.print()}
                style={{ padding: '12px 24px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
              >
                🖨 Print
              </button>
            </>
          )}
        </div>

        {encounter.status !== 'verified' && !document && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fef3c7', borderRadius: '6px', border: '1px solid #fcd34d' }}>
            <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
              ⚠ Encounter must be <strong>verified</strong> before generating a report. Current status: <strong>{encounter.status}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
