'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import EncounterSummaryCard from '@/components/encounter-summary-card';
import { Button } from '@/components/ui/button';

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

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!encounter) return null;

  if (success) {
    return (
      <div>
        <EncounterSummaryCard encounter={encounter} />
        <div className="bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-fg)/30)] rounded-lg p-6 mb-4">
          <p className="mb-2 text-[hsl(var(--status-success-fg))] font-semibold text-base">
            ✓ Specimen received in lab
          </p>
          <p className="text-[hsl(var(--status-success-fg))] text-sm">
            Specimen has been logged as received. You may now enter results.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/lims/encounters/${id}/results`}>Enter Results →</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/lims/encounters/${id}`}>Back to Encounter</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (encounter.status !== 'specimen_collected') {
    return (
      <div>
        <div className="mb-4">
          <Link href={`/lims/encounters/${id}`} className="text-primary hover:underline text-sm">← Back to Encounter</Link>
        </div>
        <EncounterSummaryCard encounter={encounter} />
        <div className="bg-[hsl(var(--status-warning-bg))] border border-[hsl(var(--status-warning-fg)/30)] rounded-lg px-5 py-4">
          <p className="m-0 text-[hsl(var(--status-warning-fg))] font-medium">
            ⚠ Specimen can only be received when encounter is in <strong>specimen_collected</strong> status. Current: <strong>{encounter.status}</strong>
          </p>
          <p className="mt-2 mb-0">
            <Link href={`/lims/encounters/${id}`} className="text-[hsl(var(--status-warning-fg))] font-semibold">← Return to encounter</Link>
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
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/lims/encounters/${id}`} className="text-primary hover:underline text-sm">← Encounter</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Receive Specimen</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      {specimen && (
        <div className="bg-muted/40 border border-border rounded-lg px-5 py-4 mb-5">
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Collected Specimen</h4>
          <div className="flex gap-6 text-sm">
            {specimen.barcode && <div><span className="text-muted-foreground">Barcode: </span><strong className="font-mono">{specimen.barcode}</strong></div>}
            {specimen.specimenType && <div><span className="text-muted-foreground">Type: </span><strong>{specimen.specimenType}</strong></div>}
            {specimen.collectedAt && <div><span className="text-muted-foreground">Collected: </span><strong>{new Date(specimen.collectedAt).toLocaleString()}</strong></div>}
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-6 max-w-[480px]">
        <h3 className="mb-2 text-base font-semibold text-foreground">Confirm Specimen Receipt</h3>
        <p className="mb-5 text-sm text-muted-foreground">
          Mark this specimen as physically received in the laboratory. This will timestamp receipt and advance the workflow.
        </p>

        <div className="mb-5">
          <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-md text-sm bg-card text-foreground resize-y"
            placeholder="Any receipt notes (condition of specimen, etc.)..."
          />
        </div>

        {apiError && <p className="text-destructive text-[13px] mb-3">{apiError}</p>}

        <div className="flex gap-3">
          <Button
            className="flex-1"
            onClick={handleReceive}
            disabled={submitting}
          >
            {submitting ? 'Confirming...' : '✓ Confirm Receipt'}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Note: You can also skip this step and go directly to result entry.
        </p>
      </div>
    </div>
  );
}
