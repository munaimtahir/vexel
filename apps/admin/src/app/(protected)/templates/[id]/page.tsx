'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  DRAFT: 'bg-yellow-100 text-yellow-800',
  ARCHIVED: 'bg-gray-100 text-gray-700',
};

const DEFAULT_CONFIG = {
  headerOptions: { showLogo: true, showBrandName: true, showReportHeader: true },
  demographicsBlock: { showMrn: true, showAge: true, showGender: true, showDob: false },
  resultsBlock: { showReferenceRange: true, showFlag: true, showUnit: true },
  footerOptions: { showDisclaimer: true, showSignature: true, showVerifiedBy: true },
  sectionOrder: ['header', 'demographics', 'results', 'footer'],
};

export default function TemplateEditorPage() {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id ?? '';

  const [tpl, setTpl] = useState<any>(null);
  const [name, setName] = useState('');
  const [config, setConfig] = useState<any>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'activate' | 'archive' | 'new-version' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/admin/templates/{templateId}' as any, { params: { path: { templateId: id } } }).then((res) => {
      const t = res.data as any;
      if (t) {
        setTpl(t);
        setName(t.name);
        setConfig(t.configJson ?? DEFAULT_CONFIG);
      }
      setLoading(false);
    }).catch(() => { setError('Failed to load template'); setLoading(false); });
  }, [id]);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const res = await api.PATCH('/admin/templates/{templateId}' as any, {
        params: { path: { templateId: id } },
        body: { name, configJson: config },
      });
      const updated = res.data as any;
      if (updated?.id && updated.id !== id) {
        // A new draft version was created (template was ACTIVE)
        setSuccess('A new draft version was created. Redirecting…');
        setTimeout(() => router.push(`/templates/${updated.id}`), 1500);
      } else {
        setTpl(updated);
        setSuccess('Template saved successfully.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function doAction(action: 'activate' | 'archive' | 'new-version') {
    setActionLoading(true);
    setConfirmAction(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      if (action === 'activate') {
        const res = await api.POST('/admin/templates/{templateId}/activate' as any, { params: { path: { templateId: id } } });
        setTpl(res.data);
        setSuccess('Template activated.');
      } else if (action === 'archive') {
        await api.POST('/admin/templates/{templateId}/archive' as any, { params: { path: { templateId: id } } });
        setSuccess('Template archived. Redirecting…');
        setTimeout(() => router.push('/templates'), 1500);
      } else if (action === 'new-version') {
        const res = await api.POST('/admin/templates/{templateId}/new-version' as any, { params: { path: { templateId: id } } });
        const newId = (res.data as any)?.id;
        setSuccess('New draft version created. Redirecting…');
        setTimeout(() => router.push(`/templates/${newId}`), 1500);
      }
    } catch (e: any) {
      setError(e?.message ?? `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  }

  function toggleConfigFlag(section: string, key: string) {
    setConfig((prev: any) => ({
      ...prev,
      [section]: { ...(prev[section] ?? {}), [key]: !(prev[section]?.[key] ?? false) },
    }));
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading template…</div>;
  if (!tpl) return <div className="p-6 text-destructive">{error ?? 'Template not found.'}</div>;

  const isReadOnly = tpl.status === 'ARCHIVED';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/templates" className="text-sm text-muted-foreground hover:underline">Templates</Link>
            <span className="text-muted-foreground">›</span>
            <span className="text-sm font-medium">{tpl.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{tpl.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[tpl.status]}`}>
              {tpl.status}
            </span>
            <span className="text-xs text-muted-foreground">v{tpl.templateVersion}</span>
            <span className="text-xs text-muted-foreground font-mono">{tpl.code}</span>
            <span className="text-xs text-muted-foreground">{tpl.templateFamily}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/templates/${id}/preview`}
            className="px-3 py-1.5 border rounded-md text-sm hover:bg-muted"
          >
            Preview
          </Link>
          {tpl.status === 'ACTIVE' && (
            <button
              onClick={() => setConfirmAction('new-version')}
              className="px-3 py-1.5 border rounded-md text-sm hover:bg-muted"
              disabled={actionLoading}
            >
              New Version
            </button>
          )}
          {tpl.status === 'DRAFT' && (
            <button
              onClick={() => setConfirmAction('activate')}
              className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
              disabled={actionLoading}
            >
              Activate
            </button>
          )}
          {tpl.status === 'ACTIVE' && (
            <button
              onClick={() => setConfirmAction('archive')}
              className="px-3 py-1.5 border rounded-md text-sm text-gray-500 hover:bg-gray-50"
              disabled={actionLoading}
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-md text-sm">{success}</div>}

      {isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
          This template is archived and cannot be edited. Clone it to create a new editable copy.
        </div>
      )}

      {/* Read-only metadata */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/20 rounded-lg">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Family</div>
          <div className="text-sm font-medium">{tpl.templateFamily}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Schema Type</div>
          <div className="text-sm font-medium">{tpl.schemaType}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Source</div>
          <div className="text-sm">{tpl.isSystemProvisioned ? 'System Provisioned' : 'Custom'}</div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="space-y-6">
        <section>
          <h2 className="text-base font-semibold mb-3">Metadata</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isReadOnly}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-50"
            />
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">Header Options</h2>
          <div className="space-y-2">
            {Object.entries(config?.headerOptions ?? DEFAULT_CONFIG.headerOptions).map(([key, val]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={val as boolean}
                  onChange={() => !isReadOnly && toggleConfigFlag('headerOptions', key)}
                  disabled={isReadOnly}
                />
                <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').replace('show ', 'Show ')}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">Demographics Block</h2>
          <div className="space-y-2">
            {Object.entries(config?.demographicsBlock ?? DEFAULT_CONFIG.demographicsBlock).map(([key, val]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={val as boolean}
                  onChange={() => !isReadOnly && toggleConfigFlag('demographicsBlock', key)}
                  disabled={isReadOnly}
                />
                <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').replace('show ', 'Show ')}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">Results Block</h2>
          <div className="space-y-2">
            {Object.entries(config?.resultsBlock ?? DEFAULT_CONFIG.resultsBlock).map(([key, val]) => (
              typeof val === 'boolean' && (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() => !isReadOnly && toggleConfigFlag('resultsBlock', key)}
                    disabled={isReadOnly}
                  />
                  <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').replace('show ', 'Show ')}</span>
                </label>
              )
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">Footer Options</h2>
          <div className="space-y-2">
            {Object.entries(config?.footerOptions ?? DEFAULT_CONFIG.footerOptions).map(([key, val]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={val as boolean}
                  onChange={() => !isReadOnly && toggleConfigFlag('footerOptions', key)}
                  disabled={isReadOnly}
                />
                <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').replace('show ', 'Show ')}</span>
              </label>
            ))}
          </div>
        </section>

        {!isReadOnly && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Link href="/templates" className="px-4 py-2 border rounded-md text-sm">Cancel</Link>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : tpl.status === 'ACTIVE' ? 'Save as New Draft' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Action confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold mb-2 capitalize">{confirmAction === 'new-version' ? 'Create New Version?' : `${confirmAction} Template?`}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {confirmAction === 'activate' && 'This will activate this draft and archive any other active version with the same code.'}
              {confirmAction === 'archive' && 'This will archive the template. It cannot be used for new documents while archived.'}
              {confirmAction === 'new-version' && 'This will create a new DRAFT version based on this active template. The active version remains in use.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
              <button
                onClick={() => doAction(confirmAction)}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
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
