'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function TemplatePreviewPage() {
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id ?? '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  async function generatePreview() {
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: reqError } = await api.POST('/admin/templates/{templateId}/preview' as any, {
        params: { path: { templateId: id } },
        body: {},
        parseAs: 'blob',
      } as any);
      if (reqError) {
        throw new Error((reqError as any)?.message ?? 'Failed to render preview');
      }
      const url = URL.createObjectURL(data as Blob);
      setPdfUrl(url);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/templates" className="text-sm text-muted-foreground hover:underline">Templates</Link>
        <span className="text-muted-foreground">›</span>
        <Link href={`/templates/${id}`} className="text-sm text-muted-foreground hover:underline">Editor</Link>
        <span className="text-muted-foreground">›</span>
        <span className="text-sm font-medium">Preview</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Template Preview</h1>
        <button
          onClick={generatePreview}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Generating…' : pdfUrl ? 'Regenerate Preview' : 'Generate Preview'}
        </button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Preview renders using sample data. No real documents are created or workflow state is changed.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {!pdfUrl && !loading && (
        <div className="border-2 border-dashed rounded-lg py-20 text-center bg-muted/10">
          <p className="text-muted-foreground text-sm mb-3">Click &quot;Generate Preview&quot; to render a sample PDF with this template.</p>
          <p className="text-xs text-muted-foreground">Uses sample patient and result data. No real encounter or document is created.</p>
        </div>
      )}

      {loading && (
        <div className="border rounded-lg py-20 text-center bg-muted/10">
          <p className="text-muted-foreground text-sm">Rendering preview…</p>
        </div>
      )}

      {pdfUrl && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground flex justify-between items-center">
            <span>Preview (sample data only)</span>
            <a
              href={pdfUrl}
              download="template-preview.pdf"
              className="text-primary underline"
            >
              Download PDF
            </a>
          </div>
          <iframe
            src={pdfUrl}
            title="Template Preview"
            className="w-full"
            style={{ height: '80vh' }}
          />
        </div>
      )}
    </div>
  );
}
