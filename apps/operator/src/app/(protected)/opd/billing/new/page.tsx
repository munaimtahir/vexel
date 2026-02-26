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
import { Textarea } from '@/components/ui/textarea';

type Line = { description: string; quantity: string; unitPrice: string; discountAmount: string };

export default function NewOpdInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [patientId, setPatientId] = useState('');
  const [visitId, setVisitId] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lines, setLines] = useState<Line[]>([
    { description: '', quantity: '1', unitPrice: '', discountAmount: '0' },
  ]);

  useEffect(() => {
    const visitIdParam = searchParams.get('visitId') ?? '';
    const appointmentIdParam = searchParams.get('appointmentId') ?? '';
    const patientIdParam = searchParams.get('patientId') ?? '';
    if (visitIdParam) setVisitId((v) => v || visitIdParam);
    if (appointmentIdParam) setAppointmentId((v) => v || appointmentIdParam);
    if (patientIdParam) setPatientId((v) => v || patientIdParam);
  }, [searchParams]);

  const setLine = (index: number, key: keyof Line, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, { description: '', quantity: '1', unitPrice: '', discountAmount: '0' }]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!patientId.trim()) {
      setError('Patient ID is required.');
      return;
    }
    const payloadLines = lines
      .map((line) => ({
        description: line.description.trim(),
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        discountAmount: Number(line.discountAmount || 0),
      }))
      .filter((l) => l.description && Number.isFinite(l.quantity) && Number.isFinite(l.unitPrice) && Number.isFinite(l.discountAmount));
    if (payloadLines.length === 0) {
      setError('At least one valid invoice line is required.');
      return;
    }

    setSubmitting(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      const body: any = {
        patientId: patientId.trim(),
        currency: currency.trim() || 'PKR',
        lines: payloadLines,
      };
      if (visitId.trim()) body.visitId = visitId.trim();
      if (appointmentId.trim()) body.appointmentId = appointmentId.trim();
      const { data, error: apiError, response } = await api.POST('/opd/billing/invoices' as any, { body });
      if (apiError || !data) {
        setError(response?.status === 409 ? 'Invoice creation conflict (check patient/visit linkage).' : 'Failed to create invoice');
        return;
      }
      router.push(`/opd/billing/invoices/${(data as any).id}`);
    } catch {
      setError('Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opd/billing" className="text-primary">← OPD Billing</Link>
      </div>

      <PageHeader title="New OPD Invoice" description="Create invoice draft (OPD billing)" />

      <SectionCard title="Invoice Header">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID *</Label>
              <Input id="patientId" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="UUID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitId">Visit ID</Label>
              <Input id="visitId" value={visitId} onChange={(e) => setVisitId(e.target.value)} placeholder="Optional UUID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentId">Appointment ID</Label>
              <Input id="appointmentId" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} placeholder="Optional UUID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>

          {(visitId || appointmentId) ? (
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              Prefill context:
              {visitId ? <span className="ml-2">Visit <code>{visitId}</code></span> : null}
              {appointmentId ? <span className="ml-2">Appointment <code>{appointmentId}</code></span> : null}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Invoice Lines</h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>Add Line</Button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="rounded-lg border p-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Description</Label>
                    <Input value={line.description} onChange={(e) => setLine(index, 'description', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Qty</Label>
                    <Input type="number" min={0} step="1" value={line.quantity} onChange={(e) => setLine(index, 'quantity', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input type="number" min={0} step="0.01" value={line.unitPrice} onChange={(e) => setLine(index, 'unitPrice', e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4 items-end">
                  <div className="space-y-2">
                    <Label>Discount</Label>
                    <Input type="number" min={0} step="0.01" value={line.discountAmount} onChange={(e) => setLine(index, 'discountAmount', e.target.value)} />
                  </div>
                  <div className="md:col-span-3 flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => removeLine(index)} disabled={lines.length === 1}>
                      Remove Line
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Invoice Draft'}</Button>
            <Button type="button" variant="outline" asChild><Link href="/opd/billing">Cancel</Link></Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
