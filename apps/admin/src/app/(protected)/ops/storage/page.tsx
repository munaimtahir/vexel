'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type StorageTarget = {
  id: string;
  name: string;
  type: string;
  isEnabled: boolean;
  createdAt: string;
};

type TargetType = 'LOCAL' | 'S3' | 'SSH';

const TYPES: TargetType[] = ['LOCAL', 'S3', 'SSH'];

const CONFIG_FIELDS: Record<TargetType, { key: string; label: string; placeholder?: string }[]> = {
  LOCAL: [{ key: 'path', label: 'Local Path', placeholder: '/mnt/backups' }],
  S3: [
    { key: 'bucket', label: 'Bucket', placeholder: 'my-bucket' },
    { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    { key: 'endpoint', label: 'Endpoint URL (optional)', placeholder: 'https://s3.amazonaws.com' },
    { key: 'prefix', label: 'Prefix (optional)', placeholder: 'backups/' },
  ],
  SSH: [
    { key: 'host', label: 'Host', placeholder: 'backup.example.com' },
    { key: 'user', label: 'SSH User', placeholder: 'backup' },
    { key: 'path', label: 'Remote Path', placeholder: '/backups' },
    { key: 'port', label: 'Port', placeholder: '22' },
  ],
};

export default function StorageTargetsPage() {
  const [targets, setTargets] = useState<StorageTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'LOCAL' as TargetType,
    isEnabled: true,
    config: {} as Record<string, string>,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/ops/storage-targets');
    setTargets((data as any)?.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function setConfig(key: string, value: string) {
    setForm((f) => ({ ...f, config: { ...f.config, [key]: value } }));
  }

  function changeType(type: TargetType) {
    setForm((f) => ({ ...f, type, config: {} }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const configJson = Object.fromEntries(
        Object.entries(form.config).filter(([, v]) => v.trim() !== '')
      );
      await api.POST('/ops/storage-targets:create', {
        body: {
          name: form.name,
          type: form.type,
          isEnabled: form.isEnabled,
          configJson: Object.keys(configJson).length > 0 ? (configJson as any) : null,
        },
      });
      setToast('Storage target created');
      setShowDialog(false);
      setForm({ name: '', type: 'LOCAL', isEnabled: true, config: {} });
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest(id: string) {
    setActionLoading(`test-${id}`);
    try {
      const api = getApiClient(getToken() ?? undefined);
      await api.POST('/ops/storage-targets/{id}:test' as any, { params: { path: { id } } });
      setToast('Test passed');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Test failed');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggle(id: string) {
    setActionLoading(`toggle-${id}`);
    const api = getApiClient(getToken() ?? undefined);
    await api.POST('/ops/storage-targets/{id}:toggle' as any, { params: { path: { id } } });
    setActionLoading(null);
    load();
  }

  return (
    <div className="p-6 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Storage Targets</h1>
        <button
          onClick={() => setShowDialog(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium"
        >
          Add Storage Target
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !targets.length ? (
        <p className="text-sm text-muted-foreground">No storage targets configured.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Enabled</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.type}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${
                        t.isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handleTest(t.id)}
                      disabled={actionLoading === `test-${t.id}`}
                      className="text-xs text-primary hover:underline disabled:opacity-40"
                    >
                      {actionLoading === `test-${t.id}` ? '…' : 'Test'}
                    </button>
                    <button
                      onClick={() => handleToggle(t.id)}
                      disabled={actionLoading === `toggle-${t.id}`}
                      className="text-xs text-primary hover:underline disabled:opacity-40"
                    >
                      {actionLoading === `toggle-${t.id}` ? '…' : t.isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-foreground/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">Add Storage Target</h2>
              <button onClick={() => setShowDialog(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm bg-background"
                  placeholder="My Local Backup"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => changeType(e.target.value as TargetType)}
                  className="w-full border rounded px-3 py-2 text-sm bg-background"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic config fields */}
              {CONFIG_FIELDS[form.type].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-sm font-medium">{label}</label>
                  <input
                    type="text"
                    value={form.config[key] ?? ''}
                    onChange={(e) => setConfig(key, e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                    placeholder={placeholder}
                  />
                </div>
              ))}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm">Enabled</span>
              </label>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDialog(false)}
                  className="px-4 py-2 border rounded text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
