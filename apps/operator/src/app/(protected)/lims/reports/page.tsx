'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, DocumentStatusBadge, DataTable, EmptyState } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DOC_TYPE_LABELS: Record<string, string> = {
  LAB_REPORT: 'Lab Report',
  RECEIPT: 'Receipt',
};

export default function ReportsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: err } = await api.GET('/documents' as any, {
        params: { query: { limit: 50, offset: 0 } },
      });
      if (err) throw new Error('Failed to load documents');
      setDocs(Array.isArray(data) ? data : ((data as any)?.items ?? (data as any)?.data ?? []));
    } catch (e: any) {
      setError(e.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleDownload = async (docId: string) => {
    setDownloading(docId);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: err } = await api.GET('/documents/{id}/download' as any, {
        params: { path: { id: docId } },
      });
      if (err || !data) throw new Error('Download failed');
      const url = (data as any).url;
      if (url) window.open(url, '_blank');
    } catch (e: any) {
      alert(e.message ?? 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Published Reports"
        description="All published documents for your lab"
        actions={<Button variant="outline" onClick={fetchDocs}>Refresh</Button>}
      />

      {loading && <p className="text-muted-foreground">Loading documents…</p>}
      {error && <p className="text-destructive">{error}</p>}

      {!loading && docs.length === 0 && (
        <EmptyState title="No published documents yet" />
      )}

      {!loading && docs.length > 0 && (
        <DataTable
          data={docs}
          keyExtractor={(doc: any) => doc.id}
          columns={[
            {
              key: 'type',
              header: 'Type',
              cell: (doc: any) => (
                <Badge variant="secondary">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</Badge>
              ),
            },
            {
              key: 'patient',
              header: 'Patient',
              cell: (doc: any) => (
                <div>
                  <div className="text-foreground">{doc.encounter?.patient?.name ?? '—'}</div>
                  {doc.encounter?.patient?.mrn && (
                    <div className="text-xs text-muted-foreground">{doc.encounter.patient.mrn}</div>
                  )}
                </div>
              ),
            },
            {
              key: 'orderId',
              header: 'Order ID',
              cell: (doc: any) => (
                doc.encounter?.encounterCode ? (
                  <Link href={`/lims/encounters/${doc.encounterId}`} className="text-primary font-mono text-sm">
                    {doc.encounter.encounterCode}
                  </Link>
                ) : <span className="text-muted-foreground">—</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (doc: any) => <DocumentStatusBadge status={doc.status} />,
            },
            {
              key: 'publishedAt',
              header: 'Published At',
              cell: (doc: any) => (
                <span className="text-muted-foreground text-sm">
                  {doc.publishedAt ? new Date(doc.publishedAt).toLocaleString() : '—'}
                </span>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              cell: (doc: any) => (
                doc.status === 'PUBLISHED' ? (
                  <Button size="sm" onClick={() => handleDownload(doc.id)} disabled={downloading === doc.id}>
                    {downloading === doc.id ? 'Opening…' : '⬇ Download'}
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-sm">Not available</span>
                )
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
