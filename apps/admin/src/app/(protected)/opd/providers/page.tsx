'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Provider = {
  id: string;
  code?: string | null;
  name: string;
  title?: string | null;
  specialty?: string | null;
  consultationFee?: number | null;
  isActive: boolean;
  updatedAt: string;
};

type ProviderForm = {
  code: string;
  name: string;
  title: string;
  specialty: string;
  consultationFee: string;
  isActive: boolean;
};

const emptyForm: ProviderForm = {
  code: '',
  name: '',
  title: '',
  specialty: '',
  consultationFee: '',
  isActive: true,
};

function mapProviderToForm(p: Provider): ProviderForm {
  return {
    code: p.code ?? '',
    name: p.name ?? '',
    title: p.title ?? '',
    specialty: p.specialty ?? '',
    consultationFee: p.consultationFee == null ? '' : String(p.consultationFee),
    isActive: p.isActive,
  };
}

function parseProviderBody(form: ProviderForm) {
  return {
    ...(form.code.trim() ? { code: form.code.trim() } : {}),
    name: form.name.trim(),
    ...(form.title.trim() ? { title: form.title.trim() } : {}),
    ...(form.specialty.trim() ? { specialty: form.specialty.trim() } : {}),
    ...(form.consultationFee.trim() ? { consultationFee: Number(form.consultationFee) } : {}),
    isActive: form.isActive,
  };
}

export default function OpdProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [createForm, setCreateForm] = useState<ProviderForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProviderForm>(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  async function loadProviders() {
    setLoading(true);
    setError('');
    const api = getApiClient(getToken() ?? undefined);
    const isActive =
      activeFilter === 'all' ? undefined : activeFilter === 'active';

    const { data, error: listError } = await api.GET('/opd/providers' as any, {
      params: { query: { page: 1, limit: 100, search: search.trim() || undefined, isActive } },
    });

    if (listError) {
      setError((listError as any)?.message ?? 'Failed to load providers');
      setProviders([]);
      setLoading(false);
      return;
    }

    setProviders(((data as any)?.data ?? []) as Provider[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadProviders();
  }, [activeFilter]);

  async function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    await loadProviders();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    if (!createForm.name.trim()) {
      setCreateError('Name is required');
      return;
    }
    setCreating(true);
    const api = getApiClient(getToken() ?? undefined);
    const { error: createErr } = await api.POST('/opd/providers' as any, {
      body: parseProviderBody(createForm),
    });
    if (createErr) {
      setCreateError((createErr as any)?.message ?? 'Failed to create provider');
      setCreating(false);
      return;
    }
    setCreateForm(emptyForm);
    setCreating(false);
    await loadProviders();
  }

  function startEdit(provider: Provider) {
    setEditingId(provider.id);
    setEditForm(mapProviderToForm(provider));
    setEditError('');
  }

  async function handleEditSave(providerId: string) {
    setSavingEdit(true);
    setEditError('');
    const api = getApiClient(getToken() ?? undefined);
    const body = {
      ...(editForm.code.trim() ? { code: editForm.code.trim() } : { code: '' }),
      ...(editForm.name.trim() ? { name: editForm.name.trim() } : {}),
      ...(editForm.title.trim() ? { title: editForm.title.trim() } : { title: null }),
      ...(editForm.specialty.trim() ? { specialty: editForm.specialty.trim() } : { specialty: null }),
      consultationFee: editForm.consultationFee.trim() ? Number(editForm.consultationFee) : null,
      isActive: editForm.isActive,
    };

    const { error: updateErr } = await api.PATCH('/opd/providers/{providerId}' as any, {
      params: { path: { providerId } },
      body,
    });
    if (updateErr) {
      setEditError((updateErr as any)?.message ?? 'Failed to update provider');
      setSavingEdit(false);
      return;
    }
    setSavingEdit(false);
    setEditingId(null);
    await loadProviders();
  }

  const counts = useMemo(() => {
    const active = providers.filter((p) => p.isActive).length;
    return { total: providers.length, active, inactive: providers.length - active };
  }, [providers]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">OPD Providers</h1>
            <p className="mt-2 text-sm text-slate-600">
              Tenant-scoped provider configuration. No appointment workflow controls on this page.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Total" value={counts.total} />
            <Stat label="Active" value={counts.active} />
            <Stat label="Inactive" value={counts.inactive} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Create Provider</h2>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Provider Name *">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={createForm.name}
              onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Dr. Sarah Khan"
            />
          </Field>
          <Field label="Code">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={createForm.code}
              onChange={(e) => setCreateForm((s) => ({ ...s, code: e.target.value }))}
              placeholder="OPD-001"
            />
          </Field>
          <Field label="Title">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={createForm.title}
              onChange={(e) => setCreateForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="Consultant"
            />
          </Field>
          <Field label="Specialty">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={createForm.specialty}
              onChange={(e) => setCreateForm((s) => ({ ...s, specialty: e.target.value }))}
              placeholder="General Medicine"
            />
          </Field>
          <Field label="Consultation Fee">
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={createForm.consultationFee}
              onChange={(e) => setCreateForm((s) => ({ ...s, consultationFee: e.target.value }))}
              placeholder="1500"
            />
          </Field>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(e) => setCreateForm((s) => ({ ...s, isActive: e.target.checked }))}
            />
            Active
          </label>
          {createError ? (
            <div className="md:col-span-2 xl:col-span-3 rounded-md border border-[hsl(var(--status-destructive-border))] bg-[hsl(var(--status-destructive-bg))] px-3 py-2 text-sm text-[hsl(var(--status-destructive-fg))]">
              {createError}
            </div>
          ) : null}
          <div className="md:col-span-2 xl:col-span-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Creating...' : 'Create Provider'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Search">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-72"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name / code / specialty"
              />
            </Field>
            <Field label="Active Filter">
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-40"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </Field>
            <button type="submit" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-foreground">
              Apply
            </button>
          </form>
          <button onClick={() => void loadProviders()} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-foreground">
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-[hsl(var(--status-destructive-border))] bg-[hsl(var(--status-destructive-bg))] px-3 py-2 text-sm text-[hsl(var(--status-destructive-fg))]">{error}</div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Specialty</th>
                <th className="px-3 py-2">Fee</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Loading providers...</td>
                </tr>
              ) : providers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">No providers found.</td>
                </tr>
              ) : providers.map((provider) => {
                const isEditing = editingId === provider.id;
                return (
                  <tr key={provider.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2">{provider.code ?? '—'}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <div>{provider.name}</div>
                      {provider.title ? <div className="text-xs text-slate-500">{provider.title}</div> : null}
                    </td>
                    <td className="px-3 py-2">{provider.specialty ?? '—'}</td>
                    <td className="px-3 py-2">{provider.consultationFee == null ? '—' : provider.consultationFee}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${provider.isActive ? 'bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))]' : 'bg-slate-200 text-foreground'}`}>
                        {provider.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{new Date(provider.updatedAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Link
                          href={`/opd/providers/${provider.id}`}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-foreground"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => startEdit(provider)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-foreground"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editingId ? (
          <div className="mt-6 rounded-lg border border-border bg-muted p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Edit Provider</h3>
                <button onClick={() => setEditingId(null)} className="text-sm text-slate-600 underline">
                  Close
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Name">
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.name} onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} />
                </Field>
                <Field label="Code">
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.code} onChange={(e) => setEditForm((s) => ({ ...s, code: e.target.value }))} />
                </Field>
                <Field label="Title">
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.title} onChange={(e) => setEditForm((s) => ({ ...s, title: e.target.value }))} />
                </Field>
                <Field label="Specialty">
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.specialty} onChange={(e) => setEditForm((s) => ({ ...s, specialty: e.target.value }))} />
                </Field>
                <Field label="Consultation Fee">
                  <input type="number" min="0" step="0.01" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editForm.consultationFee} onChange={(e) => setEditForm((s) => ({ ...s, consultationFee: e.target.value }))} />
                </Field>
                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-foreground">
                  <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((s) => ({ ...s, isActive: e.target.checked }))} />
                  Active
                </label>
              </div>
              {editError ? (
                <div className="rounded-md border border-[hsl(var(--status-destructive-border))] bg-[hsl(var(--status-destructive-bg))] px-3 py-2 text-sm text-[hsl(var(--status-destructive-fg))]">{editError}</div>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => void handleEditSave(editingId)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-foreground">
                  Cancel
                </button>
              </div>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
