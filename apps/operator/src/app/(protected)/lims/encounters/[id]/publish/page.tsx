'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import IdentityHeader from '@/components/identity-header';
import { Button } from '@/components/ui/button';
import { DocumentStatusBadge } from '@/components/status-badge';

export default function PublishPage() {
  const params = useParams();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [loadingEncounter, setLoadingEncounter] = useState(true);
  const [encounterError, setEncounterError] = useState('');

  const [document, setDocument] = useState<any>(null);
  const [downloadError, setDownloadError] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } })
      .then(({ data, error: apiError }) => {
        if (apiError || !data) { setEncounterError('Failed to load encounter'); return; }
        setEncounter(data);
      })
      .catch(() => setEncounterError('Failed to load encounter'))
      .finally(() => setLoadingEncounter(false));

    fetchDocument().then((doc) => {
      if (doc && doc.status !== 'PUBLISHED' && doc.status !== 'FAILED') {
        startPolling();
      }
      if (!doc) startPolling();
    });

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  const handleDownload = async () => {
    if (!document) return;
    setDownloadError('');
    try {
      const client = getApiClient(getToken() ?? undefined);
      // @ts-ignore – /documents/{id}/download not yet in SDK types
      const { data: blob, error: dlError } = await client.GET('/documents/{id}/download', {
        params: { path: { id: document.id } },
        parseAs: 'blob',
      });
      if (dlError || !blob) { setDownloadError('Download failed'); return; }
      const url = URL.createObjectURL(blob as Blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `report-${document.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Download failed');
    }
  };

  if (loadingEncounter) return <p className="text-muted-foreground">Loading encounter...</p>;
  if (encounterError) return <p className="text-destructive">{encounterError}</p>;
  if (!encounter) return null;

  const docStatus: string | undefined = document?.status;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/lims/encounters/${id}`} className="text-primary hover:underline text-sm">← Encounter</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Report Status</span>
      </div>

      <IdentityHeader
        patient={encounter.patient}
        encounterId={encounter.id}
        status={encounter.status}
        createdAt={encounter.createdAt}
      />

      <div className="bg-card rounded-lg border border-border p-8">
        <h3 className="mb-2 text-lg font-bold text-foreground">Lab Report</h3>
        <p className="mb-6 text-muted-foreground text-sm">
          Report is automatically generated and published when the encounter is verified.
        </p>

        {/* Document status */}
        {!document && (
          <p className="text-muted-foreground text-sm">⏳ Waiting for report to be generated...</p>
        )}

        {document && docStatus && (
          <div className="mb-6 px-4 py-3 rounded-md border border-border flex items-center gap-3">
            <span className="font-bold text-foreground">Status: </span>
            <DocumentStatusBadge status={docStatus} />
            {(docStatus === 'RENDERING' || docStatus === 'RENDERED') && <span className="text-muted-foreground text-sm">⏳ Generating PDF...</span>}
            <span className="ml-auto text-xs text-muted-foreground font-mono">{document.id?.slice(0, 8)}…</span>
          </div>
        )}

        {downloadError && (
          <p className="text-destructive mb-4 bg-[hsl(var(--status-destructive-bg))] px-4 py-2.5 rounded-md text-sm">
            {downloadError}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {docStatus === 'PUBLISHED' && (
            <>
              <Button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700">
                ⬇ Download PDF
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                🖨 Print
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
