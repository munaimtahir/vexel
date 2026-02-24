'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
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
