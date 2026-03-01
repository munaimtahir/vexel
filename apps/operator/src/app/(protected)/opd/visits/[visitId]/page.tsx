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
import { Textarea } from '@/components/ui/textarea';

function sectionToText(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && typeof value.text === 'string') {
    return value.text;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function textToSection(text: string) {
  const trimmed = text.trim();
  return trimmed ? { text: trimmed } : null;
}

export default function OpdVisitDetailPage() {
  const params = useParams<{ visitId: string }>();
  const visitId = params?.visitId ?? '';

  const [visit, setVisit] = useState<any | null>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [clinicalNote, setClinicalNote] = useState<any | null>(null);
  const [prescription, setPrescription] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const [vitalsEnabled, setVitalsEnabled] = useState(true);
  const [clinicalEnabled, setClinicalEnabled] = useState(true);
  const [prescriptionEnabled, setPrescriptionEnabled] = useState(true);

  const [cancelReason, setCancelReason] = useState('');
  const [vitalsForm, setVitalsForm] = useState({
    heightCm: '',
    weightKg: '',
    temperatureC: '',
    pulseBpm: '',
    systolicBp: '',
    diastolicBp: '',
    respiratoryRate: '',
    spo2Pct: '',
    bloodGlucoseMgDl: '',
    notes: '',
  });
  const [clinicalForm, setClinicalForm] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    diagnosisText: '',
  });
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [prescriptionItemsText, setPrescriptionItemsText] = useState('');

  const loadVitals = useCallback(async () => {
    const api = getApiClient(getToken() ?? undefined);
    const { data, error: apiError, response } = await api.GET('/opd/visits/{visitId}/vitals' as any, {
      params: { path: { visitId } },
    });
    if (response?.status === 403) {
      setVitalsEnabled(false);
      setVitals([]);
      return;
    }
    setVitalsEnabled(true);
    if (apiError || !data) {
      setActionError('Failed to load vitals');
      return;
    }
    setVitals((data as any).data ?? []);
  }, [visitId]);

  const loadClinicalNote = useCallback(async () => {
    const api = getApiClient(getToken() ?? undefined);
    const { data, error: apiError, response } = await api.GET('/opd/visits/{visitId}/clinical-note' as any, {
      params: { path: { visitId } },
    });
    if (response?.status === 403) {
      setClinicalEnabled(false);
      setClinicalNote(null);
      return;
    }
    setClinicalEnabled(true);
    if (response?.status === 404) {
      setClinicalNote(null);
      setClinicalForm({
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
        diagnosisText: '',
      });
      return;
    }
    if (apiError || !data) {
      setActionError('Failed to load clinical note');
      return;
    }
    const note = data as any;
    setClinicalNote(note);
    setClinicalForm({
      subjective: sectionToText(note.subjectiveJson),
      objective: sectionToText(note.objectiveJson),
      assessment: sectionToText(note.assessmentJson),
      plan: sectionToText(note.planJson),
      diagnosisText: note.diagnosisText ?? '',
    });
  }, [visitId]);

  const loadPrescription = useCallback(async () => {
    const api = getApiClient(getToken() ?? undefined);
    const { data, error: apiError, response } = await api.GET('/opd/visits/{visitId}/prescription' as any, {
      params: { path: { visitId } },
    });
    if (response?.status === 403) {
      setPrescriptionEnabled(false);
      setPrescription(null);
      return;
    }
    setPrescriptionEnabled(true);
    if (response?.status === 404) {
      setPrescription(null);
      setPrescriptionNotes('');
      setPrescriptionItemsText('');
      return;
    }
    if (apiError || !data) {
      setActionError('Failed to load prescription');
      return;
    }
    const rx = data as any;
    setPrescription(rx);
    setPrescriptionNotes(rx.notes ?? '');
    setPrescriptionItemsText(
      (rx.items ?? [])
        .map((item: any) => {
          const parts = [
            item.medicationText ?? '',
            item.dosageText ?? '',
            item.frequencyText ?? '',
            item.durationText ?? '',
            item.instructions ?? '',
          ];
          return parts.join(' | ');
        })
        .join('\n'),
    );
  }, [visitId]);

  const load = useCallback(async () => {
    if (!visitId) return;
    setLoading(true);
    setError('');
    setActionError('');
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
      await Promise.all([loadVitals(), loadClinicalNote(), loadPrescription()]);
    } catch {
      setError('Failed to load OPD visit');
    } finally {
      setLoading(false);
    }
  }, [visitId, loadVitals, loadClinicalNote, loadPrescription]);

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
      const status = response?.status;
      if (status === 403) setActionError('Feature disabled or insufficient permissions (403).');
      else if (status === 409) setActionError('Invalid operation in current state (409).');
      else setActionError('Command failed');
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
    await runAction('cancel', async () =>
      postCommand('/opd/visits/{visitId}/cancel', { reason: cancelReason.trim() }),
    );
  };

  const handleRecordVitals = async (e: FormEvent) => {
    e.preventDefault();
    await runAction('record-vitals', async () => {
      const body: Record<string, unknown> = {};
      const numericFields = [
        'heightCm',
        'weightKg',
        'temperatureC',
        'pulseBpm',
        'systolicBp',
        'diastolicBp',
        'respiratoryRate',
        'spo2Pct',
        'bloodGlucoseMgDl',
      ] as const;
      for (const field of numericFields) {
        const raw = vitalsForm[field].trim();
        if (!raw) continue;
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) {
          setActionError(`Invalid number for ${field}.`);
          return false;
        }
        body[field] = parsed;
      }
      if (vitalsForm.notes.trim()) body.notes = vitalsForm.notes.trim();
      const ok = await postCommand('/opd/visits/{visitId}/vitals', body);
      if (ok) {
        setVitalsForm((prev) => ({ ...prev, notes: '' }));
      }
      return ok;
    });
  };

  const handleSaveClinicalNote = async (e: FormEvent) => {
    e.preventDefault();
    await runAction('save-clinical-note', async () => {
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiError, response } = await api.PUT('/opd/visits/{visitId}/clinical-note' as any, {
        params: { path: { visitId } },
        body: {
          providerId: visit?.providerId ?? undefined,
          subjectiveJson: textToSection(clinicalForm.subjective),
          objectiveJson: textToSection(clinicalForm.objective),
          assessmentJson: textToSection(clinicalForm.assessment),
          planJson: textToSection(clinicalForm.plan),
          diagnosisText: clinicalForm.diagnosisText.trim() || null,
        } as any,
      });
      if (apiError) {
        const status = response?.status;
        if (status === 403) setActionError('Clinical note feature is disabled (403).');
        else if (status === 409) setActionError('Clinical note is already signed (409).');
        else setActionError('Failed to save clinical note');
        return false;
      }
      return true;
    });
  };

  const handleSignClinicalNote = async () => {
    await runAction('sign-clinical-note', async () =>
      postCommand('/opd/visits/{visitId}/clinical-note/sign', {}),
    );
  };

  const parsePrescriptionItems = () => {
    return prescriptionItemsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [medicationText, dosageText, frequencyText, durationText, instructions] = line
          .split('|')
          .map((value) => value.trim());
        return {
          medicationText,
          dosageText: dosageText || null,
          frequencyText: frequencyText || null,
          durationText: durationText || null,
          instructions: instructions || null,
        };
      });
  };

  const handleSavePrescription = async (e: FormEvent) => {
    e.preventDefault();
    await runAction('save-prescription', async () => {
      const items = parsePrescriptionItems();
      if (items.some((item) => !item.medicationText)) {
        setActionError('Each prescription line requires medication text.');
        return false;
      }
      const api = getApiClient(getToken() ?? undefined);
      const { error: apiError, response } = await api.PUT('/opd/visits/{visitId}/prescription' as any, {
        params: { path: { visitId } },
        body: {
          providerId: visit?.providerId ?? undefined,
          notes: prescriptionNotes.trim() || null,
          items,
        } as any,
      });
      if (apiError) {
        const status = response?.status;
        if (status === 403) setActionError('Prescription feature is disabled (403).');
        else if (status === 409) setActionError('Prescription is already signed/printed (409).');
        else setActionError('Failed to save prescription');
        return false;
      }
      return true;
    });
  };

  const handleSignPrescription = async () => {
    await runAction('sign-prescription', async () =>
      postCommand('/opd/visits/{visitId}/prescription/sign', {}),
    );
  };

  const handleMarkPrescriptionPrinted = async () => {
    await runAction('mark-prescription-printed', async () =>
      postCommand('/opd/visits/{visitId}/prescription/mark-printed', {}),
    );
  };

  if (loading) return <SkeletonPage />;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!visit) return <p className="text-muted-foreground">Visit not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opd/worklist" className="text-primary">
          ← OPD Worklist
        </Link>
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
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Status:</span> {visit.status}
          </div>
          <div>
            <span className="text-muted-foreground">Visit Number:</span> {visit.visitNumber ?? '—'}
          </div>
          <div>
            <span className="text-muted-foreground">Patient ID:</span>{' '}
            <span className="font-mono text-xs">{visit.patientId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Provider ID:</span>{' '}
            <span className="font-mono text-xs">{visit.providerId ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Appointment ID:</span>{' '}
            <span className="font-mono text-xs">{visit.appointmentId ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Encounter ID:</span>{' '}
            <span className="font-mono text-xs">{visit.encounterId ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Registered:</span>{' '}
            {visit.registeredAt ? new Date(visit.registeredAt).toLocaleString() : '—'}
          </div>
          <div>
            <span className="text-muted-foreground">Updated:</span>{' '}
            {visit.updatedAt ? new Date(visit.updatedAt).toLocaleString() : '—'}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Workflow Commands">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() => runAction('mark-waiting', async () => postCommand('/opd/visits/{visitId}/mark-waiting', {}))}
          >
            {busyAction === 'mark-waiting' ? 'Updating...' : 'Mark Waiting'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() =>
              runAction('start-consultation', async () =>
                postCommand('/opd/visits/{visitId}/start-consultation', {}),
              )
            }
          >
            {busyAction === 'start-consultation' ? 'Starting...' : 'Start Consultation'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busyAction !== ''}
            onClick={() => runAction('complete', async () => postCommand('/opd/visits/{visitId}/complete', {}))}
          >
            {busyAction === 'complete' ? 'Completing...' : 'Complete'}
          </Button>
          {visit.appointmentId ? (
            <Button asChild variant="outline">
              <Link href={`/opd/appointments/${visit.appointmentId}`}>Open Appointment</Link>
            </Button>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Vitals">
        {!vitalsEnabled ? (
          <p className="text-sm text-muted-foreground">opd.vitals feature is disabled for this tenant.</p>
        ) : (
          <div className="space-y-4">
            <form onSubmit={handleRecordVitals} className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="heightCm">Height (cm)</Label>
                <Input id="heightCm" value={vitalsForm.heightCm} onChange={(e) => setVitalsForm((s) => ({ ...s, heightCm: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weightKg">Weight (kg)</Label>
                <Input id="weightKg" value={vitalsForm.weightKg} onChange={(e) => setVitalsForm((s) => ({ ...s, weightKg: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperatureC">Temp (C)</Label>
                <Input id="temperatureC" value={vitalsForm.temperatureC} onChange={(e) => setVitalsForm((s) => ({ ...s, temperatureC: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pulseBpm">Pulse (bpm)</Label>
                <Input id="pulseBpm" value={vitalsForm.pulseBpm} onChange={(e) => setVitalsForm((s) => ({ ...s, pulseBpm: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="systolicBp">Systolic BP</Label>
                <Input id="systolicBp" value={vitalsForm.systolicBp} onChange={(e) => setVitalsForm((s) => ({ ...s, systolicBp: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diastolicBp">Diastolic BP</Label>
                <Input id="diastolicBp" value={vitalsForm.diastolicBp} onChange={(e) => setVitalsForm((s) => ({ ...s, diastolicBp: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="respiratoryRate">Respiratory Rate</Label>
                <Input id="respiratoryRate" value={vitalsForm.respiratoryRate} onChange={(e) => setVitalsForm((s) => ({ ...s, respiratoryRate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spo2Pct">SpO2 %</Label>
                <Input id="spo2Pct" value={vitalsForm.spo2Pct} onChange={(e) => setVitalsForm((s) => ({ ...s, spo2Pct: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bloodGlucoseMgDl">Blood Glucose (mg/dL)</Label>
                <Input id="bloodGlucoseMgDl" value={vitalsForm.bloodGlucoseMgDl} onChange={(e) => setVitalsForm((s) => ({ ...s, bloodGlucoseMgDl: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="vitalsNotes">Notes</Label>
                <Textarea id="vitalsNotes" rows={2} value={vitalsForm.notes} onChange={(e) => setVitalsForm((s) => ({ ...s, notes: e.target.value }))} />
              </div>
              <div className="md:col-span-3">
                <Button type="submit" disabled={busyAction !== ''}>
                  {busyAction === 'record-vitals' ? 'Saving...' : 'Record Vitals'}
                </Button>
              </div>
            </form>
            <div className="space-y-2 text-sm">
              {vitals.length === 0 ? (
                <p className="text-muted-foreground">No vitals recorded yet.</p>
              ) : (
                vitals.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="rounded border p-2">
                    <div className="font-medium">{new Date(entry.recordedAt).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      BP {entry.systolicBp ?? '—'}/{entry.diastolicBp ?? '—'} | Pulse {entry.pulseBpm ?? '—'} | Temp{' '}
                      {entry.temperatureC ?? '—'} | BMI {entry.bmi ?? '—'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Clinical Note">
        {!clinicalEnabled ? (
          <p className="text-sm text-muted-foreground">opd.clinical_note feature is disabled for this tenant.</p>
        ) : (
          <form onSubmit={handleSaveClinicalNote} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subjective">Subjective</Label>
                <Textarea id="subjective" rows={4} value={clinicalForm.subjective} onChange={(e) => setClinicalForm((s) => ({ ...s, subjective: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objective">Objective</Label>
                <Textarea id="objective" rows={4} value={clinicalForm.objective} onChange={(e) => setClinicalForm((s) => ({ ...s, objective: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assessment">Assessment</Label>
                <Textarea id="assessment" rows={4} value={clinicalForm.assessment} onChange={(e) => setClinicalForm((s) => ({ ...s, assessment: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan">Plan</Label>
                <Textarea id="plan" rows={4} value={clinicalForm.plan} onChange={(e) => setClinicalForm((s) => ({ ...s, plan: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="diagnosisText">Diagnosis</Label>
              <Textarea id="diagnosisText" rows={2} value={clinicalForm.diagnosisText} onChange={(e) => setClinicalForm((s) => ({ ...s, diagnosisText: e.target.value }))} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busyAction !== ''}>
                {busyAction === 'save-clinical-note' ? 'Saving...' : 'Save Clinical Note'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyAction !== '' || clinicalNote?.status === 'SIGNED'}
                onClick={() => void handleSignClinicalNote()}
              >
                {busyAction === 'sign-clinical-note'
                  ? 'Signing...'
                  : clinicalNote?.status === 'SIGNED'
                    ? 'Signed'
                    : 'Sign Clinical Note'}
              </Button>
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Prescription">
        {!prescriptionEnabled ? (
          <p className="text-sm text-muted-foreground">
            opd.prescription_free_text feature is disabled for this tenant.
          </p>
        ) : (
          <form onSubmit={handleSavePrescription} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="prescriptionNotes">Prescription Notes</Label>
              <Textarea id="prescriptionNotes" rows={3} value={prescriptionNotes} onChange={(e) => setPrescriptionNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prescriptionItems">
                Medication Lines (medication | dosage | frequency | duration | instructions)
              </Label>
              <Textarea id="prescriptionItems" rows={6} value={prescriptionItemsText} onChange={(e) => setPrescriptionItemsText(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busyAction !== ''}>
                {busyAction === 'save-prescription' ? 'Saving...' : 'Save Prescription'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyAction !== '' || prescription?.status === 'SIGNED' || prescription?.status === 'PRINTED'}
                onClick={() => void handleSignPrescription()}
              >
                {busyAction === 'sign-prescription'
                  ? 'Signing...'
                  : prescription?.status === 'SIGNED' || prescription?.status === 'PRINTED'
                    ? 'Signed'
                    : 'Sign Prescription'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyAction !== '' || prescription?.status !== 'SIGNED'}
                onClick={() => void handleMarkPrescriptionPrinted()}
              >
                {busyAction === 'mark-prescription-printed'
                  ? 'Updating...'
                  : prescription?.status === 'PRINTED'
                    ? 'Printed'
                    : 'Mark Printed'}
              </Button>
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Cancel Visit">
        <form onSubmit={handleCancel} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cancelReason">Cancel reason</Label>
            <Input
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Required"
            />
          </div>
          <Button type="submit" variant="destructive" disabled={busyAction !== ''}>
            {busyAction === 'cancel' ? 'Cancelling...' : 'Cancel Visit'}
          </Button>
        </form>
      </SectionCard>

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
    </div>
  );
}
