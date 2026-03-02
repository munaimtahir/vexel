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

  // Track whether the user has explicitly changed the format toggle so we only
  // re-render via PDF service when needed (not on the initial docType population).
  const prevFormatRef = useRef<Format>('a4');
  const initialLoadDoneRef = useRef(false);

  /** Serve already-rendered bytes from MinIO — fast path (~200ms). */
  async function loadFromStorage(docId: string) {
    setLoading(true);
    setError('');
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.GET('/documents/{id}/download', {
        params: { path: { id: docId } },
        parseAs: 'blob',
      });
      if (apiError || !data) throw new Error('Failed to download PDF');
      setPdfUrl(URL.createObjectURL(data));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  }

  /** Re-render via PDF service — used only for format overrides (thermal layout). */
  async function loadWithFormatOverride(docId: string, fmt: Format) {
    setLoading(true);
    setError('');
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.GET('/documents/{id}/render', {
        params: {
          path: { id: docId },
          query: fmt !== 'a4' ? { format: fmt } : {},
        },
        parseAs: 'blob',
      });
      if (apiError || !data) throw new Error('Failed to render PDF');
      setPdfUrl(URL.createObjectURL(data));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  }

  // Load doc metadata + initial PDF bytes from storage on mount.
  useEffect(() => {
    if (!id) return;
    const api = getApiClient(getToken() ?? undefined);
    (api.GET as any)(`/documents/${id}`, {}).then(({ data }: any) => {
      const type = data?.type ?? data?.docType ?? '';
      setDocType(type);
      const mrn = data?.sourceRef ?? '';
      setDocName(type === 'RECEIPT' ? `receipt-${mrn}` : `lab-report-${mrn}`);
    }).catch(() => {});
    // Always serve from MinIO on initial load (fast path).
    loadFromStorage(id);
    initialLoadDoneRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Only re-render via PDF service when the user explicitly changes the format toggle.
  useEffect(() => {
    if (!id || !docType || !initialLoadDoneRef.current) return;
    if (docType !== 'RECEIPT') return;
    // Guard: only fire when format actually changed from previous value.
    if (format === prevFormatRef.current) return;
    prevFormatRef.current = format;
    loadWithFormatOverride(id, format);
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

        {/* Format toggle — RECEIPT only; switches to thermal re-render via PDF service */}
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
