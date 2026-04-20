'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState, PageHeader, SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

type Patient = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  mobile?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
};

type Doctor = {
  id: string;
  displayName: string;
  specialtyName: string;
  consultationFee: number;
  currency: string;
  isActive: boolean;
};

export default function NewOpdEncounterRegistrationPage() {
  const router = useRouter();
  const { flags, loading: flagsLoading } = useFeatureFlags();

  const [mobile, setMobile] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [cnic, setCnic] = useState('');
  const [address, setAddress] = useState('');

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  const [immediatePaymentAmount, setImmediatePaymentAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const opdEnabled = Boolean(flags['module.opd']);
  const doctorMasterEnabled = Boolean(flags['module.opd.doctorProfiles']);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === selectedDoctorId) ?? null,
    [doctors, selectedDoctorId],
  );

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  async function loadDoctors() {
    if (!opdEnabled || !doctorMasterEnabled) return;
    setDoctorsLoading(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data } = await api.GET('/opd/doctors', { params: { query: { page: 1, limit: 100, isActive: true } } });
      setDoctors(((data as any)?.data ?? []) as Doctor[]);
    } finally {
      setDoctorsLoading(false);
    }
  }

  useEffect(() => {
    if (!flagsLoading) void loadDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagsLoading, opdEnabled, doctorMasterEnabled]);

  async function searchPatients() {
    const normalizedMobile = mobile.trim();
    const normalizedSearch = patientSearch.trim();
    if (!normalizedMobile && !normalizedSearch) {
      setPatients([]);
      return;
    }
    setPatientsLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.GET('/patients', {
        params: {
          query: {
            page: 1,
            limit: 20,
            mobile: normalizedMobile || undefined,
            lastName: normalizedSearch || undefined,
          },
        },
      });
      if (apiError) {
        setError('Failed to search patients');
        setPatients([]);
        return;
      }
      setPatients((((data as any)?.data ?? []) as Patient[]) || []);
    } finally {
      setPatientsLoading(false);
    }
  }

  async function ensurePatientId(): Promise<string | null> {
    if (selectedPatientId) return selectedPatientId;
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setError('Select an existing patient or provide first and last name for new patient.');
      return null;
    }
    const api = getApiClient(getToken() ?? undefined);
    const body: Record<string, unknown> = { firstName: first, lastName: last, gender };
    if (mobile.trim()) body.mobile = mobile.trim();
    if (dateOfBirth) body.dateOfBirth = dateOfBirth;
    if (cnic.trim()) body.cnic = cnic.trim();
    if (address.trim()) body.address = address.trim();
    const { data, error: apiError } = await api.POST('/patients', { body: body as any });
    if (apiError || !data) {
      setError('Failed to create patient');
      return null;
    }
    return (data as any).id as string;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedDoctorId) {
      setError('Doctor is required');
      return;
    }
    setSubmitting(true);
    try {
      const patientId = await ensurePatientId();
      if (!patientId) return;
      const api = getApiClient(getToken() ?? undefined);
      const idempotencyKey = `opd-reg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const amount = Number(immediatePaymentAmount || 0);
      const body: Record<string, unknown> = {
        patientId,
        doctorId: selectedDoctorId,
        idempotencyKey,
      };
      if (amount > 0) {
        body.immediatePaymentAmount = amount;
        body.immediatePaymentMethod = 'CASH';
      }
      const { data, error: apiError } = await api.POST('/opd/commands/createRegistration', { body: body as any });
      if (apiError || !data) {
        setError('Failed to create OPD registration');
        return;
      }
      const opdEncounterId = (data as any).opdEncounter?.id as string;
      if (!opdEncounterId) {
        setError('Registration succeeded but encounter id was missing');
        return;
      }
      router.push(`/opd/encounters/${opdEncounterId}/intake`);
    } catch {
      setError('Failed to create OPD registration');
    } finally {
      setSubmitting(false);
    }
  }

  if (!flagsLoading && !opdEnabled) {
    return <ErrorState title="OPD module disabled" message="Enable `module.opd` to create OPD registrations." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New OPD Registration" description="Select or create patient, choose doctor, and create OPD encounter." />

      <SectionCard title="Patient Search">
        <div className="grid gap-3 md:grid-cols-3">
          <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile (e.g. 0300-1234567)" />
          <Input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Last name" />
          <Button type="button" variant="outline" onClick={() => void searchPatients()} disabled={patientsLoading}>
            {patientsLoading ? 'Searching...' : 'Search Patients'}
          </Button>
        </div>
        {patients.length > 0 ? (
          <div className="mt-3">
            <Label>Select Existing Patient</Label>
            <Select
              value={selectedPatientId || '__none__'}
              onValueChange={(value) => setSelectedPatientId(value === '__none__' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose patient (optional if creating new)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Create new patient instead</SelectItem>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.mrn} — {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </SectionCard>

      {!selectedPatient ? (
        <SectionCard title="New Patient (if not selected above)">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>First Name *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div>
              <Label>CNIC</Label>
              <Input value={cnic} onChange={(e) => setCnic(e.target.value)} />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Selected Patient">
          <p className="text-sm text-muted-foreground">
            {selectedPatient.mrn} — {selectedPatient.firstName} {selectedPatient.lastName}
          </p>
        </SectionCard>
      )}

      <SectionCard title="Doctor + Billing">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Doctor *</Label>
              <Select value={selectedDoctorId || '__none__'} onValueChange={(value) => setSelectedDoctorId(value === '__none__' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder={doctorsLoading ? 'Loading doctors...' : 'Select doctor'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select doctor</SelectItem>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.displayName} ({doctor.specialtyName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Immediate Payment Amount (optional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={immediatePaymentAmount}
                onChange={(e) => setImmediatePaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          {selectedDoctor ? (
            <p className="text-sm text-muted-foreground">
              {selectedDoctor.specialtyName} • Fee: {selectedDoctor.currency} {selectedDoctor.consultationFee}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create OPD Registration'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/opd/encounters')}>
              Cancel
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
