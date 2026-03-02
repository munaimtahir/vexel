'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Format = 'a4' | 'thermal';
type DocStatus = 'QUEUED' | 'RENDERING' | 'RENDERED' | 'PUBLISHED' | 'FAILED' | '';

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [pdfUrl, setPdfUrl]       = useState<string | null>(null);
  const [docType, setDocType]     = useState<string>('');
  const [docStatus, setDocStatus] = useState<DocStatus>('');
  const [format, setFormat]       = useState<Format>('a4');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [downloading, setDownloading] = useState(false);
  const [docName, setDocName]     = useState('document');

  // Track whether the user has explicitly changed the format toggle so we only
  // re-render via PDF service when needed (not on the initial docType population).
  const prevFormatRef = useRef<Format>('a4');
  const initialLoadDoneRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Fetch document metadata and return its status. */
  const fetchDocStatus = useCallback(async (docId: string): Promise<DocStatus> => {
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data } = await (api.GET as any)(`/documents/${docId}`, {});
      const status: DocStatus = data?.status ?? '';
      const type = data?.type ?? data?.docType ?? '';
      setDocType(type);
      setDocStatus(status);
      const mrn = data?.sourceRef ?? '';
      setDocName(type === 'RECEIPT' ? `receipt-${mrn}` : `lab-report-${mrn}`);
      return status;
    } catch {
      return '';
    }
  }, []);

  /** Serve already-rendered bytes from MinIO — fast path (~200ms). */
  const loadFromStorage = useCallback(async (docId: string) => {
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  // If doc is still rendering, poll every 3 s until ready.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function bootstrap() {
      const status = await fetchDocStatus(id!);
      if (cancelled) return;

      if (status === 'RENDERED' || status === 'PUBLISHED') {
        await loadFromStorage(id!);
        initialLoadDoneRef.current = true;
      } else if (status === 'QUEUED' || status === 'RENDERING') {
        setLoading(false); // show polling state, not spinner
        schedulePolling();
      } else if (status === 'FAILED') {
        setLoading(false);
        setError('PDF generation failed. Please re-generate from the encounter page.');
      } else {
        // Unknown status — try loading anyway
        await loadFromStorage(id!);
        initialLoadDoneRef.current = true;
      }
    }

    function schedulePolling() {
      pollTimerRef.current = setTimeout(async () => {
        if (cancelled) return;
        const status = await fetchDocStatus(id!);
        if (status === 'RENDERED' || status === 'PUBLISHED') {
          await loadFromStorage(id!);
          initialLoadDoneRef.current = true;
        } else if (status === 'FAILED') {
          setLoading(false);
          setError('PDF generation failed. Please re-generate from the encounter page.');
        } else if (status === 'QUEUED' || status === 'RENDERING') {
          schedulePolling(); // keep polling
        }
      }, 3000);
    }

    bootstrap();
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
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

        {/* Status badge when not yet rendered */}
        {(docStatus === 'QUEUED' || docStatus === 'RENDERING') && (
          <span style={{
            padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
            background: 'hsl(var(--status-warning-bg, 48 100% 93%))',
            color: 'hsl(var(--status-warning-fg, 32 95% 44%))',
            border: '1px solid hsl(var(--status-warning-border, 48 100% 80%))',
          }}>
            ⏳ {docStatus === 'QUEUED' ? 'Queued…' : 'Generating PDF…'}
          </span>
        )}

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
            padding: '7px 18px', borderRadius: '6px', border: 'none',
            background: !pdfUrl ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
            color: !pdfUrl ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
            fontSize: '13px', fontWeight: 600,
            cursor: !pdfUrl ? 'not-allowed' : 'pointer',
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
        {!loading && !pdfUrl && !error && (docStatus === 'QUEUED' || docStatus === 'RENDERING') && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '12px',
          }}>
            <div style={{ fontSize: '36px' }}>⏳</div>
            <p style={{ margin: 0, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              PDF is being generated…
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
              This page will refresh automatically. Please wait.
            </p>
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
