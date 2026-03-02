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
import { DataTable, type DataTableColumn } from '@vexel/ui-system';

function currencyLine(invoice: any, amount: number) {
  return `${invoice?.currency ?? 'PKR'} ${amount ?? 0}`;
}

export default function OpdInvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params?.invoiceId ?? '';

  const [invoice, setInvoice] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const [issueNote, setIssueNote] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'CASH',
    referenceNo: '',
    note: '',
    paidAt: '',
  });

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.GET('/opd/billing/invoices/{invoiceId}' as any, {
        params: { path: { invoiceId } },
      });
      if (apiError || !data) {
        setError('Failed to load invoice');
        return;
      }
      setInvoice(data as any);
    } catch {
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  const loadPayments = useCallback(async () => {
    if (!invoiceId) return;
    setLoadingPayments(true);
    setActionError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError } = await api.GET('/opd/billing/invoices/{invoiceId}/payments' as any, {
        params: { path: { invoiceId } },
      });
      if (apiError || !data) {
        setActionError('Failed to load invoice payments');
        return;
      }
      setPayments((data as any)?.data ?? []);
    } catch {
      setActionError('Failed to load invoice payments');
    } finally {
      setLoadingPayments(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void loadInvoice();
    void loadPayments();
  }, [loadInvoice, loadPayments]);

  const runCommand = async (name: string, fn: () => Promise<boolean>) => {
    setBusyAction(name);
    setActionError('');
    try {
      const ok = await fn();
      if (ok) {
        await loadInvoice();
        await loadPayments();
      }
    } finally {
      setBusyAction('');
    }
  };

  const postCommand = async (path: string, body?: Record<string, unknown>) => {
    const api = getApiClient(getToken() ?? undefined);
    const { error: apiError, response } = await api.POST(path as any, {
      params: { path: { invoiceId } },
      body: body as any,
    });
    if (apiError) {
      setActionError(response?.status === 409 ? 'Invalid invoice transition or billing invariant (409).' : 'Billing command failed');
      return false;
    }
    return true;
  };

  const handleIssue = async (e: FormEvent) => {
    e.preventDefault();
    await runCommand('issue', async () => postCommand('/opd/billing/invoices/{invoiceId}/issue', issueNote.trim() ? { note: issueNote.trim() } : {}));
  };

  const handleVoid = async (e: FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      setActionError('Void reason is required.');
      return;
    }
    await runCommand('void', async () => postCommand('/opd/billing/invoices/{invoiceId}/void', { reason: voidReason.trim() }));
  };

  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentForm.amount);
    if (!(amount > 0)) {
      setActionError('Valid payment amount is required.');
      return;
    }
    const body: any = { amount, method: paymentForm.method || 'CASH' };
    if (paymentForm.referenceNo.trim()) body.referenceNo = paymentForm.referenceNo.trim();
    if (paymentForm.note.trim()) body.note = paymentForm.note.trim();
    if (paymentForm.paidAt) {
      const dt = new Date(paymentForm.paidAt);
      if (Number.isNaN(dt.getTime())) {
        setActionError('Invalid paidAt date/time.');
        return;
      }
      body.paidAt = dt.toISOString();
    }
    await runCommand('record-payment', async () => {
      const api = getApiClient(getToken() ?? undefined);
      const { data, error: apiError, response } = await api.POST('/opd/billing/invoices/{invoiceId}/payments' as any, {
        params: { path: { invoiceId } },
        body,
      });
      if (apiError || !data) {
        setActionError(response?.status === 409 ? 'Invalid payment command (409).' : 'Failed to record payment');
        return false;
      }
      setPaymentForm({ amount: '', method: 'CASH', referenceNo: '', note: '', paidAt: '' });
      return true;
    });
  };

  if (loading) return <SkeletonPage />;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!invoice) return <p className="text-muted-foreground">Invoice not found.</p>;
  const canIssue = invoice.status === 'DRAFT';
  const canRecordPayment = invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID';
  const canVoid = invoice.status !== 'VOID' && Number(invoice.paidTotal ?? 0) <= 0;
  const canGenerateReceipt = ['ISSUED', 'PARTIALLY_PAID', 'PAID'].includes(invoice.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opd/billing" className="text-primary">← OPD Billing</Link>
      </div>

      <PageHeader
        title="OPD Invoice"
        description={invoice.invoiceNumber ?? invoice.id}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void runCommand('generate-receipt', async () =>
                  postCommand('/opd/billing/invoices/{invoiceId}/receipt', {}),
                );
              }}
              disabled={busyAction !== '' || !canGenerateReceipt}
            >
              {busyAction === 'generate-receipt' ? 'Generating…' : 'Generate Receipt PDF'}
            </Button>
            <Button variant="outline" onClick={() => { void loadInvoice(); void loadPayments(); }} disabled={busyAction !== '' || loadingPayments}>
              Refresh
            </Button>
          </div>
        }
      />

      <SectionCard title="Summary">
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">Status:</span> {invoice.status}</div>
          <div><span className="text-muted-foreground">Invoice #:</span> {invoice.invoiceNumber ?? '—'}</div>
          <div><span className="text-muted-foreground">Patient ID:</span> <code>{invoice.patientId}</code></div>
          <div><span className="text-muted-foreground">Visit ID:</span> <code>{invoice.visitId ?? '—'}</code></div>
          <div><span className="text-muted-foreground">Appointment ID:</span> <code>{invoice.appointmentId ?? '—'}</code></div>
          <div><span className="text-muted-foreground">Created:</span> {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : '—'}</div>
          <div><span className="text-muted-foreground">Total:</span> {currencyLine(invoice, invoice.grandTotal)}</div>
          <div><span className="text-muted-foreground">Paid:</span> {currencyLine(invoice, invoice.paidTotal)}</div>
          <div><span className="text-muted-foreground">Balance:</span> {currencyLine(invoice, invoice.balanceDue)}</div>
          <div><span className="text-muted-foreground">Issued:</span> {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString() : '—'}</div>
          <div><span className="text-muted-foreground">Voided:</span> {invoice.voidedAt ? new Date(invoice.voidedAt).toLocaleString() : '—'}</div>
          <div><span className="text-muted-foreground">Void Reason:</span> {invoice.voidReason ?? '—'}</div>
          <div><span className="text-muted-foreground">Receipt Document:</span> {invoice.receiptDocumentId ?? '—'}</div>
        </div>
        {invoice.receiptDocumentId ? (
          <div className="mt-3">
            <Button asChild size="sm" variant="outline">
              <Link href={`/documents/${invoice.receiptDocumentId}/download`} target="_blank">
                Download Receipt PDF
              </Link>
            </Button>
          </div>
        ) : null}
        <div className="mt-4 grid gap-2 md:grid-cols-3 text-xs">
          <div className={`rounded-md border px-3 py-2 ${canIssue ? 'bg-[hsl(var(--status-success-bg))]' : 'bg-muted/30'}`}>
            Issue command: {canIssue ? 'Available (DRAFT only)' : 'Not available in current status'}
          </div>
          <div className={`rounded-md border px-3 py-2 ${canRecordPayment ? 'bg-[hsl(var(--status-success-bg))]' : 'bg-muted/30'}`}>
            Record payment: {canRecordPayment ? 'Available (ISSUED / PARTIALLY_PAID)' : 'Not available in current status'}
          </div>
          <div className={`rounded-md border px-3 py-2 ${canVoid ? 'bg-[hsl(var(--status-success-bg))]' : 'bg-muted/30'}`}>
            Void command: {canVoid ? 'Available (unpaid invoices only)' : 'Blocked (voided or paid)'}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Invoice Lines">
        <DataTable
          columns={[
            { key: 'description', header: 'Description', cell: (line) => line.description ?? '—' },
            { key: 'quantity', header: 'Qty', cell: (line) => line.quantity ?? 0, numeric: true },
            { key: 'unitPrice', header: 'Unit Price', cell: (line) => line.unitPrice ?? 0, numeric: true },
            { key: 'discountAmount', header: 'Discount', cell: (line) => line.discountAmount ?? 0, numeric: true },
            { key: 'total', header: 'Total', cell: (line) => line.total ?? 0, numeric: true },
          ] as DataTableColumn<any>[]}
          data={invoice.lines ?? []}
          keyExtractor={(line) => line.id ?? `${line.description ?? 'line'}-${line.total ?? 0}`}
          emptyMessage="No lines"
        />
      </SectionCard>

      <SectionCard title="Payments (GET /payments)">
        <div className="mb-3">
          <Button variant="outline" size="sm" onClick={() => void loadPayments()} disabled={loadingPayments || busyAction !== ''}>
            {loadingPayments ? 'Loading...' : 'Refresh Payments'}
          </Button>
        </div>
        <DataTable
          columns={[
            { key: 'paidAt', header: 'Paid At', cell: (p) => (p.paidAt ? new Date(p.paidAt).toLocaleString() : '—') },
            { key: 'amount', header: 'Amount', cell: (p) => currencyLine(invoice, p.amount) },
            { key: 'method', header: 'Method', cell: (p) => p.method ?? '—' },
            { key: 'referenceNo', header: 'Reference', cell: (p) => p.referenceNo ?? '—' },
            { key: 'note', header: 'Note', cell: (p) => p.note ?? '—' },
          ] as DataTableColumn<any>[]}
          data={payments}
          keyExtractor={(p) => p.id}
          emptyMessage="No posted payments"
        />
      </SectionCard>

      <SectionCard title="Issue Invoice">
        <form onSubmit={handleIssue} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="issueNote">Note (optional)</Label>
            <Textarea id="issueNote" value={issueNote} onChange={(e) => setIssueNote(e.target.value)} rows={3} />
          </div>
          <Button type="submit" disabled={busyAction !== '' || !canIssue}>
            {busyAction === 'issue' ? 'Issuing...' : 'Issue Invoice'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Record Payment">
        <form onSubmit={handleRecordPayment} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input id="amount" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Method</Label>
              <Input id="method" value={paymentForm.method} onChange={(e) => setPaymentForm((s) => ({ ...s, method: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referenceNo">Reference No</Label>
              <Input id="referenceNo" value={paymentForm.referenceNo} onChange={(e) => setPaymentForm((s) => ({ ...s, referenceNo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidAt">Paid At</Label>
              <Input id="paidAt" type="datetime-local" value={paymentForm.paidAt} onChange={(e) => setPaymentForm((s) => ({ ...s, paidAt: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentNote">Note</Label>
            <Textarea id="paymentNote" rows={3} value={paymentForm.note} onChange={(e) => setPaymentForm((s) => ({ ...s, note: e.target.value }))} />
          </div>
          <Button type="submit" disabled={busyAction !== '' || !canRecordPayment}>
            {busyAction === 'record-payment' ? 'Recording...' : 'Record Payment'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Void Invoice">
        <form onSubmit={handleVoid} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="voidReason">Reason *</Label>
            <Input id="voidReason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Required" />
          </div>
          <Button type="submit" variant="destructive" disabled={busyAction !== '' || !canVoid}>
            {busyAction === 'void' ? 'Voiding...' : 'Void Invoice'}
          </Button>
        </form>
      </SectionCard>

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
    </div>
  );
}
