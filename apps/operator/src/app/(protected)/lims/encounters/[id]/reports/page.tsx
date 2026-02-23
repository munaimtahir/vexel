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

  if (loading) return <p style={{ color: '#64748b' }}>Loading...</p>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  if (!encounter) return null;

  const labReports = documents.filter((d: any) => d.docType === 'LAB_REPORT' || d.docType === 'lab_report');
  const receipts = documents.filter((d: any) => d.docType === 'RECEIPT' || d.docType === 'receipt');
  const other = documents.filter((d: any) => !['LAB_REPORT', 'lab_report', 'RECEIPT', 'receipt'].includes(d.docType));

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href="/lims/worklist" style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Worklist</Link>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <Link href={`/lims/encounters/${id}`} style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>Encounter</Link>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ fontSize: '14px', color: '#64748b' }}>Reports</span>
      </div>

      <EncounterSummaryCard encounter={encounter} />

      {documents.length === 0 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', margin: 0 }}>No documents available yet.</p>
          {encounter.status === 'resulted' && (
            <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '14px' }}>
              <Link href={`/lims/encounters/${id}/verify`} style={{ color: '#2563eb' }}>Verify the encounter</Link> to generate reports.
            </p>
          )}
        </div>
      )}

      {labReports.length > 0 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Lab Reports</h3>
          <DocumentList documents={labReports} onRefresh={fetchData} />
        </div>
      )}

      {receipts.length > 0 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Receipts</h3>
          <DocumentList documents={receipts} onRefresh={fetchData} />
        </div>
      )}

      {other.length > 0 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Other Documents</h3>
          <DocumentList documents={other} onRefresh={fetchData} />
        </div>
      )}

      <div style={{ marginTop: '8px' }}>
        <Link href="/lims/worklist" style={{ color: '#64748b', fontSize: '14px', textDecoration: 'none' }}>← Back to Worklist</Link>
      </div>
    </div>
  );
}
