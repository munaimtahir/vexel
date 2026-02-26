'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function toIsoLocal(value: string): string | null {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export default function NewOpdAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    patientId: '',
    providerId: '',
    scheduledAtLocal: '',
    durationMinutes: '15',
    reason: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<any[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [availabilityDate, setAvailabilityDate] = useState(new Date().toISOString().slice(0, 10));
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilitySlots, setAvailabilitySlots] = useState<any[]>([]);

  useEffect(() => {
    const patientId = searchParams.get('patientId') ?? '';
    const providerId = searchParams.get('providerId') ?? '';
    setForm((f) => ({
      ...f,
      patientId: f.patientId || patientId,
      providerId: f.providerId || providerId,
    }));
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const loadProviders = async () => {
      setProvidersLoading(true);
      try {
        const api = getApiClient(getToken() ?? undefined);
        const { data } = await api.GET('/opd/providers' as any, {
          params: { query: { page: 1, limit: 100, isActive: true } },
        });
        if (!active) return;
        const list = ((data as any)?.data ?? []) as any[];
        setProviders(list);
      } finally {
        if (active) setProvidersLoading(false);
      }
    };
    void loadProviders();
    return () => { active = false; };
  }, []);

  const availableOnly = useMemo(
    () => availabilitySlots.filter((slot: any) => slot.status === 'AVAILABLE'),
    [availabilitySlots],
  );

  const loadAvailability = async () => {
    if (!form.providerId.trim() || !availabilityDate) return;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError, response } = await api.GET('/opd/providers/{providerId}/availability' as any, {
        params: {
          path: { providerId: form.providerId.trim() },
          query: { fromDate: availabilityDate, toDate: availabilityDate, includeBooked: true },
        },
      });
      if (apiError || !data) {
        setAvailabilityError(response?.status === 409 ? 'Invalid availability date range.' : 'Failed to load availability');
        return;
      }
      setAvailabilitySlots((data as any)?.slots ?? []);
    } catch {
      setAvailabilityError('Failed to load availability');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const applySlot = (slot: any) => {
    const dt = new Date(slot.startAt);
    if (Number.isNaN(dt.getTime())) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    setForm((f) => ({
      ...f,
      providerId: slot.providerId ?? f.providerId,
      scheduledAtLocal: local,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const scheduledAt = toIsoLocal(form.scheduledAtLocal);
    if (!form.patientId.trim() || !form.providerId.trim() || !scheduledAt) {
      setError('Patient ID, Provider ID, and a valid schedule date/time are required.');
      return;
    }

    const durationParsed = Number(form.durationMinutes);
    const body: Record<string, unknown> = {
      patientId: form.patientId.trim(),
      providerId: form.providerId.trim(),
      scheduledAt,
    };
    if (Number.isFinite(durationParsed) && durationParsed > 0) body.durationMinutes = durationParsed;
    if (form.reason.trim()) body.reason = form.reason.trim();
    if (form.notes.trim()) body.notes = form.notes.trim();

    setSubmitting(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError, response } = await api.POST('/opd/appointments', {
        body: body as any,
      });
      if (apiError || !data) {
        if (response?.status === 409) setError('Scheduling conflict or provider unavailable for the selected slot.');
        else setError('Failed to create OPD appointment');
        return;
      }
      router.push(`/opd/appointments/${(data as any).id}`);
    } catch {
      setError('Failed to create OPD appointment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opd/worklist" className="text-primary">← OPD Worklist</Link>
      </div>

      <PageHeader title="New OPD Appointment" description="Books a tenant-scoped OPD appointment via SDK" />

      <SectionCard title="Appointment Details">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID</Label>
              <Input
                id="patientId"
                value={form.patientId}
                onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                placeholder="UUID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="providerId">Provider ID</Label>
              <Input
                id="providerId"
                value={form.providerId}
                onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}
                placeholder="UUID"
              />
              <div className="flex items-center gap-2">
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.providerId}
                  onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}
                  disabled={providersLoading}
                >
                  <option value="">Select active provider (optional helper)</option>
                  {providers.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.code ? ` (${p.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledAtLocal">Scheduled At</Label>
              <Input
                id="scheduledAtLocal"
                type="datetime-local"
                value={form.scheduledAtLocal}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAtLocal: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMinutes">Duration (minutes)</Label>
              <Input
                id="durationMinutes"
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              />
            </div>
          </div>

          {form.providerId.trim() ? (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="availabilityDate">Availability Date</Label>
                  <Input id="availabilityDate" type="date" value={availabilityDate} onChange={(e) => setAvailabilityDate(e.target.value)} />
                </div>
                <Button type="button" variant="outline" onClick={() => void loadAvailability()} disabled={availabilityLoading}>
                  {availabilityLoading ? 'Loading slots...' : 'Load Slots'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={`/opd/providers/${form.providerId.trim()}/availability`}>
                    Open Full Availability Page
                  </Link>
                </Button>
              </div>
              {availabilityError ? <p className="text-sm text-destructive">{availabilityError}</p> : null}
              {availabilitySlots.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {availableOnly.length} available of {availabilitySlots.length} slots. Click a slot to fill appointment time.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availabilitySlots.slice(0, 24).map((slot: any) => {
                      const isBooked = slot.status === 'BOOKED';
                      return (
                        <button
                          key={`${slot.scheduleId}-${slot.startAt}`}
                          type="button"
                          disabled={isBooked}
                          onClick={() => applySlot(slot)}
                          className={`rounded-md border px-2 py-1 text-xs ${isBooked ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background hover:bg-muted'}`}
                          title={isBooked ? `Booked (${slot.appointmentId ?? 'n/a'})` : 'Use this slot'}
                        >
                          {new Date(slot.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' '}
                          · {slot.status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
              rows={4}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Appointment'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/opd/worklist">Cancel</Link>
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
