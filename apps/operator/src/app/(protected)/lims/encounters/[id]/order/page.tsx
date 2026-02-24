'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import EncounterSummaryCard from '@/components/encounter-summary-card';

const PRIORITIES = ['routine', 'urgent', 'stat'];

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};

export default function PlaceOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tests, setTests] = useState<any[]>([]);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [priority, setPriority] = useState('routine');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    Promise.all([
      api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } }),
      // @ts-ignore
      api.GET('/catalog/tests', { params: { query: { limit: 100 } } }),
    ]).then(([encRes, testsRes]) => {
      if (encRes.error || !encRes.data) { setError('Failed to load encounter'); return; }
      setEncounter(encRes.data);
      setTests(Array.isArray(testsRes.data) ? testsRes.data : (testsRes.data as any)?.data ?? []);
    }).catch(() => setError('Failed to load data')).finally(() => setLoading(false));
  }, [id]);

  const toggleTest = (testId: string) => {
    setSelectedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId); else next.add(testId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedTests.size === 0) { setApiError('Select at least one test'); return; }
    setSubmitting(true);
    setApiError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      for (const testId of selectedTests) {
        // @ts-ignore
        const { error: err, response } = await api.POST('/encounters/{encounterId}:order-lab', {
          params: { path: { encounterId: id } },
          body: { testId, priority } as any,
        });
        if (response?.status === 409) { setApiError('Order already placed or encounter not in correct state.'); setSubmitting(false); return; }
        if (err) { setApiError('Failed to place order'); setSubmitting(false); return; }
      }
      setSuccess(true);
    } catch {
      setApiError('Failed to place order');
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
          <p style={{ margin: '0 0 8px', color: 'hsl(var(--status-success-fg))', fontWeight: 600, fontSize: '16px' }}>
            ✓ Lab order placed — {selectedTests.size} test(s) ordered
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href={`/lims/encounters/${id}/sample`}
            style={{ padding: '10px 20px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
            Collect Sample →
          </Link>
          <Link href={`/lims/encounters/${id}`}
            style={{ padding: '10px 20px', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}>
            Back to Encounter
          </Link>
        </div>
      </div>
    );
  }

  if (encounter.status !== 'registered') {
    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <Link href={`/lims/encounters/${id}`} style={{ color: 'hsl(var(--primary))', fontSize: '14px', textDecoration: 'none' }}>← Back to Encounter</Link>
        </div>
        <EncounterSummaryCard encounter={encounter} />
        <div style={{ background: 'hsl(var(--status-warning-bg))', border: '1px solid hsl(var(--status-warning-fg)/0.35)', borderRadius: '8px', padding: '16px 20px' }}>
          <p style={{ margin: 0, color: 'hsl(var(--status-warning-fg))', fontWeight: 500 }}>
            ⚠ Lab order can only be placed when encounter is in <strong>registered</strong> status. Current: <strong>{encounter.status}</strong>
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
        <span style={{ fontSize: '14px', color: 'hsl(var(--muted-foreground))' }}>Place Lab Order</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', padding: '24px', maxWidth: '600px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>Select Tests</h3>

        {tests.length === 0 ? (
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>No tests in catalog. Add tests in the Admin catalog first.</p>
        ) : (
          <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
            {tests.map((t: any) => (
              <label key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
                border: `1px solid ${selectedTests.has(t.id) ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                borderRadius: '6px', cursor: 'pointer',
                background: selectedTests.has(t.id) ? 'hsl(var(--muted))' : 'hsl(var(--card))',
              }}>
                <input
                  type="checkbox"
                  checked={selectedTests.has(t.id)}
                  onChange={() => toggleTest(t.id)}
                  style={{ width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>{t.name}</div>
                  {(t.code || t.turnaroundHours) && (
                    <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                      {t.code && <span>{t.code}</span>}
                      {t.turnaroundHours && <span style={{ marginLeft: '8px' }}>TAT: {t.turnaroundHours}h</span>}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inputStyle, background: 'hsl(var(--card))', width: '200px' }}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>

        {selectedTests.size > 0 && (
          <div style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: '6px', padding: '10px 16px', marginBottom: '16px' }}>
            <span style={{ color: 'hsl(var(--primary))', fontSize: '14px' }}>{selectedTests.size} test(s) selected</span>
          </div>
        )}

        {apiError && <p style={{ color: 'hsl(var(--destructive))', fontSize: '13px', marginBottom: '12px' }}>{apiError}</p>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedTests.size === 0}
            style={{
              flex: 1, padding: '12px',
              background: submitting || selectedTests.size === 0 ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
              cursor: submitting || selectedTests.size === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
          <button
            onClick={() => router.back()}
            style={{ padding: '12px 24px', background: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
