'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import EncounterSummaryCard from '@/components/encounter-summary-card';

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};

export default function ReceiveSpecimenPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } })
      .then(({ data, error: err }) => {
        if (err || !data) { setError('Failed to load encounter'); return; }
        setEncounter(data);
      })
      .catch(() => setError('Failed to load encounter'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReceive = async () => {
    setSubmitting(true);
    setApiError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { error: err, response } = await api.POST('/encounters/{encounterId}:receive-specimen', {
        params: { path: { encounterId: id } },
        body: { notes: notes || undefined } as any,
      });
      if (response?.status === 409) {
        setApiError('Specimen already received or encounter is not in the correct state.');
        return;
      }
      if (err) { setApiError('Failed to receive specimen'); return; }
      setSuccess(true);
    } catch {
      setApiError('Failed to receive specimen');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{ color: '#64748b' }}>Loading...</p>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  if (!encounter) return null;

  if (success) {
    return (
      <div>
        <EncounterSummaryCard encounter={encounter} />
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
          <p style={{ margin: '0 0 8px', color: '#15803d', fontWeight: 600, fontSize: '16px' }}>
            ✓ Specimen received in lab
          </p>
          <p style={{ margin: 0, color: '#166534', fontSize: '14px' }}>
            Specimen has been logged as received. You may now enter results.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href={`/lims/encounters/${id}/results`}
            style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
            Enter Results →
          </Link>
          <Link href={`/lims/encounters/${id}`}
            style={{ padding: '10px 20px', background: 'white', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}>
            Back to Encounter
          </Link>
        </div>
      </div>
    );
  }

  if (encounter.status !== 'specimen_collected') {
    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <Link href={`/lims/encounters/${id}`} style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Back to Encounter</Link>
        </div>
        <EncounterSummaryCard encounter={encounter} />
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px 20px' }}>
          <p style={{ margin: 0, color: '#92400e', fontWeight: 500 }}>
            ⚠ Specimen can only be received when encounter is in <strong>specimen_collected</strong> status. Current: <strong>{encounter.status}</strong>
          </p>
          <p style={{ margin: '8px 0 0' }}>
            <Link href={`/lims/encounters/${id}`} style={{ color: '#92400e', fontWeight: 600 }}>← Return to encounter</Link>
          </p>
        </div>
      </div>
    );
  }

  // Derive specimen info from first lab order
  const firstOrder = (encounter.labOrders ?? [])[0];
  const specimen = firstOrder?.specimen;

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href={`/lims/encounters/${id}`} style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Encounter</Link>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ fontSize: '14px', color: '#64748b' }}>Receive Specimen</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      {specimen && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Collected Specimen</h4>
          <div style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
            {specimen.barcode && <div><span style={{ color: '#94a3b8' }}>Barcode: </span><strong style={{ fontFamily: 'monospace' }}>{specimen.barcode}</strong></div>}
            {specimen.specimenType && <div><span style={{ color: '#94a3b8' }}>Type: </span><strong>{specimen.specimenType}</strong></div>}
            {specimen.collectedAt && <div><span style={{ color: '#94a3b8' }}>Collected: </span><strong>{new Date(specimen.collectedAt).toLocaleString()}</strong></div>}
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px', maxWidth: '480px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Confirm Specimen Receipt</h3>
        <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>
          Mark this specimen as physically received in the laboratory. This will timestamp receipt and advance the workflow.
        </p>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Any receipt notes (condition of specimen, etc.)..."
          />
        </div>

        {apiError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{apiError}</p>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleReceive}
            disabled={submitting}
            style={{
              flex: 1, padding: '12px',
              background: submitting ? '#94a3b8' : '#0ea5e9',
              color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Confirming...' : '✓ Confirm Receipt'}
          </button>
          <button
            onClick={() => router.back()}
            style={{ padding: '12px 24px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>

        <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#94a3b8' }}>
          Note: You can also skip this step and go directly to result entry.
        </p>
      </div>
    </div>
  );
}
