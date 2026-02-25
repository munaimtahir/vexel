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

  if (loading) return <p style={{ color: 'hsl(var(--muted-foreground))' }}>Loading...</p>;
  if (error) return <p style={{ color: 'hsl(var(--status-destructive-fg))' }}>{error}</p>;
  if (!encounter) return null;

  const labReports = documents.filter((d: any) => d.docType === 'LAB_REPORT' || d.docType === 'lab_report');
  const receipts = documents.filter((d: any) => d.docType === 'RECEIPT' || d.docType === 'receipt');
  const other = documents.filter((d: any) => !['LAB_REPORT', 'lab_report', 'RECEIPT', 'receipt'].includes(d.docType));

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href="/worklist" style={{ color: 'hsl(var(--primary))', fontSize: '14px', textDecoration: 'none' }}>← Worklist</Link>
        <span style={{ color: 'hsl(var(--border))' }}>/</span>
        <Link href={`/encounters/${id}`} style={{ color: 'hsl(var(--primary))', fontSize: '14px', textDecoration: 'none' }}>Encounter</Link>
        <span style={{ color: 'hsl(var(--border))' }}>/</span>
        <span style={{ fontSize: '14px', color: 'hsl(var(--muted-foreground))' }}>Reports</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      {documents.length === 0 && (
        <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'hsl(var(--muted-foreground))', margin: 0 }}>No documents available yet.</p>
          {encounter.status === 'resulted' && (
            <p style={{ margin: '8px 0 0', color: 'hsl(var(--muted-foreground))', fontSize: '14px' }}>
              <Link href={`/encounters/${id}/verify`} style={{ color: 'hsl(var(--primary))' }}>Verify the encounter</Link> to generate reports.
            </p>
          )}
        </div>
      )}

      {labReports.length > 0 && (
        <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>Lab Reports</h3>
          <DocumentList documents={labReports} onRefresh={fetchData} />
        </div>
      )}

      {receipts.length > 0 && (
        <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>Receipts</h3>
          <DocumentList documents={receipts} onRefresh={fetchData} />
        </div>
      )}

      {other.length > 0 && (
        <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>Other Documents</h3>
          <DocumentList documents={other} onRefresh={fetchData} />
        </div>
      )}

      <div style={{ marginTop: '8px' }}>
        <Link href="/worklist" style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px', textDecoration: 'none' }}>← Back to Worklist</Link>
      </div>
    </div>
  );
}
