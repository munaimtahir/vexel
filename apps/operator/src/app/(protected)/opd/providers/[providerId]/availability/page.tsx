'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OpdProviderAvailabilityPage() {
  const params = useParams<{ providerId: string }>();
  const providerId = params?.providerId ?? '';
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [includeBooked, setIncludeBooked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any | null>(null);

  const loadAvailability = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!providerId || !fromDate || !toDate) return;
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError, response } = await api.GET('/opd/providers/{providerId}/availability' as any, {
        params: { path: { providerId }, query: { fromDate, toDate, includeBooked } },
      });
      if (apiError || !data) {
        setError(response?.status === 409 ? 'Invalid date range or missing dates.' : 'Failed to load availability');
        return;
      }
      setResult(data as any);
    } catch {
      setError('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const slots = (result?.slots ?? []) as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opd/worklist" className="text-primary">← OPD Worklist</Link>
      </div>

      <PageHeader
        title="Provider Availability"
        description={`Provider ${providerId}`}
        actions={
          <Button variant="outline" onClick={() => void loadAvailability()} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Slots'}
          </Button>
        }
      />

      <SectionCard title="Lookup">
        <form onSubmit={loadAvailability} className="grid gap-4 md:grid-cols-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="fromDate">From</Label>
            <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="toDate">To</Label>
            <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input type="checkbox" checked={includeBooked} onChange={(e) => setIncludeBooked(e.target.checked)} />
            Include booked slots
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? 'Loading...' : 'Load Availability'}
          </Button>
        </form>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </SectionCard>

      <SectionCard title="Results">
        {!result ? (
          <p className="text-sm text-muted-foreground">Run availability lookup to view slots.</p>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              Provider: <span className="font-medium text-foreground">{result.provider?.name ?? providerId}</span>
              {' · '}
              Range: {result.fromDate} to {result.toDate}
              {' · '}
              Slots: {slots.length}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2">End</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Schedule</th>
                    <th className="px-3 py-2">Appointment</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.length === 0 ? (
                    <tr><td className="px-3 py-4 text-muted-foreground" colSpan={5}>No slots found.</td></tr>
                  ) : slots.map((slot) => (
                    <tr key={`${slot.startAt}-${slot.scheduleId}`} className="border-b">
                      <td className="px-3 py-2">{slot.startAt ? new Date(slot.startAt).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2">{slot.endAt ? new Date(slot.endAt).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2">{slot.status}</td>
                      <td className="px-3 py-2"><code>{slot.scheduleId ?? '—'}</code></td>
                      <td className="px-3 py-2"><code>{slot.appointmentId ?? '—'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
