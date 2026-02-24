'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { DataTable, EmptyState, PageHeader, SectionCard, SkeletonPage } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LIMIT = 20;

type AppointmentStatus = '' | 'BOOKED' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
type VisitStatus = '' | 'REGISTERED' | 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED';

const APPOINTMENT_STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: '', label: 'All appointments' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'CHECKED_IN', label: 'Checked In' },
  { value: 'IN_CONSULTATION', label: 'In Consultation' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NO_SHOW', label: 'No Show' },
];

const VISIT_STATUS_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: '', label: 'All visits' },
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'IN_CONSULTATION', label: 'In Consultation' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function OpdWorklistPage() {
  const [search, setSearch] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState<AppointmentStatus>('');
  const [visitStatus, setVisitStatus] = useState<VisitStatus>('');

  const [appointments, setAppointments] = useState<any[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState('');
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [appointmentsHasMore, setAppointmentsHasMore] = useState(false);

  const [visits, setVisits] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState('');
  const [visitsPage, setVisitsPage] = useState(1);
  const [visitsHasMore, setVisitsHasMore] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAppointments = async () => {
      setAppointmentsLoading(true);
      setAppointmentsError('');
      try {
        const api = getApiClient(getToken() ?? undefined);
        const query: Record<string, unknown> = { page: appointmentsPage, limit: LIMIT };
        if (search.trim()) query.search = search.trim();
        if (appointmentStatus) query.status = appointmentStatus;
        const { data, error } = await api.GET('/opd/appointments', { params: { query } });
        if (!active) return;
        if (error || !data) {
          setAppointmentsError('Failed to load OPD appointments');
          return;
        }
        const rows = (data as any)?.data ?? [];
        const total = (data as any)?.pagination?.total ?? rows.length;
        setAppointments(rows);
        setAppointmentsHasMore(appointmentsPage * LIMIT < total);
      } catch {
        if (active) setAppointmentsError('Failed to load OPD appointments');
      } finally {
        if (active) setAppointmentsLoading(false);
      }
    };
    loadAppointments();
    return () => {
      active = false;
    };
  }, [appointmentsPage, appointmentStatus, search]);

  useEffect(() => {
    let active = true;
    const loadVisits = async () => {
      setVisitsLoading(true);
      setVisitsError('');
      try {
        const api = getApiClient(getToken() ?? undefined);
        const query: Record<string, unknown> = { page: visitsPage, limit: LIMIT };
        if (search.trim()) query.search = search.trim();
        if (visitStatus) query.status = visitStatus;
        const { data, error } = await api.GET('/opd/visits', { params: { query } });
        if (!active) return;
        if (error || !data) {
          setVisitsError('Failed to load OPD visits');
          return;
        }
        const rows = (data as any)?.data ?? [];
        const total = (data as any)?.pagination?.total ?? rows.length;
        setVisits(rows);
        setVisitsHasMore(visitsPage * LIMIT < total);
      } catch {
        if (active) setVisitsError('Failed to load OPD visits');
      } finally {
        if (active) setVisitsLoading(false);
      }
    };
    loadVisits();
    return () => {
      active = false;
    };
  }, [visitsPage, visitStatus, search]);

  const resetPagination = () => {
    setAppointmentsPage(1);
    setVisitsPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="OPD Worklist"
        description="Appointments and visits (tenant-scoped via backend APIs)"
        actions={
          <Button asChild>
            <Link href="/opd/appointments/new">New Appointment</Link>
          </Button>
        }
      />

      <SectionCard title="Filters">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPagination();
            }}
            placeholder="Search patient/name/ID"
          />
          <Select
            value={appointmentStatus || '__all__'}
            onValueChange={(value) => {
              setAppointmentStatus(value === '__all__' ? '' : (value as AppointmentStatus));
              setAppointmentsPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Appointment status" />
            </SelectTrigger>
            <SelectContent>
              {APPOINTMENT_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.label} value={opt.value || '__all__'}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={visitStatus || '__all__'}
            onValueChange={(value) => {
              setVisitStatus(value === '__all__' ? '' : (value as VisitStatus));
              setVisitsPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Visit status" />
            </SelectTrigger>
            <SelectContent>
              {VISIT_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.label} value={opt.value || '__all__'}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      <SectionCard title="Appointments">
        {appointmentsLoading ? (
          <SkeletonPage />
        ) : appointmentsError ? (
          <p className="text-sm text-destructive">{appointmentsError}</p>
        ) : appointments.length === 0 ? (
          <EmptyState title="No appointments found" />
        ) : (
          <>
            <DataTable
              data={appointments}
              keyExtractor={(row: any) => row.id}
              columns={[
                {
                  key: 'scheduledAt',
                  header: 'Scheduled',
                  cell: (row: any) => row.scheduledAt ? new Date(row.scheduledAt).toLocaleString() : '—',
                },
                {
                  key: 'patientId',
                  header: 'Patient',
                  cell: (row: any) => <span className="font-mono text-xs">{row.patientId ?? '—'}</span>,
                },
                {
                  key: 'providerId',
                  header: 'Provider',
                  cell: (row: any) => <span className="font-mono text-xs">{row.providerId ?? '—'}</span>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (row: any) => <span className="text-sm">{row.status ?? '—'}</span>,
                },
                {
                  key: 'action',
                  header: 'Action',
                  cell: (row: any) => (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/opd/appointments/${row.id}`}>Open</Link>
                    </Button>
                  ),
                },
              ]}
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button variant="outline" disabled={appointmentsPage <= 1} onClick={() => setAppointmentsPage((p) => p - 1)}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">Page {appointmentsPage}</span>
              <Button variant="outline" disabled={!appointmentsHasMore} onClick={() => setAppointmentsPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Visits">
        {visitsLoading ? (
          <SkeletonPage />
        ) : visitsError ? (
          <p className="text-sm text-destructive">{visitsError}</p>
        ) : visits.length === 0 ? (
          <EmptyState title="No visits found" />
        ) : (
          <>
            <DataTable
              data={visits}
              keyExtractor={(row: any) => row.id}
              columns={[
                {
                  key: 'createdAt',
                  header: 'Created',
                  cell: (row: any) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '—',
                },
                {
                  key: 'visitNumber',
                  header: 'Visit',
                  cell: (row: any) => row.visitNumber ?? row.id?.slice(0, 8) ?? '—',
                },
                {
                  key: 'patientId',
                  header: 'Patient',
                  cell: (row: any) => <span className="font-mono text-xs">{row.patientId ?? '—'}</span>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (row: any) => row.status ?? '—',
                },
                {
                  key: 'action',
                  header: 'Action',
                  cell: (row: any) => (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/opd/visits/${row.id}`}>Open</Link>
                    </Button>
                  ),
                },
              ]}
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button variant="outline" disabled={visitsPage <= 1} onClick={() => setVisitsPage((p) => p - 1)}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">Page {visitsPage}</span>
              <Button variant="outline" disabled={!visitsHasMore} onClick={() => setVisitsPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
