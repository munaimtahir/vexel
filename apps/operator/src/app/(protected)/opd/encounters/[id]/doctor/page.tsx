'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ErrorState, PageHeader, SectionCard, SkeletonPage } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

type RxItem = {
  drugName: string;
  genericName: string;
  strength: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
};

type Encounter = {
  id: string;
  visitCode: string;
  status: 'DRAFT' | 'READY_FOR_PRINT' | 'COMPLETED' | 'CANCELLED';
  chiefComplaint?: string | null;
  vitals?: Array<{
    bpSystolic?: number | null;
    bpDiastolic?: number | null;
    pulse?: number | null;
    temperatureC?: number | null;
    respRate?: number | null;
    spo2?: number | null;
    weightKg?: number | null;
    heightCm?: number | null;
    bmi?: number | null;
  }>;
};

const emptyItem: RxItem = {
  drugName: '',
  genericName: '',
  strength: '',
  dose: '',
  frequency: '',
  duration: '',
  route: '',
  instructions: '',
};

export default function OpdDoctorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const encounterId = params.id;
  const { flags, loading: flagsLoading } = useFeatureFlags();

  const [loading, setLoading] = useState(true);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);

  const [historyNotes, setHistoryNotes] = useState('');
  const [examNotes, setExamNotes] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [advice, setAdvice] = useState('');
  const [items, setItems] = useState<RxItem[]>([{ ...emptyItem }]);

  const prescriptionEnabled = Boolean(flags['module.opd.prescription']);
  const immediatePrint = Boolean(flags['opd.immediate_print_after_publish']);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const api = getApiClient(getToken() ?? undefined);
        const { data, error: apiError } = await api.GET('/opd/encounters/{encounterId}', {
          params: { path: { encounterId } },
        });
        if (!active) return;
        if (apiError || !data) {
          setError('Failed to load OPD encounter');
          return;
        }
        setEncounter(data as any);
      } catch {
        if (active) setError('Failed to load OPD encounter');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [encounterId]);

  const latestVitals = useMemo(() => (encounter?.vitals?.[0] ?? null), [encounter]);

  function updateItem(index: number, patch: Partial<RxItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function openDocument(docId: string) {
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.GET('/opd/encounters/{encounterId}/prescription/file', {
        params: { path: { encounterId } },
        parseAs: 'blob',
      } as any);
      if (apiError || !data) {
        setError('Prescription published, but file download failed');
        return;
      }
      const url = URL.createObjectURL(data as Blob);
      if (immediatePrint) window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setDocumentId(docId);
    } catch {
      setError('Prescription published, but file download failed');
    }
  }

  async function handlePublish(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const prescriptionItems = items
        .map((item) => ({
          drugName: item.drugName.trim(),
          genericName: item.genericName.trim() || null,
          strength: item.strength.trim() || null,
          dose: item.dose.trim() || null,
          frequency: item.frequency.trim() || null,
          duration: item.duration.trim() || null,
          route: item.route.trim() || null,
          instructions: item.instructions.trim() || null,
        }))
        .filter((item) => item.drugName);
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.POST('/opd/commands/publishPrescription', {
        body: {
          opdEncounterId: encounterId,
          idempotencyKey: `opd-publish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          historyNotes: historyNotes.trim(),
          examNotes: examNotes.trim(),
          assessment: assessment.trim(),
          plan: plan.trim(),
          advice: advice.trim(),
          prescriptionItems,
        } as any,
      });
      if (apiError || !data) {
        setError('Failed to publish prescription');
        return;
      }
      const docId = (data as any).documentId as string;
      if (docId) await openDocument(docId);
      setEncounter((prev) => (prev ? { ...prev, status: 'COMPLETED' } : prev));
    } catch {
      setError('Failed to publish prescription');
    } finally {
      setSubmitting(false);
    }
  }

  if (!flagsLoading && !prescriptionEnabled) {
    return <ErrorState title="Prescription workflow disabled" message="Enable `module.opd.prescription` to continue." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Doctor Notes & Prescription" description="Finalize clinical content and publish official OPD prescription." />
      {loading ? <SkeletonPage /> : null}
      {!loading && error ? <ErrorState title="Unable to continue" message={error} /> : null}
      {!loading && encounter ? (
        <>
          <SectionCard title="Encounter Summary">
            <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <p>
                Visit: <span className="font-semibold text-foreground">{encounter.visitCode}</span>
              </p>
              <p>Status: {encounter.status}</p>
              <p className="md:col-span-2">Chief complaint: {encounter.chiefComplaint || '—'}</p>
              {latestVitals ? (
                <p className="md:col-span-2">
                  Vitals: BP {latestVitals.bpSystolic || '—'}/{latestVitals.bpDiastolic || '—'}, Pulse {latestVitals.pulse || '—'}, Temp {latestVitals.temperatureC || '—'}C, SpO2 {latestVitals.spo2 || '—'}%
                </p>
              ) : (
                <p className="md:col-span-2">Vitals: not recorded</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Clinical Content">
            {encounter.status !== 'READY_FOR_PRINT' ? (
              <ErrorState title="Doctor publish is locked" message="Encounter must be READY_FOR_PRINT before publish." />
            ) : (
              <form className="space-y-4" onSubmit={handlePublish}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><Label>History Notes *</Label><Textarea rows={4} value={historyNotes} onChange={(e) => setHistoryNotes(e.target.value)} /></div>
                  <div><Label>Examination Notes *</Label><Textarea rows={4} value={examNotes} onChange={(e) => setExamNotes(e.target.value)} /></div>
                  <div><Label>Assessment *</Label><Textarea rows={4} value={assessment} onChange={(e) => setAssessment(e.target.value)} /></div>
                  <div><Label>Plan *</Label><Textarea rows={4} value={plan} onChange={(e) => setPlan(e.target.value)} /></div>
                </div>
                <div>
                  <Label>Advice *</Label>
                  <Textarea rows={3} value={advice} onChange={(e) => setAdvice(e.target.value)} />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Prescription Items *</Label>
                    <Button type="button" variant="outline" onClick={addItem}>Add Item</Button>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="rounded-md border border-border p-3">
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="md:col-span-2"><Label>Drug Name *</Label><Input value={item.drugName} onChange={(e) => updateItem(idx, { drugName: e.target.value })} /></div>
                        <div><Label>Generic</Label><Input value={item.genericName} onChange={(e) => updateItem(idx, { genericName: e.target.value })} /></div>
                        <div><Label>Strength</Label><Input value={item.strength} onChange={(e) => updateItem(idx, { strength: e.target.value })} /></div>
                        <div><Label>Dose</Label><Input value={item.dose} onChange={(e) => updateItem(idx, { dose: e.target.value })} /></div>
                        <div><Label>Frequency</Label><Input value={item.frequency} onChange={(e) => updateItem(idx, { frequency: e.target.value })} /></div>
                        <div><Label>Duration</Label><Input value={item.duration} onChange={(e) => updateItem(idx, { duration: e.target.value })} /></div>
                        <div><Label>Route</Label><Input value={item.route} onChange={(e) => updateItem(idx, { route: e.target.value })} /></div>
                        <div className="md:col-span-4"><Label>Instructions</Label><Textarea rows={2} value={item.instructions} onChange={(e) => updateItem(idx, { instructions: e.target.value })} /></div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button type="button" size="sm" variant="outline" onClick={() => removeItem(idx)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Publishing...' : 'Publish Prescription'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push('/opd/encounters')}>
                    Back
                  </Button>
                </div>
                {documentId ? (
                  <p className="text-sm text-muted-foreground">
                    Published document: <span className="font-mono">{documentId}</span>
                  </p>
                ) : null}
              </form>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
