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

export default function EncounterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [document, setDocument] = useState<any>(null);
  const [downloadError, setDownloadError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEncounter = async () => {
    const api = getApiClient(getToken() ?? undefined);
    const { data, error: apiError } = await api.GET('/encounters/{encounterId}', {
      params: { path: { encounterId: id } },
    });
    if (apiError || !data) { setError('Failed to load encounter'); return; }
    setEncounter(data);
  };

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
    Promise.all([fetchEncounter(), fetchDocument()]).finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  // Start polling when encounter is verified and doc not yet published
  useEffect(() => {
    if (encounter?.status === 'verified' && document && document.status !== 'PUBLISHED' && document.status !== 'FAILED') {
      startPolling();
    }
    if (encounter?.status === 'verified' && !document) {
      // Poll for document to appear
      startPolling();
    }
  }, [encounter?.status, document?.status]);

  const handleDownload = async () => {
    if (!document) return;
    setDownloadError('');
    try {
      const token = getToken();
      const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '') + '/api';
      const res = await fetch(`${apiBase}/documents/${document.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': 'system',
        },
      });
      if (!res.ok) { setDownloadError('Download failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `report-${document.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Download failed');
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiError } = await api.POST('/encounters/{encounterId}:cancel', {
        params: { path: { encounterId: id } },
      });
      if (apiError) { setError('Failed to cancel encounter'); return; }
      setShowCancelModal(false);
      await fetchEncounter();
    } catch {
      setError('Failed to cancel encounter');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <p style={{ color: '#64748b' }}>Loading encounter...</p>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  if (!encounter) return null;

  const { status, labOrders = [], patient } = encounter;
  const docStatus: string | undefined = document?.status;
  const docColors = docStatus ? (DOC_STATUS_COLORS[docStatus] ?? DOC_STATUS_COLORS.DRAFT) : null;

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href="/encounters" style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Encounters</Link>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ fontSize: '14px', color: '#64748b' }}>Detail</span>
      </div>

      <IdentityHeader
        patient={patient}
        encounterId={encounter.id}
        status={status}
        createdAt={encounter.createdAt}
      />

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['registered', 'lab_ordered', 'specimen_collected'].includes(status) && (
          <Link
            href={`/encounters/${id}/results`}
            style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
          >
            Enter Results
          </Link>
        )}
        {status === 'resulted' && (
          <Link
            href={`/encounters/${id}/verify`}
            style={{ padding: '10px 20px', background: '#059669', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
          >
            Verify Results
          </Link>
        )}
        {status !== 'cancelled' && (
          <button
            onClick={() => setShowCancelModal(true)}
            style={{ padding: '10px 20px', background: 'white', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
          >
            Cancel Encounter
          </button>
        )}
      </div>

      {/* Document status + download (shown when verified/published) */}
      {(status === 'verified' || document) && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Lab Report</h3>
          {!document && (
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>⏳ Generating report...</p>
          )}
          {document && docColors && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 12px', borderRadius: '10px', background: docColors.bg, color: docColors.text, fontWeight: 600, fontSize: '13px' }}>
                {docStatus}
              </span>
              {(docStatus === 'RENDERING' || docStatus === 'RENDERED') && (
                <span style={{ color: '#b45309', fontSize: '13px' }}>⏳ Generating PDF...</span>
              )}
              {docStatus === 'PUBLISHED' && (
                <>
                  <button
                    onClick={handleDownload}
                    style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ⬇ Download Report
                  </button>
                  <button
                    onClick={() => { handleDownload().then(() => window.print()); }}
                    style={{ padding: '8px 16px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
                  >
                    🖨 Print
                  </button>
                  <Link
                    href={`/encounters/${id}/publish`}
                    style={{ padding: '8px 16px', color: '#3b82f6', fontSize: '13px', textDecoration: 'none' }}
                  >
                    View Report Details →
                  </Link>
                </>
              )}
              {docStatus === 'FAILED' && (
                <Link
                  href={`/encounters/${id}/publish`}
                  style={{ padding: '8px 16px', background: '#f59e0b', color: 'white', borderRadius: '6px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
                >
                  Retry Report
                </Link>
              )}
            </div>
          )}
          {downloadError && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>{downloadError}</p>}
        </div>
      )}

      {/* Lab Orders */}
      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Lab Orders</h3>
        </div>
        {labOrders.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: '#64748b', margin: 0 }}>No orders placed yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Test Name', 'Priority', 'Status', 'Specimen Barcode', 'Result Value', 'Flag'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labOrders.map((order: any) => (
                <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>{order.test?.name ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{order.priority ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{order.status ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace', color: '#64748b' }}>{order.specimen?.barcode ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>{order.result?.value ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{order.result?.flag ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '32px', maxWidth: '420px', width: '100%', margin: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Cancel Encounter</h3>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
              Are you sure you want to cancel this encounter for <strong>{patient.firstName} {patient.lastName}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCancelModal(false)}
                style={{ padding: '8px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
              >
                Keep Encounter
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{ padding: '8px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: cancelling ? 'not-allowed' : 'pointer' }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


