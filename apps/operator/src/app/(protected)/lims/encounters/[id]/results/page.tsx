'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import EncounterSummaryCard from '@/components/encounter-summary-card';

interface OrderForm {
  value: string;
  unit: string;
  flag: string;
  notes: string;
  status: 'idle' | 'submitting' | 'success' | 'error';
  errorMsg: string;
}

export default function ResultEntryPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forms, setForms] = useState<Record<string, OrderForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [allSaved, setAllSaved] = useState(false);

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } })
      .then(({ data, error: apiError }) => {
        if (apiError || !data) { setError('Failed to load encounter'); return; }
        setEncounter(data);
        const initialForms: Record<string, OrderForm> = {};
        for (const order of (data as any).labOrders ?? []) {
          initialForms[order.id] = {
            value: order.result?.value ?? '',
            unit: order.result?.unit ?? order.test?.unit ?? '',
            flag: order.result?.flag ?? 'normal',
            notes: order.result?.notes ?? '',
            status: 'idle',
            errorMsg: '',
          };
        }
        setForms(initialForms);
      })
      .catch(() => setError('Failed to load encounter'))
      .finally(() => setLoading(false));
  }, [id]);

  const updateForm = (orderId: string, field: keyof OrderForm, value: string) => {
    setForms((prev) => ({ ...prev, [orderId]: { ...prev[orderId], [field]: value } }));
  };

  const handleSubmitAll = async () => {
    setSubmitting(true);
    const api = getApiClient(getToken() ?? undefined);
    const orders: any[] = encounter?.labOrders ?? [];
    let hasError = false;

    for (const order of orders) {
      const f = forms[order.id];
      if (!f) continue;
      setForms((prev) => ({ ...prev, [order.id]: { ...prev[order.id], status: 'submitting', errorMsg: '' } }));
      try {
        const { error: apiError } = await api.POST('/encounters/{encounterId}:result', {
          params: { path: { encounterId: id } },
          body: {
            labOrderId: order.id,
            value: f.value,
            unit: f.unit || undefined,
            flag: f.flag,
            referenceRange: undefined,
          } as any,
        });
        setForms((prev) => ({
          ...prev,
          [order.id]: { ...prev[order.id], status: apiError ? 'error' : 'success', errorMsg: apiError ? 'Submit failed' : '' },
        }));
        if (apiError) hasError = true;
      } catch {
        setForms((prev) => ({ ...prev, [order.id]: { ...prev[order.id], status: 'error', errorMsg: 'Submit failed' } }));
        hasError = true;
      }
    }

    setSubmitting(false);
    if (!hasError) setAllSaved(true);
  };

  if (loading) return <p style={{ color: '#64748b' }}>Loading encounter...</p>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  if (!encounter) return null;

  const orders: any[] = encounter.labOrders ?? [];

  if (encounter.status !== 'specimen_collected' && encounter.status !== 'specimen_received') {
    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <Link href={`/lims/encounters/${id}`} style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Back to Encounter</Link>
        </div>
        <EncounterSummaryCard encounter={encounter} />
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px 20px' }}>
          <p style={{ margin: 0, color: '#92400e', fontWeight: 500 }}>
            ⚠ Encounter must be in <strong>specimen_collected</strong> or <strong>specimen_received</strong> status to enter results. Current: <strong>{encounter.status}</strong>
          </p>
          <p style={{ margin: '8px 0 0' }}>
            {encounter.status === 'lab_ordered' && (
              <Link href={`/lims/encounters/${id}/sample`} style={{ color: '#92400e', fontWeight: 600 }}>→ Collect Sample first</Link>
            )}
            {encounter.status !== 'lab_ordered' && (
              <Link href={`/lims/encounters/${id}`} style={{ color: '#92400e', fontWeight: 600 }}>← Return to encounter</Link>
            )}
          </p>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href={`/lims/encounters/${id}`} style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Encounter</Link>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ fontSize: '14px', color: '#64748b' }}>Enter Results</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      {allSaved && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' }}>
          <p style={{ margin: '0 0 8px', color: '#15803d', fontWeight: 600 }}>✓ Results saved</p>
          <Link href={`/lims/encounters/${id}/verify`} style={{ color: '#15803d', fontWeight: 600, fontSize: '14px' }}>
            → Proceed to Verify
          </Link>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Lab Order Results</h3>

        {orders.length === 0 && (
          <p style={{ color: '#64748b' }}>No lab orders to enter results for.</p>
        )}

        {orders.map((order: any) => {
          const f = forms[order.id] ?? { value: '', unit: '', flag: 'normal', notes: '', status: 'idle', errorMsg: '' };
          return (
            <div key={order.id} style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '15px' }}>{order.test?.name ?? 'Unknown Test'}</span>
                  <span style={{ marginLeft: '12px', fontSize: '12px', color: '#64748b' }}>Priority: {order.priority ?? '—'}</span>
                </div>
                {f.status === 'success' && <span style={{ color: '#059669', fontSize: '13px', fontWeight: 600 }}>✓ Submitted</span>}
                {f.status === 'error' && <span style={{ color: '#ef4444', fontSize: '13px' }}>{f.errorMsg}</span>}
                {f.status === 'submitting' && <span style={{ color: '#94a3b8', fontSize: '13px' }}>Submitting...</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Value *</label>
                  <input
                    value={f.value}
                    onChange={(e) => updateForm(order.id, 'value', e.target.value)}
                    style={inputStyle}
                    placeholder="Enter result value"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Unit</label>
                  <input
                    value={f.unit}
                    onChange={(e) => updateForm(order.id, 'unit', e.target.value)}
                    style={inputStyle}
                    placeholder={order.test?.unit ?? 'e.g. mg/dL'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Flag</label>
                  <select
                    value={f.flag}
                    onChange={(e) => updateForm(order.id, 'flag', e.target.value)}
                    style={{ ...inputStyle, background: 'white' }}
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Notes</label>
                  <input
                    value={f.notes}
                    onChange={(e) => updateForm(order.id, 'notes', e.target.value)}
                    style={inputStyle}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {orders.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={handleSubmitAll}
              disabled={submitting}
              style={{ flex: 1, padding: '12px', background: submitting ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Submitting Results...' : 'Save All Results'}
            </button>
            <button
              onClick={() => router.push(`/lims/encounters/${id}`)}
              style={{ padding: '12px 24px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
