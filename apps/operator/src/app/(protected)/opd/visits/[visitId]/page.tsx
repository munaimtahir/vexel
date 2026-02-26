'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard, SkeletonPage } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OpdVisitDetailPage() {
  const params = useParams<{ visitId: string }>();
  const visitId = params?.visitId ?? '';

  const [visit, setVisit] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    if (!visitId) return;
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.GET('/opd/visits/{visitId}', {
        params: { path: { visitId } },
      });
      if (apiError || !data) {
        setError('Failed to load OPD visit');
        return;
      }
      setVisit(data as any);
    } catch {
      setError('Failed to load OPD visit');
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const postCommand = async (path: string, body?: Record<string, unknown>) => {
    const api = getApiClient(getToken() ?? undefined);
    const { error: apiError, response } = await api.POST(path as any, {
      params: { path: { visitId } },
      body: body as any,
    });
    if (apiError) {
      setActionError(response?.status === 409 ? 'Invalid visit transition (409).' : 'Command failed');
      return false;
    }
    return true;
  };

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

  const handleCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setActionError('Cancel reason is required.');
      return;
    }
    await runAction('cancel', async () => postCommand('/opd/visits/{visitId}:cancel', { reason: cancelReason.trim() }));
  };

  if (loading) return <SkeletonPage />;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!visit) return <p className="text-muted-foreground">Visit not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opd/worklist" className="text-primary">← OPD Worklist</Link>
      </div>

      <PageHeader
        title="OPD Visit"
        description={visit.id}
        actions={
          <Button asChild variant="outline">
            <Link href={`/opd/billing?visitId=${visit.id}`}>Billing</Link>
          </Button>
        }
      />

      <SectionCard title="Summary">
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">Status:</span> {visit.status}</div>
          <div><span className="text-muted-foreground">Visit Number:</span> {visit.visitNumber ?? '—'}</div>
          <div><span className="text-muted-foreground">Patient ID:</span> <span className="font-mono text-xs">{visit.patientId}</span></div>
          <div><span className="text-muted-foreground">Provider ID:</span> <span className="font-mono text-xs">{visit.providerId ?? '—'}</span></div>
          <div><span className="text-muted-foreground">Appointment ID:</span> <span className="font-mono text-xs">{visit.appointmentId ?? '—'}</span></div>
          <div><span className="text-muted-foreground">Encounter ID:</span> <span className="font-mono text-xs">{visit.encounterId ?? '—'}</span></div>
          <div><span className="text-muted-foreground">Registered:</span> {visit.registeredAt ? new Date(visit.registeredAt).toLocaleString() : '—'}</div>
          <div><span className="text-muted-foreground">Updated:</span> {visit.updatedAt ? new Date(visit.updatedAt).toLocaleString() : '—'}</div>
        </div>
      </SectionCard>

      <SectionCard title="Workflow Commands">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() => runAction('mark-waiting', async () => postCommand('/opd/visits/{visitId}:mark-waiting', {}))}
          >
            {busyAction === 'mark-waiting' ? 'Updating...' : 'Mark Waiting'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() => runAction('start-consultation', async () => postCommand('/opd/visits/{visitId}:start-consultation', {}))}
          >
            {busyAction === 'start-consultation' ? 'Starting...' : 'Start Consultation'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() => runAction('complete', async () => postCommand('/opd/visits/{visitId}:complete', {}))}
          >
            {busyAction === 'complete' ? 'Completing...' : 'Complete'}
          </Button>
          {visit.appointmentId ? (
            <Button asChild variant="outline">
              <Link href={`/opd/appointments/${visit.appointmentId}`}>Open Appointment</Link>
            </Button>
          ) : null}
        </div>
        {actionError ? <p className="mt-3 text-sm text-destructive">{actionError}</p> : null}
      </SectionCard>

      <SectionCard title="Cancel Visit">
        <form onSubmit={handleCancel} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cancelReason">Cancel reason</Label>
            <Input id="cancelReason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Required" />
          </div>
          <Button type="submit" variant="destructive" disabled={busyAction !== ''}>
            {busyAction === 'cancel' ? 'Cancelling...' : 'Cancel Visit'}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
