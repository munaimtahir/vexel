'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard, SkeletonPage } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function toLocalDateTimeInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoLocal(value: string): string | null {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export default function OpdAppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? '';

  const [appointment, setAppointment] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const [rescheduleAt, setRescheduleAt] = useState('');
  const [rescheduleDuration, setRescheduleDuration] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [visitForm, setVisitForm] = useState({
    encounterId: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.GET('/opd/appointments/{appointmentId}', {
        params: { path: { appointmentId: id } },
      });
      if (apiError || !data) {
        setError('Failed to load appointment');
        return;
      }
      const next = data as any;
      setAppointment(next);
      setRescheduleAt(toLocalDateTimeInputValue(next.scheduledAt));
      setRescheduleDuration(next.durationMinutes != null ? String(next.durationMinutes) : '');
      setRescheduleReason(next.reason ?? '');
    } catch {
      setError('Failed to load appointment');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (label: string, fn: () => Promise<boolean>) => {
    setActionError('');
    setBusyAction(label);
    try {
      const ok = await fn();
      if (ok) await load();
    } finally {
      setBusyAction('');
    }
  };

  const postCommand = async (path: string, body?: Record<string, unknown>) => {
    const api = getApiClient(getToken() ?? undefined);
    const { error: apiError, response } = await api.POST(path as any, {
      params: { path: { appointmentId: id } },
      body: body as any,
    });
    if (apiError) {
      setActionError(response?.status === 409 ? 'Invalid appointment transition (409).' : 'Command failed');
      return false;
    }
    return true;
  };

  const handleReschedule = async (e: FormEvent) => {
    e.preventDefault();
    const scheduledAt = toIsoLocal(rescheduleAt);
    if (!scheduledAt) {
      setActionError('Valid reschedule date/time is required.');
      return;
    }
    const durationParsed = Number(rescheduleDuration);
    const body: Record<string, unknown> = { scheduledAt };
    if (Number.isFinite(durationParsed) && durationParsed > 0) body.durationMinutes = durationParsed;
    if (rescheduleReason.trim()) body.reason = rescheduleReason.trim();
    await runAction('reschedule', async () => postCommand('/opd/appointments/{appointmentId}:reschedule', body));
  };

  const handleCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setActionError('Cancel reason is required.');
      return;
    }
    await runAction('cancel', async () => postCommand('/opd/appointments/{appointmentId}:cancel', { reason: cancelReason.trim() }));
  };

  const handleCreateVisit = async (e: FormEvent) => {
    e.preventDefault();
    if (!appointment?.patientId) {
      setActionError('Appointment patientId is missing.');
      return;
    }
    setActionError('');
    setBusyAction('create-visit');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const body: Record<string, unknown> = {
        patientId: appointment.patientId,
        appointmentId: appointment.id,
      };
      if (appointment.providerId) body.providerId = appointment.providerId;
      if (visitForm.encounterId.trim()) body.encounterId = visitForm.encounterId.trim();
      if (visitForm.notes.trim()) body.notes = visitForm.notes.trim();

      const { data, error: apiError, response } = await api.POST('/opd/visits', {
        body: body as any,
      });
      if (apiError || !data) {
        setActionError(response?.status === 409 ? 'Visit creation conflict (409).' : 'Failed to create visit');
        return;
      }
      const visitId = (data as any).id;
      await load();
      if (visitId) router.push(`/opd/visits/${visitId}`);
    } catch {
      setActionError('Failed to create visit');
    } finally {
      setBusyAction('');
    }
  };

  if (loading) return <SkeletonPage />;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!appointment) return <p className="text-muted-foreground">Appointment not found.</p>;

  const canShowCreateVisit = !appointment.visitId && appointment.status !== 'CANCELLED' && appointment.status !== 'NO_SHOW';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opd/worklist" className="text-primary">← OPD Worklist</Link>
      </div>

      <PageHeader
        title="OPD Appointment"
        description={appointment.id}
        actions={
          appointment.visitId ? (
            <Button asChild variant="outline">
              <Link href={`/opd/visits/${appointment.visitId}`}>Open Visit</Link>
            </Button>
          ) : undefined
        }
      />

      <SectionCard title="Summary">
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">Status:</span> {appointment.status}</div>
          <div><span className="text-muted-foreground">Scheduled:</span> {appointment.scheduledAt ? new Date(appointment.scheduledAt).toLocaleString() : '—'}</div>
          <div><span className="text-muted-foreground">Patient ID:</span> <span className="font-mono text-xs">{appointment.patientId}</span></div>
          <div><span className="text-muted-foreground">Provider ID:</span> <span className="font-mono text-xs">{appointment.providerId}</span></div>
          <div><span className="text-muted-foreground">Visit ID:</span> <span className="font-mono text-xs">{appointment.visitId ?? '—'}</span></div>
          <div><span className="text-muted-foreground">Encounter ID:</span> <span className="font-mono text-xs">{appointment.encounterId ?? '—'}</span></div>
        </div>
        {appointment.reason ? <p className="mt-3 text-sm"><span className="text-muted-foreground">Reason:</span> {appointment.reason}</p> : null}
        {appointment.notes ? <p className="mt-1 text-sm"><span className="text-muted-foreground">Notes:</span> {appointment.notes}</p> : null}
      </SectionCard>

      <SectionCard title="Workflow Commands">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() => runAction('check-in', async () => postCommand('/opd/appointments/{appointmentId}:check-in', {}))}
          >
            {busyAction === 'check-in' ? 'Checking in...' : 'Check In'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() => runAction('start-consultation', async () => postCommand('/opd/appointments/{appointmentId}:start-consultation', {}))}
          >
            {busyAction === 'start-consultation' ? 'Starting...' : 'Start Consultation'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() => runAction('complete', async () => postCommand('/opd/appointments/{appointmentId}:complete', appointment.visitId ? { visitId: appointment.visitId } : {}))}
          >
            {busyAction === 'complete' ? 'Completing...' : 'Complete'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() => runAction('mark-no-show', async () => postCommand('/opd/appointments/{appointmentId}:mark-no-show', {}))}
          >
            {busyAction === 'mark-no-show' ? 'Marking...' : 'Mark No-show'}
          </Button>
        </div>
        {actionError ? <p className="mt-3 text-sm text-destructive">{actionError}</p> : null}
      </SectionCard>

      <SectionCard title="Reschedule Appointment">
        <form onSubmit={handleReschedule} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rescheduleAt">Scheduled At</Label>
              <Input id="rescheduleAt" type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rescheduleDuration">Duration (minutes)</Label>
              <Input id="rescheduleDuration" type="number" min={1} value={rescheduleDuration} onChange={(e) => setRescheduleDuration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rescheduleReason">Reason</Label>
              <Input id="rescheduleReason" value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div>
            <Button type="submit" disabled={busyAction !== ''}>
              {busyAction === 'reschedule' ? 'Rescheduling...' : 'Reschedule'}
            </Button>
          </div>
        </form>
      </SectionCard>

      {canShowCreateVisit ? (
        <SectionCard title="Create Visit From Appointment">
          <form onSubmit={handleCreateVisit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visitEncounterId">Encounter ID (optional)</Label>
                <Input
                  id="visitEncounterId"
                  value={visitForm.encounterId}
                  onChange={(e) => setVisitForm((f) => ({ ...f, encounterId: e.target.value }))}
                  placeholder="Optional linkage"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitNotes">Notes (optional)</Label>
                <Textarea
                  id="visitNotes"
                  rows={3}
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <Button type="submit" disabled={busyAction !== ''}>
              {busyAction === 'create-visit' ? 'Creating Visit...' : 'Create Visit'}
            </Button>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Cancel Appointment">
        <form onSubmit={handleCancel} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cancelReason">Cancel reason</Label>
            <Input id="cancelReason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Required" />
          </div>
          <Button type="submit" variant="destructive" disabled={busyAction !== ''}>
            {busyAction === 'cancel' ? 'Cancelling...' : 'Cancel Appointment'}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
