'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import EncounterSummaryCard from '@/components/encounter-summary-card';
import { Button } from '@/components/ui/button';

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

  if (loading) return <p className="text-muted-foreground">Loading encounter...</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!encounter) return null;

  const orders: any[] = encounter.labOrders ?? [];

  if (encounter.status !== 'specimen_collected' && encounter.status !== 'specimen_received') {
    return (
      <div>
        <div className="mb-4">
          <Link href={`/lims/encounters/${id}`} className="text-primary hover:underline text-sm">← Back to Encounter</Link>
        </div>
        <EncounterSummaryCard encounter={encounter} />
        <div className="bg-[hsl(var(--status-warning-bg))] border border-[hsl(var(--status-warning-fg)/30)] rounded-lg px-5 py-4">
          <p className="m-0 text-[hsl(var(--status-warning-fg))] font-medium">
            ⚠ Encounter must be in <strong>specimen_collected</strong> or <strong>specimen_received</strong> status to enter results. Current: <strong>{encounter.status}</strong>
          </p>
          <p className="mt-2 mb-0">
            {encounter.status === 'lab_ordered' && (
              <Link href={`/lims/encounters/${id}/sample`} className="text-[hsl(var(--status-warning-fg))] font-semibold">→ Collect Sample first</Link>
            )}
            {encounter.status !== 'lab_ordered' && (
              <Link href={`/lims/encounters/${id}`} className="text-[hsl(var(--status-warning-fg))] font-semibold">← Return to encounter</Link>
            )}
          </p>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-md text-sm bg-card text-foreground';

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/lims/encounters/${id}`} className="text-primary hover:underline text-sm">← Encounter</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Enter Results</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      {allSaved && (
        <div className="bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-fg)/30)] rounded-lg px-5 py-4 mb-4">
          <p className="mb-2 text-[hsl(var(--status-success-fg))] font-semibold">✓ Results saved</p>
          <Link href={`/lims/encounters/${id}/verify`} className="text-[hsl(var(--status-success-fg))] font-semibold text-sm hover:underline">
            → Proceed to Verify
          </Link>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="mb-5 text-base font-semibold text-foreground">Lab Order Results</h3>

        {orders.length === 0 && (
          <p className="text-muted-foreground">No lab orders to enter results for.</p>
        )}

        {orders.map((order: any) => {
          const f = forms[order.id] ?? { value: '', unit: '', flag: 'normal', notes: '', status: 'idle', errorMsg: '' };
          return (
            <div key={order.id} className="mb-6 pb-6 border-b border-muted/50">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="font-semibold text-foreground text-[15px]">{order.test?.name ?? 'Unknown Test'}</span>
                  <span className="ml-3 text-xs text-muted-foreground">Priority: {order.priority ?? '—'}</span>
                </div>
                {f.status === 'success' && <span className="text-[hsl(var(--status-success-fg))] text-[13px] font-semibold">✓ Submitted</span>}
                {f.status === 'error' && <span className="text-destructive text-[13px]">{f.errorMsg}</span>}
                {f.status === 'submitting' && <span className="text-muted-foreground text-[13px]">Submitting...</span>}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Value *</label>
                  <input
                    value={f.value}
                    onChange={(e) => updateForm(order.id, 'value', e.target.value)}
                    className={inputCls}
                    placeholder="Enter result value"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Unit</label>
                  <input
                    value={f.unit}
                    onChange={(e) => updateForm(order.id, 'unit', e.target.value)}
                    className={inputCls}
                    placeholder={order.test?.unit ?? 'e.g. mg/dL'}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Flag</label>
                  <select
                    value={f.flag}
                    onChange={(e) => updateForm(order.id, 'flag', e.target.value)}
                    className={inputCls}
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                  <input
                    value={f.notes}
                    onChange={(e) => updateForm(order.id, 'notes', e.target.value)}
                    className={inputCls}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {orders.length > 0 && (
          <div className="flex gap-3 mt-2">
            <Button
              className="flex-1"
              onClick={handleSubmitAll}
              disabled={submitting}
            >
              {submitting ? 'Submitting Results...' : 'Save All Results'}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/lims/encounters/${id}`)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
