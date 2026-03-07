'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Schedule = {
  id: string;
  type: string;
  cronExpression: string;
  isEnabled: boolean;
  tenantId?: string | null;
  createdAt: string;
};

type StorageTarget = { id: string; name: string; type: string };

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [targets, setTargets] = useState<StorageTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    type: 'FULL_BACKUP' as 'FULL_BACKUP' | 'TENANT_EXPORT',
    cronExpression: '0 2 * * *',
    tenantId: '',
    isEnabled: true,
    retentionDays: 30,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const [schedRes, tgtRes] = await Promise.allSettled([
      api.GET('/ops/schedules'),
      api.GET('/ops/storage-targets'),
    ]);
    if (schedRes.status === 'fulfilled') setSchedules((schedRes.value.data as any)?.data ?? []);
    if (tgtRes.status === 'fulfilled') setTargets((tgtRes.value.data as any)?.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(id: string) {
    setToggling(id);
    const api = getApiClient(getToken() ?? undefined);
    await api.POST('/ops/schedules/{id}:toggle' as any, { params: { path: { id } } });
    setToggling(null);
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const api = getApiClient(getToken() ?? undefined);
      await api.POST('/ops/schedules:create', {
        body: {
          type: form.type,
          cronExpression: form.cronExpression,
          isEnabled: form.isEnabled,
          retentionDays: form.retentionDays,
          ...(form.type === 'TENANT_EXPORT' && form.tenantId ? { tenantId: form.tenantId } : {}),
        },
      });
      setToast('Schedule created');
      setShowDialog(false);
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedules</h1>
        <button
          onClick={() => setShowDialog(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium"
        >
          Create Schedule
        </button>
      </div>

      <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Scheduled execution is external in this release. Creating schedules stores policy/retention only.
        Trigger runs manually from Ops Dashboard or via external automation calling the Ops API.
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !schedules.length ? (
        <p className="text-sm text-muted-foreground">No schedules configured.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">ID</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Cron</th>
                <th className="px-4 py-2 text-left font-medium">Tenant</th>
                <th className="px-4 py-2 text-left font-medium">Enabled</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{s.id.slice(0, 8)}…</td>
                  <td className="px-4 py-2">{s.type}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.cronExpression}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{s.tenantId ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${
                        s.isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {s.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleToggle(s.id)}
                      disabled={toggling === s.id}
                      className="text-xs text-primary hover:underline disabled:opacity-40"
                    >
                      {toggling === s.id ? '…' : s.isEnabled ? 'Disable' : 'Enable'}
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
          <div className="bg-card border rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">Create Schedule</h2>
              <button onClick={() => setShowDialog(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
                  className="w-full border rounded px-3 py-2 text-sm bg-background"
                >
                  <option value="FULL_BACKUP">FULL_BACKUP</option>
                  <option value="TENANT_EXPORT">TENANT_EXPORT</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Cron Expression</label>
                <input
                  type="text"
                  value={form.cronExpression}
                  onChange={(e) => setForm((f) => ({ ...f, cronExpression: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm bg-background font-mono"
                  placeholder="0 2 * * *"
                />
              </div>

              {form.type === 'TENANT_EXPORT' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Tenant ID</label>
                  <input
                    type="text"
                    value={form.tenantId}
                    onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm bg-background"
                    placeholder="Tenant ID"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Retention (days)</label>
                <input
                  type="number"
                  min={1}
                  value={form.retentionDays}
                  onChange={(e) => setForm((f) => ({ ...f, retentionDays: Number(e.target.value) }))}
                  className="w-full border rounded px-3 py-2 text-sm bg-background"
                />
              </div>

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
