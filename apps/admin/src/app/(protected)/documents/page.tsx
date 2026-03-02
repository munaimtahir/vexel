'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { TenantScopeBanner } from '@/components/tenant-scope-banner';
import { DataTable } from '@vexel/ui-system';

const DOC_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  QUEUED: { bg: 'hsl(var(--status-warning-bg))', text: 'hsl(var(--status-warning-fg))' },
  RENDERING: { bg: 'hsl(var(--status-info-bg))', text: 'hsl(var(--status-info-fg))' },
  RENDERED: { bg: 'hsl(var(--status-success-bg))', text: 'hsl(var(--status-success-fg))' },
  PUBLISHED: { bg: 'hsl(var(--status-success-bg))', text: 'hsl(var(--status-success-fg))' },
  FAILED: { bg: 'hsl(var(--status-destructive-bg))', text: 'hsl(var(--status-destructive-fg))' },
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const LIMIT = 25;

  async function load(p = 1, status = '') {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const query: any = { page: p, limit: LIMIT };
    if (status) query.status = status;
    const res = await api.GET('/documents' as any, { params: { query } });
    const data = res.data;
    if (Array.isArray(data)) {
      setDocuments(data);
      setTotal(data.length);
    } else {
      setDocuments((data as any)?.data ?? []);
      setTotal((data as any)?.total ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleRepublish(docId: string) {
    setPublishing(docId); setMsg(null);
    const api = getApiClient(getToken() ?? undefined);
    const res = await api.POST('/documents/{id}:publish' as any, { params: { path: { id: docId } } });
    if ((res as any).error) {
      setMsg({ type: 'err', text: (res as any).error?.message ?? 'Failed to re-publish' });
    } else {
      setMsg({ type: 'ok', text: 'Document queued for re-publishing.' });
    }
    setPublishing(null);
    setTimeout(() => load(page, statusFilter), 1000);
  }

  function handlePage(p: number) { setPage(p); load(p, statusFilter); }
  function handleStatus(s: string) { setStatusFilter(s); setPage(1); load(1, s); }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>Documents</h1>
        <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Read-only — re-publish failed docs from here</span>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <TenantScopeBanner mode="current-auth" pageLabel="Documents" note="Document list/actions are scoped to the current authenticated tenant/host." />
      </div>

      {msg && (
        <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', background: msg.type === 'ok' ? 'hsl(var(--status-success-bg))' : 'hsl(var(--status-destructive-bg))', color: msg.type === 'ok' ? 'hsl(var(--status-success-fg))' : 'hsl(var(--status-destructive-fg))' }}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ marginLeft: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.6 }}>✕</button>
        </div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Status:</label>
        <select value={statusFilter} onChange={(e) => handleStatus(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px' }}>
          <option value="">All statuses</option>
          {Object.keys(DOC_STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>{total} total</span>
      </div>

      <div style={{ background: 'hsl(var(--card))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <DataTable
          data={documents}
          loading={loading}
          emptyMessage="No documents found."
          keyExtractor={(document) => document.id}
          columns={[
            {
              key: 'id',
              header: 'ID',
              cell: (document) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
                  {document.id?.slice(0, 12)}…
                </span>
              ),
            },
            {
              key: 'type',
              header: 'Type',
              cell: (document) => <span style={{ fontWeight: 500 }}>{document.type ?? '—'}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (document) => {
                const colors = DOC_STATUS_COLORS[document.status] ?? { bg: 'hsl(var(--muted))', text: 'hsl(var(--muted-foreground))' };
                return (
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: colors.bg, color: colors.text }}>
                    {document.status}
                  </span>
                );
              },
            },
            {
              key: 'encounter',
              header: 'Encounter',
              cell: (document) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
                  {document.encounterId?.slice(0, 8) ?? '—'}
                </span>
              ),
            },
            {
              key: 'templateVersion',
              header: 'Template Ver',
              cell: (document) => <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px' }}>{document.templateVersion ?? '—'}</span>,
            },
            {
              key: 'tenant',
              header: 'Tenant',
              cell: (document) => (
                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontFamily: 'monospace' }}>
                  {document.tenantId?.slice(0, 8) ?? '—'}
                </span>
              ),
            },
            {
              key: 'created',
              header: 'Created',
              cell: (document) => (
                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '11px' }}>
                  {document.createdAt ? new Date(document.createdAt).toLocaleString() : '—'}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              cell: (document) => (
                document.status === 'FAILED' ? (
                  <button
                    onClick={() => handleRepublish(document.id)}
                    disabled={publishing === document.id}
                    style={{ padding: '4px 10px', fontSize: '12px', background: 'hsl(var(--status-info-bg))', color: 'hsl(var(--status-info-fg))', border: '1px solid hsl(var(--status-info-border))', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {publishing === document.id ? '...' : 'Re-publish'}
                  </button>
                ) : null
              ),
            },
          ]}
        />
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', alignItems: 'center', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
          <button disabled={page <= 1} onClick={() => handlePage(page - 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page > 1 ? 'pointer' : 'default', background: 'hsl(var(--card))' }}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)} style={{ padding: '5px 10px', border: '1px solid hsl(var(--border))', borderRadius: '4px', cursor: page < totalPages ? 'pointer' : 'default', background: 'hsl(var(--card))' }}>Next →</button>
        </div>
      )}
    </div>
  );
}
