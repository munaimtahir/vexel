'use client';
import { DocumentStatusBadge } from './status-badge';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useState } from 'react';

interface DocumentItem {
  id: string;
  docType?: string;
  status: string;
  version?: number;
  createdAt?: string;
}

interface Props {
  documents: DocumentItem[];
  onRefresh?: () => void;
}

export default function DocumentList({ documents, onRefresh }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(doc: DocumentItem) {
    setDownloading(doc.id);
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const res = await api.GET('/documents/{id}/download', {
        params: { path: { id: doc.id } },
        parseAs: 'blob',
      });
      if (res.error || !res.data) { alert('Download failed'); return; }
      const blob = res.data as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.docType ?? 'document'}-${doc.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  if (!documents.length) return <p style={{ color: '#94a3b8', fontSize: '14px' }}>No documents yet.</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
          {['Type', 'Version', 'Status', 'Date', ''].map((h, i) => (
            <th key={i} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {documents.map(doc => (
          <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={{ padding: '10px 12px', fontWeight: 500 }}>{doc.docType ?? '—'}</td>
            <td style={{ padding: '10px 12px', color: '#64748b' }}>v{doc.version ?? 1}</td>
            <td style={{ padding: '10px 12px' }}><DocumentStatusBadge status={doc.status} /></td>
            <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '—'}</td>
            <td style={{ padding: '10px 12px' }}>
              {doc.status === 'PUBLISHED' && (
                <button
                  disabled={downloading === doc.id}
                  onClick={() => handleDownload(doc)}
                  style={{ padding: '4px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  {downloading === doc.id ? '...' : 'Download'}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
