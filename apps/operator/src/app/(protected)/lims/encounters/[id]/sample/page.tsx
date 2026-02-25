'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import EncounterSummaryCard from '@/components/encounter-summary-card';
import { useFeatureFlags, isReceiveSeparate } from '@/hooks/use-feature-flags';

const SPECIMEN_TYPES = ['blood', 'urine', 'serum', 'other'];

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};

export default function SampleCollectionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState('');
  const [form, setForm] = useState({ barcode: '', specimenType: 'blood', notes: '' });
  const { flags } = useFeatureFlags();
  const receiveSeparate = isReceiveSeparate(flags);

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

  const handleCollect = async () => {
    if (!form.barcode.trim()) { setApiError('Barcode is required'); return; }
    setSubmitting(true);
    setApiError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { error: err, response } = await api.POST('/encounters/{encounterId}:collect-specimen', {
        params: { path: { encounterId: id } },
        body: { barcode: form.barcode, specimenType: form.specimenType, notes: form.notes || undefined } as any,
      });
      if (response?.status === 409) {
        setApiError('Specimen already collected or encounter is not in the correct state. Check current status.');
        return;
      }
      if (err) { setApiError('Failed to collect specimen'); return; }
      if (!receiveSeparate) {
        // Keep encounter-detail workflow aligned with receiveSeparate flag.
        // @ts-ignore
        await api.POST('/encounters/{encounterId}:receive-specimen', {
          params: { path: { encounterId: id } },
          body: {},
        });
      }
      setSuccess(true);
    } catch {
      setApiError('Failed to collect specimen');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{ color: 'hsl(var(--muted-foreground))' }}>Loading...</p>;
  if (error) return <p style={{ color: 'hsl(var(--destructive))' }}>{error}</p>;
  if (!encounter) return null;

  if (success) {
    return (
      <div>
        <EncounterSummaryCard encounter={encounter} />
        <div style={{ background: 'hsl(var(--status-success-bg))', border: '1px solid hsl(var(--status-success-fg)/0.3)', borderRadius: '8px', padding: '24px', marginBottom: '16px' }}>
          <p style={{ margin: '0 0 12px', color: 'hsl(var(--status-success-fg))', fontWeight: 600, fontSize: '16px' }}>
            ✓ Sample {receiveSeparate ? 'collected' : 'collected and received'} successfully
          </p>
        </div>
        <Link href={`/lims/encounters/${id}/results`} style={{ padding: '10px 20px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
          Enter Results →
        </Link>
      </div>
    );
  }

  if (encounter.status !== 'lab_ordered') {
    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <Link href={`/lims/encounters/${id}`} style={{ color: 'hsl(var(--primary))', fontSize: '14px', textDecoration: 'none' }}>← Back to Encounter</Link>
        </div>
        <EncounterSummaryCard encounter={encounter} />
        <div style={{ background: 'hsl(var(--status-warning-bg))', border: '1px solid hsl(var(--status-warning-fg)/0.35)', borderRadius: '8px', padding: '16px 20px' }}>
          <p style={{ margin: 0, color: 'hsl(var(--status-warning-fg))', fontWeight: 500 }}>
            ⚠ Not ready for sample collection. Encounter must be in <strong>lab_ordered</strong> status. Current: <strong>{encounter.status}</strong>
          </p>
          <p style={{ margin: '8px 0 0' }}>
            <Link href={`/lims/encounters/${id}`} style={{ color: 'hsl(var(--status-warning-fg))', fontWeight: 600 }}>← Return to encounter</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href={`/lims/encounters/${id}`} style={{ color: 'hsl(var(--primary))', fontSize: '14px', textDecoration: 'none' }}>← Encounter</Link>
        <span style={{ color: 'hsl(var(--border))' }}>/</span>
        <span style={{ fontSize: '14px', color: 'hsl(var(--muted-foreground))' }}>Collect Sample</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', padding: '24px', maxWidth: '480px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>Sample Collection</h3>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Barcode *</label>
          <input
            value={form.barcode}
            onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
            placeholder="Scan or enter barcode"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Specimen Type</label>
          <select value={form.specimenType} onChange={e => setForm(f => ({ ...f, specimenType: e.target.value }))} style={{ ...inputStyle, background: 'hsl(var(--card))' }}>
            {SPECIMEN_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Any collection notes..."
          />
        </div>
        {apiError && <p style={{ color: 'hsl(var(--destructive))', fontSize: '13px', marginBottom: '12px' }}>{apiError}</p>}
        <button
          onClick={handleCollect}
          disabled={submitting}
          style={{ width: '100%', padding: '12px', background: submitting ? 'hsl(var(--muted))' : 'hsl(var(--status-success-fg))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? 'Collecting...' : 'Mark Collected'}
        </button>
      </div>
    </div>
  );
}
