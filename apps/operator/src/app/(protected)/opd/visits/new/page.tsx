'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NewOpdVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [patientId, setPatientId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [providers, setProviders] = useState<any[]>([]);

  useEffect(() => {
    setPatientId(searchParams.get('patientId') ?? '');
    setAppointmentId(searchParams.get('appointmentId') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/opd/providers' as any, { params: { query: { limit: 100, isActive: true } } }).then(({ data }) => {
      setProviders((data as any)?.data ?? []);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!patientId.trim()) {
      setError('Patient ID is required.');
      return;
    }
    setSubmitting(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const body: any = { patientId: patientId.trim() };
      if (providerId) body.providerId = providerId;
      if (appointmentId.trim()) body.appointmentId = appointmentId.trim();
      if (chiefComplaint.trim()) body.chiefComplaint = chiefComplaint.trim();

      const { data, error: apiError, response } = await api.POST('/opd/visits' as any, { body });
      if (apiError || !data) {
        setError(
          response?.status === 409
            ? 'Visit conflict — check if patient already has an active visit.'
            : 'Failed to create visit',
        );
        return;
      }
      router.push(`/opd/visits/${(data as any).id}`);
    } catch {
      setError('Failed to create visit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opd/worklist" className="text-primary">
          ← OPD Worklist
        </Link>
      </div>

      <PageHeader title="New OPD Visit" description="Register a walk-in patient visit" />

      <SectionCard title="Visit Details">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID *</Label>
              <Input
                id="patientId"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="Patient UUID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="providerId">Provider</Label>
              <Select value={providerId || '__none__'} onValueChange={(v) => setProviderId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No provider</SelectItem>
                  {providers.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.specialty ? `(${p.specialty})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentId">Appointment ID</Label>
              <Input
                id="appointmentId"
                value={appointmentId}
                onChange={(e) => setAppointmentId(e.target.value)}
                placeholder="Optional — links to existing appointment"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chiefComplaint">Chief Complaint</Label>
              <Input
                id="chiefComplaint"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="Brief presenting complaint"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Visit'}
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
