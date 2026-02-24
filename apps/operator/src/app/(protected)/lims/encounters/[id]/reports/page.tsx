'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import EncounterSummaryCard from '@/components/encounter-summary-card';
import DocumentList from '@/components/document-list';

export default function ReportsPage() {
  const params = useParams();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    const api = getApiClient(getToken() ?? undefined);
    try {
      const [encRes, docsRes] = await Promise.all([
        api.GET('/encounters/{encounterId}', { params: { path: { encounterId: id } } }),
        // @ts-ignore
        api.GET('/documents', { params: { query: { encounterId: id } } }),
      ]);
      if (encRes.error || !encRes.data) { setError('Failed to load encounter'); return; }
      setEncounter(encRes.data);
      const docList = Array.isArray(docsRes.data) ? docsRes.data : (docsRes.data as any)?.data ?? [];
      setDocuments(docList);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!encounter) return null;

  const labReports = documents.filter((d: any) => d.docType === 'LAB_REPORT' || d.docType === 'lab_report');
  const receipts = documents.filter((d: any) => d.docType === 'RECEIPT' || d.docType === 'receipt');
  const other = documents.filter((d: any) => !['LAB_REPORT', 'lab_report', 'RECEIPT', 'receipt'].includes(d.docType));

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href="/lims/worklist" className="text-primary hover:underline text-sm">← Worklist</Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/lims/encounters/${id}`} className="text-primary hover:underline text-sm">Encounter</Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground">Reports</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      {documents.length === 0 && (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground m-0">No documents available yet.</p>
          {encounter.status === 'resulted' && (
            <p className="mt-2 text-muted-foreground text-sm">
              <Link href={`/lims/encounters/${id}/verify`} className="text-primary hover:underline">Verify the encounter</Link> to generate reports.
            </p>
          )}
        </div>
      )}

      {labReports.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5 mb-4">
          <h3 className="mb-4 text-base font-semibold text-foreground">Lab Reports</h3>
          <DocumentList documents={labReports} onRefresh={fetchData} />
        </div>
      )}

      {receipts.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5 mb-4">
          <h3 className="mb-4 text-base font-semibold text-foreground">Receipts</h3>
          <DocumentList documents={receipts} onRefresh={fetchData} />
        </div>
      )}

      {other.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5 mb-4">
          <h3 className="mb-4 text-base font-semibold text-foreground">Other Documents</h3>
          <DocumentList documents={other} onRefresh={fetchData} />
        </div>
      )}

      <div className="mt-2">
        <Link href="/lims/worklist" className="text-muted-foreground hover:underline text-sm">← Back to Worklist</Link>
      </div>
    </div>
  );
}
