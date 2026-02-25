'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import IdentityHeader from '@/components/identity-header';
import { useFeatureFlags, isReceiveSeparate } from '@/hooks/use-feature-flags';
import { SectionCard, DocumentStatusBadge, DataTable } from '@/components/app';
import { Button } from '@/components/ui/button';

export default function EncounterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { flags } = useFeatureFlags();
  const receiveSeparate = isReceiveSeparate(flags);
  const [receiptDoc, setReceiptDoc] = useState<any>(null);
  const [reportDoc, setReportDoc] = useState<any>(null);
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

  const fetchDocuments = async () => {
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/documents', { params: { query: { sourceRef: id, sourceType: 'ENCOUNTER', limit: 20 } } });
      if (data && Array.isArray(data)) {
        const receipt = data.find((d: any) => d.type === 'RECEIPT' || d.docType === 'RECEIPT') ?? null;
        const report = data.find((d: any) => d.type === 'LAB_REPORT' || d.docType === 'LAB_REPORT') ?? null;
        setReceiptDoc(receipt);
        setReportDoc(report);
        return report;
      }
    } catch {}
    return null;
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const doc = await fetchDocuments();
      if (doc && (doc.status === 'PUBLISHED' || doc.status === 'FAILED')) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
      }
    }, 3000);
  };

  useEffect(() => {
    Promise.all([fetchEncounter(), fetchDocuments()]).finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  // Start polling when encounter is verified and doc not yet published
  useEffect(() => {
    if (encounter?.status === 'verified' && reportDoc && reportDoc.status !== 'PUBLISHED' && reportDoc.status !== 'FAILED') {
      startPolling();
    }
    if (encounter?.status === 'verified' && !reportDoc) {
      // Poll for document to appear
      startPolling();
    }
  }, [encounter?.status, reportDoc?.status]);

  const handleDownload = async (doc: any) => {
    if (!doc) return;
    setDownloadError('');
    try {
      const client = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data: dl, error: dlError } = await client.GET('/documents/{id}/download', {
        params: { path: { id: doc.id } },
      });
      if (dlError || !dl) { setDownloadError('Download failed'); return; }
      const url = (dl as any)?.url;
      if (url) window.open(url, '_blank');
      else setDownloadError('Download URL not available');
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

  if (loading) return <p className="text-muted-foreground">Loading encounter...</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!encounter) return null;

  const { status, labOrders = [], patient } = encounter;
  const docStatus: string | undefined = reportDoc?.status;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm mb-4">
        <Link href="/lims/encounters" className="text-primary">← Encounters</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">Detail</span>
      </div>

      <IdentityHeader
        patient={patient}
        encounterId={encounter.id}
        status={status}
        createdAt={encounter.createdAt}
      />

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {status === 'registered' && (
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href={`/lims/encounters/${id}/order`}>Place Lab Order</Link>
          </Button>
        )}
        {status === 'lab_ordered' && (
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href={`/lims/encounters/${id}/sample`}>Collect Sample</Link>
          </Button>
        )}
        {status === 'specimen_collected' && receiveSeparate && (
          <>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href={`/lims/encounters/${id}/receive`}>Receive Specimen</Link>
            </Button>
            <Button asChild>
              <Link href={`/lims/encounters/${id}/results`}>Enter Results</Link>
            </Button>
          </>
        )}
        {status === 'specimen_collected' && !receiveSeparate && (
          <Button asChild>
            <Link href={`/lims/encounters/${id}/results`}>Enter Results</Link>
          </Button>
        )}
        {status === 'specimen_received' && (
          <Button asChild>
            <Link href={`/lims/encounters/${id}/results`}>Enter Results</Link>
          </Button>
        )}
        {status === 'resulted' && (
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href={`/lims/encounters/${id}/verify`}>Verify Results</Link>
          </Button>
        )}
        {status === 'verified' && (
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href={`/lims/encounters/${id}/reports`}>View / Download Report</Link>
          </Button>
        )}
        {status !== 'cancelled' && status !== 'verified' && (
          <Button
            variant="outline"
            className="text-destructive border-destructive/50 hover:bg-destructive/5"
            onClick={() => setShowCancelModal(true)}
          >
            Cancel Encounter
          </Button>
        )}
      </div>

      {/* Document status + download */}
      {(status === 'verified' || reportDoc || receiptDoc) && (
        <SectionCard title="Documents" className="mb-6">
          {receiptDoc && (
            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
              <span className="text-sm font-semibold text-foreground">Receipt</span>
              <span className="px-3 py-1 rounded-full bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))] font-semibold text-sm">
                {receiptDoc.status}
              </span>
              <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => handleDownload(receiptDoc)}>
                ⬇ Print Receipt Again
              </Button>
            </div>
          )}
          {!reportDoc && (
            <p className="text-muted-foreground text-sm">⏳ Generating report...</p>
          )}
          {reportDoc && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-foreground">Lab Report</span>
              <DocumentStatusBadge status={docStatus!} />
              {(docStatus === 'RENDERING' || docStatus === 'RENDERED') && (
                <span className="text-[hsl(var(--status-warning-fg))] text-sm">⏳ Generating PDF...</span>
              )}
              {docStatus === 'PUBLISHED' && (
                <>
                  <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => handleDownload(reportDoc)}>
                    ⬇ Download Report
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { handleDownload(reportDoc).then(() => window.print()); }}>
                    🖨 Print
                  </Button>
                  <Link href={`/lims/encounters/${id}/publish`} className="text-primary text-sm">
                    View Report Details →
                  </Link>
                </>
              )}
              {docStatus === 'FAILED' && (
                <Button size="sm" asChild className="bg-primary hover:bg-primary/90">
                  <Link href={`/lims/encounters/${id}/publish`}>Retry Report</Link>
                </Button>
              )}
            </div>
          )}
          {downloadError && <p className="text-destructive text-sm mt-2">{downloadError}</p>}
        </SectionCard>
      )}

      {/* Lab Orders */}
      <SectionCard title="Lab Orders" noPadding>
        {labOrders.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-muted-foreground">No orders placed yet.</p>
          </div>
        ) : (
          <DataTable
            data={labOrders}
            keyExtractor={(order: any) => order.id}
            columns={[
              { key: 'testName', header: 'Test Name', cell: (o: any) => <span className="text-foreground">{o.test?.name ?? '—'}</span> },
              { key: 'priority', header: 'Priority', cell: (o: any) => <span className="text-muted-foreground text-sm">{o.priority ?? '—'}</span> },
              { key: 'status', header: 'Status', cell: (o: any) => <span className="text-muted-foreground text-sm">{o.status ?? '—'}</span> },
              { key: 'barcode', header: 'Specimen Barcode', cell: (o: any) => <span className="font-mono text-muted-foreground text-sm">{o.specimen?.barcode ?? '—'}</span> },
              { key: 'result', header: 'Result Value', cell: (o: any) => <span className="text-foreground">{o.result?.value ?? '—'}</span> },
              { key: 'flag', header: 'Flag', cell: (o: any) => <span className="text-muted-foreground text-sm">{o.result?.flag ?? '—'}</span> },
            ]}
          />
        )}
      </SectionCard>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-3">Cancel Encounter</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to cancel this encounter for <strong>{patient.firstName} {patient.lastName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowCancelModal(false)}>
                Keep Encounter
              </Button>
              <Button variant="destructive" disabled={cancelling} onClick={handleCancel}>
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

