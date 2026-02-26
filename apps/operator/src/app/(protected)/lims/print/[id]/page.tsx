'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Format = 'a4' | 'thermal';

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [pdfUrl, setPdfUrl]       = useState<string | null>(null);
  const [docType, setDocType]     = useState<string>('');
  const [format, setFormat]       = useState<Format>('a4');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [downloading, setDownloading] = useState(false);
  const [docName, setDocName]     = useState('document');

  const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

  async function loadPdf(docId: string, fmt?: Format) {
    setLoading(true);
    setError('');
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
    try {
      const token = getToken() ?? '';
      const url = `${NEXT_PUBLIC_API_URL}/api/documents/${docId}/render${fmt ? `?format=${fmt}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      setPdfUrl(objUrl);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  }

  // Load doc metadata on mount
  useEffect(() => {
    if (!id) return;
    const api = getApiClient(getToken() ?? undefined);
    (api.GET as any)(`/documents/${id}`, {}).then(({ data }: any) => {
      const type = data?.type ?? data?.docType ?? '';
      setDocType(type);
      const mrn = data?.sourceRef ?? '';
      setDocName(type === 'RECEIPT' ? `receipt-${mrn}` : `lab-report-${mrn}`);
    }).catch(() => {});
    loadPdf(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reload PDF when format changes (only for RECEIPT)
  useEffect(() => {
    if (!id || !docType) return;
    if (docType === 'RECEIPT') loadPdf(id, format);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, docType]);

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  async function handleDownload() {
    if (!pdfUrl) return;
    setDownloading(true);
    try {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${docName}.pdf`;
      a.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
        background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border))',
        flexShrink: 0,
      }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'hsl(var(--muted-foreground))' }}>
          ← Back
        </button>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'hsl(var(--foreground))', flex: 1 }}>
          {docType === 'RECEIPT' ? '🧾 Receipt' : '📋 Lab Report'}
        </span>

        {/* Format toggle — RECEIPT only */}
        {docType === 'RECEIPT' && (
          <div style={{
            display: 'flex', border: '1px solid hsl(var(--border))', borderRadius: '6px',
            overflow: 'hidden', fontSize: '13px',
          }}>
            {(['a4', 'thermal'] as Format[]).map(f => (
              <button key={f} onClick={() => setFormat(f)}
                style={{
                  padding: '5px 14px', cursor: 'pointer', border: 'none',
                  fontWeight: format === f ? 600 : 400,
                  background: format === f ? 'hsl(var(--primary))' : 'transparent',
                  color: format === f ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                }}>
                {f === 'a4' ? 'A4' : '🌡 Thermal'}
              </button>
            ))}
          </div>
        )}

        <button onClick={handleDownload} disabled={!pdfUrl || downloading}
          style={{
            padding: '7px 16px', borderRadius: '6px', cursor: 'pointer',
            background: 'transparent', border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))', fontSize: '13px', fontWeight: 500,
          }}>
          ⬇ Download
        </button>
        <button onClick={handlePrint} disabled={!pdfUrl}
          style={{
            padding: '7px 18px', borderRadius: '6px', cursor: 'pointer', border: 'none',
            background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
            fontSize: '13px', fontWeight: 600,
          }}>
          🖨 Print
        </button>
      </div>

      {/* ── PDF area ── */}
      <div style={{ flex: 1, background: 'hsl(var(--muted))', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'hsl(var(--foreground))', fontSize: '14px',
          }}>
            Loading PDF…
          </div>
        )}
        {error && !loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'hsl(var(--destructive))', fontSize: '14px',
          }}>
            ⚠ {error}
          </div>
        )}
        {pdfUrl && !loading && (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="PDF Preview"
          />
        )}
      </div>
    </div>
  );
}
