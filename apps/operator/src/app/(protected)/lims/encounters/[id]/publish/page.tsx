'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
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
  const params = useParams();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loadingEncounter, setLoadingEncounter] = useState(true);
  const [encounterError, setEncounterError] = useState('');

  const [document, setDocument] = useState<any>(null);
  const [downloadError, setDownloadError] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDocument = async () => {
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/documents', { params: { query: { sourceRef: id, sourceType: 'ENCOUNTER', limit: 1 } } });
      if (data && Array.isArray(data) && data.length > 0) {
        setDocument(data[0]);
        return data[0];
      }
    } catch {}
    return null;
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const doc = await fetchDocument();
      if (doc && (doc.status === 'PUBLISHED' || doc.status === 'FAILED')) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
      }
    }, 3000);
  };

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } })
      .then(({ data, error: apiError }) => {
        if (apiError || !data) { setEncounterError('Failed to load encounter'); return; }
        setEncounter(data);
      })
      .catch(() => setEncounterError('Failed to load encounter'))
      .finally(() => setLoadingEncounter(false));

    fetchDocument().then((doc) => {
      if (doc && doc.status !== 'PUBLISHED' && doc.status !== 'FAILED') {
        startPolling();
      }
      if (!doc) startPolling();
    });

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  const handleDownload = async () => {
    if (!document) return;
    setDownloadError('');
    try {
      const client = getApiClient(getToken() ?? undefined);
      // @ts-ignore – /documents/{id}/download not yet in SDK types
      const { data: blob, error: dlError } = await client.GET('/documents/{id}/download', {
        params: { path: { id: document.id } },
        parseAs: 'blob',
      });
      if (dlError || !blob) { setDownloadError('Download failed'); return; }
      const url = URL.createObjectURL(blob as Blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `report-${document.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Download failed');
    }
  };

  if (loadingEncounter) return <p style={{ color: '#64748b' }}>Loading encounter...</p>;
  if (encounterError) return <p style={{ color: '#ef4444' }}>{encounterError}</p>;
  if (!encounter) return null;

  const docStatus: string | undefined = document?.status;
  const docColors = docStatus ? (DOC_STATUS_COLORS[docStatus] ?? DOC_STATUS_COLORS.DRAFT) : null;

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href={`/lims/encounters/${id}`} style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Encounter</Link>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ fontSize: '14px', color: '#64748b' }}>Report Status</span>
      </div>

      <IdentityHeader
        patient={encounter.patient}
        encounterId={encounter.id}
        status={encounter.status}
        createdAt={encounter.createdAt}
      />

      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '32px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Lab Report</h3>
        <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '14px' }}>
          Report is automatically generated and published when the encounter is verified.
        </p>

        {/* Document status */}
        {!document && (
          <p style={{ color: '#64748b', fontSize: '14px' }}>⏳ Waiting for report to be generated...</p>
        )}

        {document && docColors && (
          <div style={{ marginBottom: '24px', padding: '12px 16px', borderRadius: '6px', background: docColors.bg, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 700, color: docColors.text }}>Status: </span>
            <span style={{ color: docColors.text, fontWeight: 600 }}>{docStatus}</span>
            {(docStatus === 'RENDERING' || docStatus === 'RENDERED') && <span style={{ color: docColors.text, fontSize: '13px' }}>⏳ Generating PDF...</span>}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: docColors.text, fontFamily: 'monospace' }}>{document.id?.slice(0, 8)}…</span>
          </div>
        )}

        {downloadError && (
          <p style={{ color: '#ef4444', marginBottom: '16px', background: '#fee2e2', padding: '10px 16px', borderRadius: '6px', fontSize: '14px' }}>
            {downloadError}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
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
      </div>
    </div>
  );
}


