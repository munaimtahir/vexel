'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { ConfirmActionModal, DataTable, StatusBadge } from '@vexel/ui-system';

type Doctor = {
  id: string;
  code: string;
  displayName: string;
  specialtyName: string;
  consultationFee: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  designation?: string | null;
  degrees?: string | null;
  pmdcNumber?: string | null;
  phcNumber?: string | null;
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  signatureLabel?: string | null;
  signatureUrl?: string | null;
};

type DoctorForm = {
  code: string;
  displayName: string;
  specialtyName: string;
  consultationFee: string;
  currency: string;
  isActive: boolean;
  sortOrder: string;
  designation: string;
  degrees: string;
  pmdcNumber: string;
  phcNumber: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  signatureLabel: string;
  signatureUrl: string;
};

const emptyForm: DoctorForm = {
  code: '',
  displayName: '',
  specialtyName: '',
  consultationFee: '',
  currency: 'PKR',
  isActive: true,
  sortOrder: '0',
  designation: '',
  degrees: '',
  pmdcNumber: '',
  phcNumber: '',
  clinicName: '',
  clinicAddress: '',
  clinicPhone: '',
  signatureLabel: '',
  signatureUrl: '',
};

function mapDoctorToForm(doctor: Doctor): DoctorForm {
  return {
    code: doctor.code,
    displayName: doctor.displayName,
    specialtyName: doctor.specialtyName,
    consultationFee: String(doctor.consultationFee),
    currency: doctor.currency,
    isActive: doctor.isActive,
    sortOrder: String(doctor.sortOrder),
    designation: doctor.designation ?? '',
    degrees: doctor.degrees ?? '',
    pmdcNumber: doctor.pmdcNumber ?? '',
    phcNumber: doctor.phcNumber ?? '',
    clinicName: doctor.clinicName ?? '',
    clinicAddress: doctor.clinicAddress ?? '',
    clinicPhone: doctor.clinicPhone ?? '',
    signatureLabel: doctor.signatureLabel ?? '',
    signatureUrl: doctor.signatureUrl ?? '',
  };
}

export default function OpdDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [error, setError] = useState('');

  const [createForm, setCreateForm] = useState<DoctorForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DoctorForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<Doctor | null>(null);

  async function loadDoctors() {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const isActive = activeFilter === 'all' ? undefined : activeFilter === 'active';
      const { data, error: apiError } = await api.GET('/opd/doctors', {
        params: {
          query: {
            page: 1,
            limit: 100,
            search: search.trim() || undefined,
            isActive,
          },
        },
      });
      if (apiError) {
        setError('Failed to load doctors');
        setDoctors([]);
        return;
      }
      setDoctors((((data as any)?.data ?? []) as Doctor[]) || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  async function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    await loadDoctors();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    if (!createForm.code.trim() || !createForm.displayName.trim() || !createForm.specialtyName.trim()) {
      setCreateError('Code, display name, and specialty are required.');
      return;
    }
    setCreating(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiError } = await api.POST('/opd/doctors', {
        body: {
          code: createForm.code.trim(),
          displayName: createForm.displayName.trim(),
          specialtyName: createForm.specialtyName.trim(),
          consultationFee: Number(createForm.consultationFee || 0),
          currency: createForm.currency.trim().toUpperCase() || 'PKR',
            isActive: createForm.isActive,
            sortOrder: Number(createForm.sortOrder || 0),
            designation: createForm.designation.trim() || null,
            degrees: createForm.degrees.trim() || null,
            pmdcNumber: createForm.pmdcNumber.trim() || null,
            phcNumber: createForm.phcNumber.trim() || null,
            clinicName: createForm.clinicName.trim() || null,
            clinicAddress: createForm.clinicAddress.trim() || null,
            clinicPhone: createForm.clinicPhone.trim() || null,
            signatureLabel: createForm.signatureLabel.trim() || null,
            signatureUrl: createForm.signatureUrl.trim() || null,
          } as any,
        });
      if (apiError) {
        setCreateError('Failed to create doctor');
        return;
      }
      setCreateForm(emptyForm);
      await loadDoctors();
    } finally {
      setCreating(false);
    }
  }

  function startEdit(doctor: Doctor) {
    setEditingId(doctor.id);
    setEditForm(mapDoctorToForm(doctor));
  }

  async function onSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiError } = await api.PATCH('/opd/doctors/{doctorId}', {
        params: { path: { doctorId: editingId } },
        body: {
          code: editForm.code.trim(),
          displayName: editForm.displayName.trim(),
          specialtyName: editForm.specialtyName.trim(),
          consultationFee: Number(editForm.consultationFee || 0),
          currency: editForm.currency.trim().toUpperCase() || 'PKR',
            isActive: editForm.isActive,
            sortOrder: Number(editForm.sortOrder || 0),
            designation: editForm.designation.trim() || null,
            degrees: editForm.degrees.trim() || null,
            pmdcNumber: editForm.pmdcNumber.trim() || null,
            phcNumber: editForm.phcNumber.trim() || null,
            clinicName: editForm.clinicName.trim() || null,
            clinicAddress: editForm.clinicAddress.trim() || null,
            clinicPhone: editForm.clinicPhone.trim() || null,
            signatureLabel: editForm.signatureLabel.trim() || null,
            signatureUrl: editForm.signatureUrl.trim() || null,
          } as any,
        });
      if (apiError) {
        setError('Failed to update doctor');
        return;
      }
      setEditingId(null);
      await loadDoctors();
    } finally {
      setSaving(false);
    }
  }

  async function executeToggle() {
    if (!pendingToggle) return;
    const target = pendingToggle;
    setPendingToggle(null);
    const api = getApiClient(getToken() ?? undefined);
    await api.PATCH('/opd/doctors/{doctorId}', {
      params: { path: { doctorId: target.id } },
      body: { isActive: !target.isActive } as any,
    });
    await loadDoctors();
  }

  const stats = useMemo(() => {
    const active = doctors.filter((doctor) => doctor.isActive).length;
    return { total: doctors.length, active, inactive: doctors.length - active };
  }, [doctors]);

  return (
    <div className="space-y-6">
      <ConfirmActionModal
        open={pendingToggle !== null}
        title={pendingToggle?.isActive ? 'Deactivate Doctor' : 'Activate Doctor'}
        description="This updates doctor availability for OPD registration."
        actionPreview={pendingToggle?.displayName}
        confirmText={pendingToggle?.isActive ? 'Deactivate' : 'Activate'}
        danger={Boolean(pendingToggle?.isActive)}
        onConfirm={executeToggle}
        onCancel={() => setPendingToggle(null)}
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">OPD Doctors</h1>
        <p className="mt-2 text-sm text-muted-foreground">Doctor master for registration and consultation fee defaults.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-border bg-card p-3 text-center"><p className="text-lg font-semibold">{stats.total}</p><p className="text-muted-foreground">Total</p></div>
        <div className="rounded-lg border border-border bg-card p-3 text-center"><p className="text-lg font-semibold">{stats.active}</p><p className="text-muted-foreground">Active</p></div>
        <div className="rounded-lg border border-border bg-card p-3 text-center"><p className="text-lg font-semibold">{stats.inactive}</p><p className="text-muted-foreground">Inactive</p></div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Create Doctor</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Code *"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.code} onChange={(e) => setCreateForm((s) => ({ ...s, code: e.target.value }))} /></Field>
          <Field label="Display Name *"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.displayName} onChange={(e) => setCreateForm((s) => ({ ...s, displayName: e.target.value }))} /></Field>
          <Field label="Specialty *"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.specialtyName} onChange={(e) => setCreateForm((s) => ({ ...s, specialtyName: e.target.value }))} /></Field>
          <Field label="Consultation Fee"><input type="number" min="0" step="0.01" className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.consultationFee} onChange={(e) => setCreateForm((s) => ({ ...s, consultationFee: e.target.value }))} /></Field>
          <Field label="Currency"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.currency} onChange={(e) => setCreateForm((s) => ({ ...s, currency: e.target.value }))} /></Field>
          <Field label="Sort Order"><input type="number" className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.sortOrder} onChange={(e) => setCreateForm((s) => ({ ...s, sortOrder: e.target.value }))} /></Field>
          <Field label="Designation"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.designation} onChange={(e) => setCreateForm((s) => ({ ...s, designation: e.target.value }))} /></Field>
          <Field label="Degrees"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.degrees} onChange={(e) => setCreateForm((s) => ({ ...s, degrees: e.target.value }))} /></Field>
          <Field label="PMDC Number"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.pmdcNumber} onChange={(e) => setCreateForm((s) => ({ ...s, pmdcNumber: e.target.value }))} /></Field>
          <Field label="PHC Number"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.phcNumber} onChange={(e) => setCreateForm((s) => ({ ...s, phcNumber: e.target.value }))} /></Field>
          <Field label="Clinic Name"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.clinicName} onChange={(e) => setCreateForm((s) => ({ ...s, clinicName: e.target.value }))} /></Field>
          <Field label="Clinic Address"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.clinicAddress} onChange={(e) => setCreateForm((s) => ({ ...s, clinicAddress: e.target.value }))} /></Field>
          <Field label="Clinic Phone"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.clinicPhone} onChange={(e) => setCreateForm((s) => ({ ...s, clinicPhone: e.target.value }))} /></Field>
          <Field label="Signature Label"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.signatureLabel} onChange={(e) => setCreateForm((s) => ({ ...s, signatureLabel: e.target.value }))} /></Field>
          <Field label="Signature URL"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={createForm.signatureUrl} onChange={(e) => setCreateForm((s) => ({ ...s, signatureUrl: e.target.value }))} /></Field>
          <label className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
            <input type="checkbox" checked={createForm.isActive} onChange={(e) => setCreateForm((s) => ({ ...s, isActive: e.target.checked }))} />
            Active
          </label>
          <div className="xl:col-span-4">
            {createError ? <p className="mb-2 text-sm text-destructive">{createError}</p> : null}
            <button type="submit" disabled={creating} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {creating ? 'Creating...' : 'Create Doctor'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <form onSubmit={onSearchSubmit} className="flex flex-wrap items-end gap-3">
          <Field label="Search"><input className="w-72 rounded-md border border-border px-3 py-2 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, name, specialty" /></Field>
          <Field label="Filter"><select className="rounded-md border border-border px-3 py-2 text-sm" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as any)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
          <button type="submit" className="rounded-md border border-border px-4 py-2 text-sm">Apply</button>
        </form>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <div className="mt-4">
          <DataTable
            data={doctors}
            loading={loading}
            emptyMessage="No doctors found."
            keyExtractor={(doctor) => doctor.id}
            columns={[
              { key: 'code', header: 'Code', cell: (doctor) => doctor.code },
              { key: 'displayName', header: 'Doctor', cell: (doctor) => doctor.displayName },
               { key: 'specialtyName', header: 'Specialty', cell: (doctor) => doctor.specialtyName },
               {
                 key: 'designation',
                 header: 'Designation',
                 cell: (doctor) => doctor.designation || '—',
               },
               {
                 key: 'pmdcNumber',
                 header: 'PMDC/PHC',
                 cell: (doctor) => `${doctor.pmdcNumber || '—'} / ${doctor.phcNumber || '—'}`,
               },
               { key: 'consultationFee', header: 'Fee', cell: (doctor) => `${doctor.currency} ${doctor.consultationFee}` },
              { key: 'sortOrder', header: 'Sort', cell: (doctor) => doctor.sortOrder },
              {
                key: 'isActive',
                header: 'Status',
                cell: (doctor) => (
                  <StatusBadge tone={doctor.isActive ? 'green' : 'neutral'}>
                    {doctor.isActive ? 'Active' : 'Inactive'}
                  </StatusBadge>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                cell: (doctor) => (
                  <div className="flex gap-2">
                    <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => startEdit(doctor)}>
                      Edit
                    </button>
                    <button type="button" className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => setPendingToggle(doctor)}>
                      {doctor.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>

      {editingId ? (
        <div className="rounded-xl border border-border bg-muted p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Edit Doctor</h3>
            <button className="text-sm underline" onClick={() => setEditingId(null)}>Close</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Code"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.code} onChange={(e) => setEditForm((s) => ({ ...s, code: e.target.value }))} /></Field>
            <Field label="Display Name"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.displayName} onChange={(e) => setEditForm((s) => ({ ...s, displayName: e.target.value }))} /></Field>
            <Field label="Specialty"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.specialtyName} onChange={(e) => setEditForm((s) => ({ ...s, specialtyName: e.target.value }))} /></Field>
            <Field label="Consultation Fee"><input type="number" min="0" step="0.01" className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.consultationFee} onChange={(e) => setEditForm((s) => ({ ...s, consultationFee: e.target.value }))} /></Field>
            <Field label="Currency"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.currency} onChange={(e) => setEditForm((s) => ({ ...s, currency: e.target.value }))} /></Field>
            <Field label="Sort Order"><input type="number" className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.sortOrder} onChange={(e) => setEditForm((s) => ({ ...s, sortOrder: e.target.value }))} /></Field>
            <Field label="Designation"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.designation} onChange={(e) => setEditForm((s) => ({ ...s, designation: e.target.value }))} /></Field>
            <Field label="Degrees"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.degrees} onChange={(e) => setEditForm((s) => ({ ...s, degrees: e.target.value }))} /></Field>
            <Field label="PMDC Number"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.pmdcNumber} onChange={(e) => setEditForm((s) => ({ ...s, pmdcNumber: e.target.value }))} /></Field>
            <Field label="PHC Number"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.phcNumber} onChange={(e) => setEditForm((s) => ({ ...s, phcNumber: e.target.value }))} /></Field>
            <Field label="Clinic Name"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.clinicName} onChange={(e) => setEditForm((s) => ({ ...s, clinicName: e.target.value }))} /></Field>
            <Field label="Clinic Address"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.clinicAddress} onChange={(e) => setEditForm((s) => ({ ...s, clinicAddress: e.target.value }))} /></Field>
            <Field label="Clinic Phone"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.clinicPhone} onChange={(e) => setEditForm((s) => ({ ...s, clinicPhone: e.target.value }))} /></Field>
            <Field label="Signature Label"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.signatureLabel} onChange={(e) => setEditForm((s) => ({ ...s, signatureLabel: e.target.value }))} /></Field>
            <Field label="Signature URL"><input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={editForm.signatureUrl} onChange={(e) => setEditForm((s) => ({ ...s, signatureUrl: e.target.value }))} /></Field>
            <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"><input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((s) => ({ ...s, isActive: e.target.checked }))} />Active</label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" disabled={saving} onClick={() => void onSaveEdit()}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="rounded-md border border-border px-4 py-2 text-sm" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
