'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

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
      setDocs((data as any)?.items ?? []);
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
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Published Reports</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>All published documents for your lab</p>
        </div>
        <button
          onClick={fetchDocs}
          style={{ padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          Refresh
        </button>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading documents…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && docs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
          <p style={{ fontSize: '32px', margin: '0 0 8px' }}>📄</p>
          <p>No published documents yet.</p>
        </div>
      )}

      {!loading && docs.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {['Type', 'Patient', 'Order ID', 'Status', 'Published At', 'Action'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc: any, idx: number) => (
              <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '2px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                    {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#0f172a' }}>
                  {doc.encounter?.patient?.name ?? '—'}
                  {doc.encounter?.patient?.mrn && (
                    <span style={{ display: 'block', fontSize: '12px', color: '#64748b' }}>{doc.encounter.patient.mrn}</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', color: '#1d4ed8', fontFamily: 'monospace' }}>
                  {doc.encounter?.encounterCode ? (
                    <Link href={`/encounters/${doc.encounterId}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>
                      {doc.encounter.encounterCode}
                    </Link>
                  ) : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: doc.status === 'PUBLISHED' ? '#dcfce7' : doc.status === 'FAILED' ? '#fee2e2' : '#fef9c3',
                    color: doc.status === 'PUBLISHED' ? '#166534' : doc.status === 'FAILED' ? '#991b1b' : '#854d0e',
                  }}>
                    {doc.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px' }}>
                  {doc.publishedAt ? new Date(doc.publishedAt).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {doc.status === 'PUBLISHED' ? (
                    <button
                      onClick={() => handleDownload(doc.id)}
                      disabled={downloading === doc.id}
                      style={{ padding: '4px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      {downloading === doc.id ? 'Opening…' : '⬇ Download'}
                    </button>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not available</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
