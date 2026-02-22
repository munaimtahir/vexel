'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import EncounterSummaryCard from '@/components/encounter-summary-card';
import DocumentList from '@/components/document-list';
import { useDocumentPolling } from '@/hooks/use-document-polling';

export default function VerifyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const { documents, polling, startPolling, refetch: refetchDocs } = useDocumentPolling(id);

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } })
      .then(({ data, error: apiError }) => {
        if (apiError || !data) { setError('Failed to load encounter'); return; }
        setEncounter(data);
        // If already verified, start polling for docs
        if ((data as any).status === 'verified') {
          startPolling(id);
        }
      })
      .catch(() => setError('Failed to load encounter'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiError, response } = await api.POST('/encounters/{encounterId}:verify', {
        params: { path: { encounterId: id } },
      });
      if (response?.status === 403) {
        setError('You do not have permission to verify');
        setShowModal(false);
        return;
      }
      if (apiError) { setError('Failed to verify encounter'); setShowModal(false); return; }
      setShowModal(false);
      setVerified(true);
      // Refresh encounter state
      const api2 = getApiClient(getToken() ?? undefined);
      const { data } = await api2.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } });
      if (data) setEncounter(data);
      // Start polling for report document
      startPolling(id);
    } catch {
      setError('Failed to verify encounter');
      setShowModal(false);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <p style={{ color: '#64748b' }}>Loading encounter...</p>;
  if (error && !encounter) return <p style={{ color: '#ef4444' }}>{error}</p>;
  if (!encounter) return null;

  const orders: any[] = encounter.labOrders ?? [];
  const publishedDoc = documents.find((d: any) => d.status === 'PUBLISHED');

  if (encounter.status !== 'resulted' && !verified) {
    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <Link href={`/encounters/${id}`} style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Back to Encounter</Link>
        </div>
        <EncounterSummaryCard encounter={encounter} />
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px 20px' }}>
          <p style={{ margin: 0, color: '#92400e', fontWeight: 500 }}>
            ⚠ Encounter must be in <strong>resulted</strong> status to verify. Current status: <strong>{encounter.status}</strong>
          </p>
          <p style={{ margin: '8px 0 0' }}>
            {encounter.status === 'specimen_collected' && (
              <Link href={`/encounters/${id}/results`} style={{ color: '#92400e', fontWeight: 600 }}>→ Enter results first</Link>
            )}
            {encounter.status !== 'specimen_collected' && (
              <Link href={`/encounters/${id}`} style={{ color: '#92400e', fontWeight: 600 }}>← Return to encounter</Link>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href={`/encounters/${id}`} style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Encounter</Link>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ fontSize: '14px', color: '#64748b' }}>Verify Results</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      {error && <p style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</p>}

      {/* Read-only results table */}
      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Results for Verification (Read-only)</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Test', 'Value', 'Unit', 'Ref Range', 'Flag'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No lab orders found.</td></tr>
            ) : orders.map((order: any) => (
              <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{order.test?.name ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b' }}>{order.result?.value ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{order.result?.unit ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{order.result?.referenceRange ?? '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  {order.result?.flag ? (
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                      background: order.result.flag === 'critical' ? '#fee2e2' : order.result.flag === 'normal' ? '#d1fae5' : '#fef3c7',
                      color: order.result.flag === 'critical' ? '#991b1b' : order.result.flag === 'normal' ? '#065f46' : '#92400e',
                    }}>
                      {order.result.flag}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Documents section */}
      {(encounter.status === 'verified' || verified) && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Lab Report</h3>
            {polling && <span style={{ color: '#b45309', fontSize: '13px' }}>⏳ Generating report...</span>}
          </div>
          {publishedDoc && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px 16px', marginBottom: '12px' }}>
              <span style={{ color: '#15803d', fontWeight: 600 }}>✓ Report ready — </span>
              <Link href={`/encounters/${id}/reports`} style={{ color: '#15803d', fontWeight: 600 }}>Download ↗</Link>
            </div>
          )}
          <DocumentList documents={documents} onRefresh={refetchDocs} />
        </div>
      )}

      {encounter.status === 'resulted' && !verified && (
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: '12px 32px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
        >
          Verify &amp; Publish
        </button>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '32px', maxWidth: '440px', width: '100%', margin: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Verify & Publish Results</h3>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
              Verify all results for <strong>{encounter.patient?.firstName} {encounter.patient?.lastName}</strong>? This will publish the lab report. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={verifying}
                style={{ padding: '8px 24px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: verifying ? 'not-allowed' : 'pointer' }}
              >
                {verifying ? 'Verifying...' : 'Confirm Verify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
