'use client';
import { useEffect, useState, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  DRAFT: 'bg-yellow-100 text-yellow-800',
  ARCHIVED: 'bg-gray-100 text-gray-700',
};

const FAMILY_LABELS: Record<string, string> = {
  GENERAL_TABLE: 'General Table',
  TWO_COLUMN_TABLE: 'Two Column',
  PERIPHERAL_FILM_REPORT: 'Peripheral Film',
  HISTOPATH_NARRATIVE: 'Histopathology',
  GRAPHICAL_SCALE_REPORT: 'Graphical Scale',
  IMAGE_REPORT: 'Image Report',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ templateId: string; action: 'activate' | 'archive' } | null>(null);

  const LIMIT = 20;

  const load = useCallback(async (p = page, s = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.GET('/admin/templates' as any, {
        params: { query: { page: p, limit: LIMIT, ...(s ? { status: s } : {}) } },
      });
      setTemplates((res.data as any)?.data ?? []);
      setTotal((res.data as any)?.pagination?.total ?? 0);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, []);

  async function doAction(templateId: string, action: 'activate' | 'archive') {
    setActionLoading(templateId + action);
    setConfirmDialog(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      if (action === 'activate') {
        await api.POST('/admin/templates/{templateId}/activate' as any, { params: { path: { templateId } } });
      } else {
        await api.POST('/admin/templates/{templateId}/archive' as any, { params: { path: { templateId } } });
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? `Failed to ${action} template`);
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Print Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage tenant-specific report templates for LIMS printing</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/templates/new"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90"
          >
            + New Template
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); load(1, e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-2">No templates found.</p>
          <p className="text-sm text-muted-foreground">
            <Link href="/templates/new" className="text-primary underline">Create your first template</Link>
            {' '}or{' '}
            <button
              className="text-primary underline"
              onClick={async () => {
                try {
                  const api = getApiClient(getToken() ?? undefined);
                  await api.POST('/admin/template-blueprints/provision-defaults' as any, { body: {} });
                  await load();
                } catch (e: any) { setError(e?.message ?? 'Failed to provision'); }
              }}
            >
              provision starter templates
            </button>.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Code</th>
                <th className="text-left px-4 py-3 font-medium">Family</th>
                <th className="text-left px-4 py-3 font-medium">Schema Type</th>
                <th className="text-left px-4 py-3 font-medium">Version</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/templates/${t.id}`} className="text-primary hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.code}</td>
                  <td className="px-4 py-3">{FAMILY_LABELS[t.templateFamily] ?? t.templateFamily}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.schemaType}</td>
                  <td className="px-4 py-3">v{t.templateVersion}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-100'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t.isSystemProvisioned ? 'Blueprint' : 'Custom'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/templates/${t.id}/preview`}
                        className="px-2 py-1 rounded text-xs border hover:bg-muted"
                      >
                        Preview
                      </Link>
                      <Link
                        href={`/templates/${t.id}`}
                        className="px-2 py-1 rounded text-xs border hover:bg-muted"
                      >
                        Edit
                      </Link>
                      {t.status === 'DRAFT' && (
                        <button
                          disabled={actionLoading === t.id + 'activate'}
                          onClick={() => setConfirmDialog({ templateId: t.id, action: 'activate' })}
                          className="px-2 py-1 rounded text-xs border text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                          Activate
                        </button>
                      )}
                      {t.status === 'ACTIVE' && (
                        <button
                          disabled={actionLoading === t.id + 'archive'}
                          onClick={() => setConfirmDialog({ templateId: t.id, action: 'archive' })}
                          className="px-2 py-1 rounded text-xs border text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => { setPage(page - 1); load(page - 1); }} className="px-3 py-1 border rounded text-sm disabled:opacity-40">←</button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => { setPage(page + 1); load(page + 1); }} className="px-3 py-1 border rounded text-sm disabled:opacity-40">→</button>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold mb-2 capitalize">{confirmDialog.action} Template?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {confirmDialog.action === 'activate'
                ? 'This will activate this draft. Any other active version with the same code will be archived.'
                : 'This will archive the template. It cannot be mapped to new tests while archived.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDialog(null)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
              <button
                onClick={() => doAction(confirmDialog.templateId, confirmDialog.action)}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
