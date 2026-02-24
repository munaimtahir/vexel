'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Provider = { id: string; name: string; code?: string | null; isActive: boolean };
type Schedule = {
  id: string;
  providerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  maxAppointments?: number | null;
  location?: string | null;
  isActive: boolean;
  updatedAt: string;
};

type ScheduleForm = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotMinutes: string;
  maxAppointments: string;
  location: string;
  isActive: boolean;
};

const emptyScheduleForm: ScheduleForm = {
  dayOfWeek: '1',
  startTime: '09:00',
  endTime: '17:00',
  slotMinutes: '15',
  maxAppointments: '',
  location: '',
  isActive: true,
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildScheduleCreateBody(form: ScheduleForm) {
  return {
    dayOfWeek: Number(form.dayOfWeek),
    startTime: form.startTime,
    endTime: form.endTime,
    slotMinutes: Number(form.slotMinutes),
    ...(form.maxAppointments.trim() ? { maxAppointments: Number(form.maxAppointments) } : {}),
    ...(form.location.trim() ? { location: form.location.trim() } : {}),
    isActive: form.isActive,
  };
}

function buildSchedulePatchBody(form: ScheduleForm) {
  return {
    startTime: form.startTime,
    endTime: form.endTime,
    slotMinutes: Number(form.slotMinutes),
    maxAppointments: form.maxAppointments.trim() ? Number(form.maxAppointments) : null,
    location: form.location.trim() ? form.location.trim() : null,
    isActive: form.isActive,
  };
}

function toForm(schedule: Schedule): ScheduleForm {
  return {
    dayOfWeek: String(schedule.dayOfWeek),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    slotMinutes: String(schedule.slotMinutes),
    maxAppointments: schedule.maxAppointments == null ? '' : String(schedule.maxAppointments),
    location: schedule.location ?? '',
    isActive: schedule.isActive,
  };
}

export default function OpdSchedulesPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providerId, setProviderId] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<'active' | 'all'>('active');

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [error, setError] = useState('');

  const [createForm, setCreateForm] = useState<ScheduleForm>(emptyScheduleForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ScheduleForm>(emptyScheduleForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadProviders() {
    setProvidersLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    const { data } = await api.GET('/opd/providers' as any, {
      params: { query: { page: 1, limit: 100, isActive: providerFilter === 'active' ? true : undefined } },
    });
    const list = (((data as any)?.data ?? []) as Provider[]).sort((a, b) => a.name.localeCompare(b.name));
    setProviders(list);
    setProvidersLoading(false);
    setProviderId((current) => (current && list.some((p) => p.id === current) ? current : (list[0]?.id ?? '')));
  }

  async function loadSchedules(targetProviderId: string) {
    if (!targetProviderId) {
      setSchedules([]);
      return;
    }
    setLoadingSchedules(true);
    setError('');
    const api = getApiClient(getToken() ?? undefined);
    const isActive = scheduleFilter === 'all' ? undefined : scheduleFilter === 'active';
    const { data, error: resError } = await api.GET('/opd/providers/{providerId}/schedules' as any, {
      params: { path: { providerId: targetProviderId }, query: { isActive } },
    });
    if (resError) {
      setError((resError as any)?.message ?? 'Failed to load schedules');
      setSchedules([]);
      setLoadingSchedules(false);
      return;
    }
    setSchedules(((data as any)?.data ?? []) as Schedule[]);
    setLoadingSchedules(false);
  }

  useEffect(() => {
    void loadProviders();
  }, [providerFilter]);

  useEffect(() => {
    if (providerId) {
      void loadSchedules(providerId);
    } else {
      setSchedules([]);
    }
  }, [providerId, scheduleFilter]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!providerId) return;
    setCreateError('');
    setCreating(true);
    const api = getApiClient(getToken() ?? undefined);
    const { error: createErr } = await api.POST('/opd/providers/{providerId}/schedules' as any, {
      params: { path: { providerId } },
      body: buildScheduleCreateBody(createForm),
    });
    if (createErr) {
      setCreateError((createErr as any)?.message ?? 'Failed to create schedule');
      setCreating(false);
      return;
    }
    setCreateForm(emptyScheduleForm);
    setCreating(false);
    await loadSchedules(providerId);
  }

  function startEdit(schedule: Schedule) {
    setEditingId(schedule.id);
    setEditForm(toForm(schedule));
    setEditError('');
  }

  async function saveEdit() {
    if (!providerId || !editingId) return;
    setSavingEdit(true);
    setEditError('');
    const api = getApiClient(getToken() ?? undefined);
    const { error: patchErr } = await api.PATCH('/opd/providers/{providerId}/schedules/{scheduleId}' as any, {
      params: { path: { providerId, scheduleId: editingId } },
      body: buildSchedulePatchBody(editForm),
    });
    if (patchErr) {
      setEditError((patchErr as any)?.message ?? 'Failed to update schedule');
      setSavingEdit(false);
      return;
    }
    setSavingEdit(false);
    setEditingId(null);
    await loadSchedules(providerId);
  }

  async function handleDelete(scheduleId: string) {
    if (!providerId) return;
    const confirmed = window.confirm('Delete this schedule configuration? This does not change appointment workflow states.');
    if (!confirmed) return;
    setDeletingId(scheduleId);
    const api = getApiClient(getToken() ?? undefined);
    const { error: deleteErr } = await api.DELETE('/opd/providers/{providerId}/schedules/{scheduleId}' as any, {
      params: { path: { providerId, scheduleId } },
    });
    if (deleteErr) {
      setError((deleteErr as any)?.message ?? 'Failed to delete schedule');
      setDeletingId(null);
      return;
    }
    setDeletingId(null);
    await loadSchedules(providerId);
  }

  const selectedProvider = useMemo(() => providers.find((p) => p.id === providerId) ?? null, [providers, providerId]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">OPD Schedules</h1>
        <p className="mt-2 text-sm text-slate-600">
          Weekly provider schedule configuration only. No appointment/visit/invoice workflow mutations are available here.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Provider List Filter">
            <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value as any)}>
              <option value="active">Active providers only</option>
              <option value="all">All providers</option>
            </select>
          </Field>
          <Field label="Provider">
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              disabled={providersLoading || providers.length === 0}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.code ? ` (${p.code})` : ''}{p.isActive ? '' : ' [inactive]'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Schedule Filter">
            <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value as any)}>
              <option value="all">All schedules</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </Field>
        </div>
        {selectedProvider ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Editing schedules for <span className="font-semibold text-slate-900">{selectedProvider.name}</span>
            {selectedProvider.code ? <span> ({selectedProvider.code})</span> : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Create Schedule</h2>
        {!providerId ? (
          <p className="mt-3 text-sm text-slate-500">Select a provider first.</p>
        ) : (
          <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Day">
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={createForm.dayOfWeek} onChange={(e) => setCreateForm((s) => ({ ...s, dayOfWeek: e.target.value }))}>
                {DAYS.map((day, i) => (
                  <option key={day} value={String(i)}>{day}</option>
                ))}
              </select>
            </Field>
            <Field label="Start Time">
              <input type="time" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={createForm.startTime} onChange={(e) => setCreateForm((s) => ({ ...s, startTime: e.target.value }))} />
            </Field>
            <Field label="End Time">
              <input type="time" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={createForm.endTime} onChange={(e) => setCreateForm((s) => ({ ...s, endTime: e.target.value }))} />
            </Field>
            <Field label="Slot Minutes">
              <input type="number" min="5" step="5" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={createForm.slotMinutes} onChange={(e) => setCreateForm((s) => ({ ...s, slotMinutes: e.target.value }))} />
            </Field>
            <Field label="Max Appointments">
              <input type="number" min="1" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={createForm.maxAppointments} onChange={(e) => setCreateForm((s) => ({ ...s, maxAppointments: e.target.value }))} placeholder="Optional" />
            </Field>
            <Field label="Location">
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={createForm.location} onChange={(e) => setCreateForm((s) => ({ ...s, location: e.target.value }))} placeholder="Room 3 / Clinic A" />
            </Field>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={createForm.isActive} onChange={(e) => setCreateForm((s) => ({ ...s, isActive: e.target.checked }))} />
              Active
            </label>
            {createError ? (
              <div className="md:col-span-2 xl:col-span-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            ) : null}
            <div className="md:col-span-2 xl:col-span-4">
              <button type="submit" disabled={creating} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
                {creating ? 'Creating...' : 'Create Schedule'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Schedules</h2>
          <button onClick={() => providerId && void loadSchedules(providerId)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Day</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Slot</th>
                <th className="px-3 py-2">Max</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingSchedules ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Loading schedules...</td></tr>
              ) : !providerId ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Select a provider to view schedules.</td></tr>
              ) : schedules.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No schedules found for selected provider.</td></tr>
              ) : schedules.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{DAYS[s.dayOfWeek] ?? s.dayOfWeek}</td>
                  <td className="px-3 py-2">{s.startTime} - {s.endTime}</td>
                  <td className="px-3 py-2">{s.slotMinutes} min</td>
                  <td className="px-3 py-2">{s.maxAppointments ?? '—'}</td>
                  <td className="px-3 py-2">{s.location ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{new Date(s.updatedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(s)} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700">
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDelete(s.id)}
                        disabled={deletingId === s.id}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                      >
                        {deletingId === s.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingId ? (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Edit Schedule</h3>
              <button onClick={() => setEditingId(null)} className="text-sm text-slate-600 underline">Close</button>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Day of week is immutable in this UI to avoid accidental slot remapping; create a new schedule if needed.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Day">
                <input className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600" value={DAYS[Number(editForm.dayOfWeek)] ?? editForm.dayOfWeek} disabled />
              </Field>
              <Field label="Start Time">
                <input type="time" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.startTime} onChange={(e) => setEditForm((s) => ({ ...s, startTime: e.target.value }))} />
              </Field>
              <Field label="End Time">
                <input type="time" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.endTime} onChange={(e) => setEditForm((s) => ({ ...s, endTime: e.target.value }))} />
              </Field>
              <Field label="Slot Minutes">
                <input type="number" min="5" step="5" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.slotMinutes} onChange={(e) => setEditForm((s) => ({ ...s, slotMinutes: e.target.value }))} />
              </Field>
              <Field label="Max Appointments">
                <input type="number" min="1" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.maxAppointments} onChange={(e) => setEditForm((s) => ({ ...s, maxAppointments: e.target.value }))} />
              </Field>
              <Field label="Location">
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.location} onChange={(e) => setEditForm((s) => ({ ...s, location: e.target.value }))} />
              </Field>
              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((s) => ({ ...s, isActive: e.target.checked }))} />
                Active
              </label>
            </div>
            {editError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button onClick={() => void saveEdit()} disabled={savingEdit} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {savingEdit ? 'Saving...' : 'Save Schedule'}
              </button>
              <button onClick={() => setEditingId(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">{label}</span>
      {children}
    </label>
  );
}
