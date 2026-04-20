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

type EncounterDetail = {
  id: string;
  status: 'DRAFT' | 'READY_FOR_PRINT' | 'COMPLETED' | 'CANCELLED';
  visitCode: string;
  chiefComplaint?: string | null;
};

export default function OpdIntakePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const encounterId = params.id;

  const [encounter, setEncounter] = useState<EncounterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperatureC, setTemperatureC] = useState('');
  const [respRate, setRespRate] = useState('');
  const [spo2, setSpo2] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');

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
          setError('Failed to load encounter');
          return;
        }
        const detail = data as any;
        setEncounter(detail);
        setChiefComplaint(detail.chiefComplaint ?? '');
      } catch {
        if (active) setError('Failed to load encounter');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [encounterId]);

  const blocked = useMemo(() => encounter && encounter.status !== 'DRAFT', [encounter]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const body: Record<string, unknown> = {
        opdEncounterId: encounterId,
        idempotencyKey: `opd-intake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        chiefComplaint: chiefComplaint.trim(),
      };
      if (bpSystolic) body.bpSystolic = Number(bpSystolic);
      if (bpDiastolic) body.bpDiastolic = Number(bpDiastolic);
      if (pulse) body.pulse = Number(pulse);
      if (temperatureC) body.temperatureC = Number(temperatureC);
      if (respRate) body.respRate = Number(respRate);
      if (spo2) body.spo2 = Number(spo2);
      if (weightKg) body.weightKg = Number(weightKg);
      if (heightCm) body.heightCm = Number(heightCm);
      const { error: apiError } = await api.POST('/opd/commands/recordIntake', { body: body as any });
      if (apiError) {
        setError('Failed to record intake');
        return;
      }
      router.push(`/opd/encounters/${encounterId}/doctor`);
    } catch {
      setError('Failed to record intake');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="OPD Intake" description="Capture vitals and major complaint." />
      {loading ? <SkeletonPage /> : null}
      {!loading && error ? <ErrorState title="Unable to continue intake" message={error} /> : null}
      {!loading && encounter ? (
        <>
          <SectionCard title="Encounter">
            <p className="text-sm text-muted-foreground">
              Visit: <span className="font-semibold text-foreground">{encounter.visitCode}</span> • Status: {encounter.status}
            </p>
          </SectionCard>
          <SectionCard title="Intake">
            {blocked ? (
              <ErrorState title="Intake is locked" message="Only DRAFT encounters can record intake." />
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <Label>Major/Chief Complaint *</Label>
                  <Textarea value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} rows={3} />
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div><Label>BP Systolic</Label><Input type="number" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} /></div>
                  <div><Label>BP Diastolic</Label><Input type="number" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} /></div>
                  <div><Label>Pulse</Label><Input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)} /></div>
                  <div><Label>Temperature C</Label><Input type="number" step="0.1" value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} /></div>
                  <div><Label>Resp Rate</Label><Input type="number" value={respRate} onChange={(e) => setRespRate(e.target.value)} /></div>
                  <div><Label>SpO2</Label><Input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} /></div>
                  <div><Label>Weight Kg</Label><Input type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /></div>
                  <div><Label>Height Cm</Label><Input type="number" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} /></div>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Intake'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push('/opd/encounters')}>
                    Back
                  </Button>
                </div>
              </form>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
