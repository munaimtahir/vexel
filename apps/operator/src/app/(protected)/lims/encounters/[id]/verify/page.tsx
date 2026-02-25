'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import EncounterSummaryCard from '@/components/encounter-summary-card';
import DocumentList from '@/components/document-list';
import { useDocumentPolling } from '@/hooks/use-document-polling';
import { Button } from '@/components/ui/button';
import { FlagBadge } from '@/components/status-badge';

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

  if (loading) return <p className="text-muted-foreground">Loading encounter...</p>;
  if (error && !encounter) return <p className="text-destructive">{error}</p>;
  if (!encounter) return null;

  const orders: any[] = encounter.labOrders ?? [];
  const publishedDoc = documents.find((d: any) => d.status === 'PUBLISHED');

  if (encounter.status !== 'resulted' && !verified) {
    return (
      <div>
        <div className="mb-4">
          <Link href={`/lims/encounters/${id}`} className="text-primary hover:underline text-sm">← Back to Encounter</Link>
        </div>
        <EncounterSummaryCard encounter={encounter} />
        <div className="bg-[hsl(var(--status-warning-bg))] border border-[hsl(var(--status-warning-fg)/30)] rounded-lg px-5 py-4">
          <p className="m-0 text-[hsl(var(--status-warning-fg))] font-medium">
            ⚠ Encounter must be in <strong>resulted</strong> status to verify. Current status: <strong>{encounter.status}</strong>
          </p>
          <p className="mt-2 mb-0">
            {encounter.status === 'specimen_collected' && (
              <Link href={`/lims/encounters/${id}/results`} className="text-[hsl(var(--status-warning-fg))] font-semibold">→ Enter results first</Link>
            )}
            {encounter.status !== 'specimen_collected' && (
              <Link href={`/lims/encounters/${id}`} className="text-[hsl(var(--status-warning-fg))] font-semibold">← Return to encounter</Link>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/lims/encounters/${id}`} className="text-primary hover:underline text-sm">← Encounter</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Verify Results</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      {error && <p className="text-destructive mb-4">{error}</p>}

      {/* Read-only results table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border bg-muted/40">
          <h3 className="m-0 text-base font-semibold text-foreground">Results for Verification (Read-only)</h3>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/40">
              {['Test', 'Value', 'Unit', 'Ref Range', 'Flag'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No lab orders found.</td></tr>
            ) : orders.map((order: any) => (
              <tr key={order.id} className="border-b border-muted/50">
                <td className="px-4 py-3 text-sm text-foreground font-medium">{order.test?.name ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-foreground">{order.result?.value ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{order.result?.unit ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{order.result?.referenceRange ?? '—'}</td>
                <td className="px-4 py-3">
                  {order.result?.flag ? <FlagBadge flag={order.result.flag} /> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Documents section */}
      {(encounter.status === 'verified' || verified) && (
        <div className="bg-card rounded-lg border border-border p-5 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="m-0 text-base font-semibold text-foreground">Lab Report</h3>
            {polling && <span className="text-[hsl(var(--status-warning-fg))] text-sm">⏳ Generating report...</span>}
          </div>
          {publishedDoc && (
            <div className="bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-fg)/30)] rounded-md px-4 py-3 mb-3">
              <span className="text-[hsl(var(--status-success-fg))] font-semibold">✓ Report ready — </span>
              <Link href={`/lims/encounters/${id}/reports`} className="text-[hsl(var(--status-success-fg))] font-semibold hover:underline">Download ↗</Link>
            </div>
          )}
          <DocumentList documents={documents} onRefresh={refetchDocs} />
        </div>
      )}

      {encounter.status === 'resulted' && !verified && (
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90">
          Verify &amp; Publish
        </Button>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-8 max-w-[440px] w-full mx-4 border border-border">
            <h3 className="mb-3 text-lg font-bold text-foreground">Verify & Publish Results</h3>
            <p className="text-muted-foreground mb-6">
              Verify all results for <strong>{encounter.patient?.firstName} {encounter.patient?.lastName}</strong>? This will publish the lab report. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verifying}
                className="bg-primary hover:bg-primary/90"
              >
                {verifying ? 'Verifying...' : 'Confirm Verify'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
