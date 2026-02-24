'use client';
import { useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard, DueBadge } from '@/components/app';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type FinancialsData = {
  encounter: {
    id: string;
    encounterCode?: string | null;
    status: string;
    patient: { id: string; firstName: string; lastName: string; mrn: string; mobile: string };
    labOrders: Array<{
      id: string;
      status: string;
      testNameSnapshot?: string | null;
      totalAmount?: number | null;
      discountAmount?: number | null;
      discountPct?: number | null;
      payableAmount?: number | null;
      amountPaid?: number | null;
      dueAmount?: number | null;
    }>;
  };
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    actorUserId: string;
    reason?: string | null;
    createdAt: string;
    actor?: { id: string; firstName: string; lastName: string } | null;
  }>;
};

const TRANSACTION_LABELS: Record<string, string> = {
  PAYMENT: 'Payment',
  DISCOUNT: 'Discount',
  REFUND: 'Refund',
  DUE_RECEIVED: 'Due Received',
  CANCELLATION_REFUND: 'Cancellation Refund',
};

const TRANSACTION_VARIANT: Record<string, string> = {
  PAYMENT: 'success',
  DISCOUNT: 'warning',
  REFUND: 'info',
  DUE_RECEIVED: 'success',
  CANCELLATION_REFUND: 'destructive',
};

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [financials, setFinancials] = useState<FinancialsData | null>(null);

  // Action states
  const [showCollectDue, setShowCollectDue] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectError, setCollectError] = useState('');

  const [showApplyDiscount, setShowApplyDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState('');

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const [actionSuccess, setActionSuccess] = useState('');

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setError('');
    setFinancials(null);
    setActionSuccess('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // Search encounters by encounterCode or patient MRN
      const { data: listData, error: listErr } = await api.GET('/encounters', {
        params: { query: { page: 1, limit: 20 } as any },
      });
      if (listErr || !listData) { setError('Failed to search encounters'); return; }
      const list: any[] = Array.isArray(listData) ? listData : (listData as any)?.data ?? [];
      // Find by encounterCode or patient MRN
      const q = search.trim().toUpperCase();
      const found = list.find((e: any) =>
        e.encounterCode?.toUpperCase() === q ||
        e.patient?.mrn?.toUpperCase() === q ||
        e.id === search.trim()
      );
      if (!found) {
        setError(`No encounter found for "${search.trim()}"`);
        return;
      }
      await loadFinancials(found.id);
    } catch {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const loadFinancials = async (encounterId: string) => {
    const api = getApiClient(getToken() ?? undefined);
    // @ts-ignore
    const { data, error: finErr } = await api.GET('/encounters/{encounterId}/financials', {
      params: { path: { encounterId } },
    });
    if (finErr || !data) {
      setError('Failed to load financials');
      return;
    }
    setFinancials(data as FinancialsData);
  };

  const refreshFinancials = async () => {
    if (financials?.encounter?.id) {
      await loadFinancials(financials.encounter.id);
    }
  };

  const handleCollectDue = async () => {
    if (!financials) return;
    const amount = parseFloat(collectAmount);
    if (!amount || amount <= 0) { setCollectError('Enter a valid amount'); return; }
    setCollectLoading(true);
    setCollectError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data, error: apiErr } = await api.POST('/encounters/{encounterId}:collect-due', {
        params: { path: { encounterId: financials.encounter.id } },
        body: { amount } as any,
      });
      if (apiErr) { setCollectError((apiErr as any)?.message ?? 'Failed to collect due'); return; }
      setActionSuccess(`Collected PKR ${amount.toLocaleString()}`);
      setShowCollectDue(false);
      setCollectAmount('');
      await refreshFinancials();
    } catch {
      setCollectError('Request failed');
    } finally {
      setCollectLoading(false);
    }
  };

  const handleApplyDiscount = async () => {
    if (!financials) return;
    const amt = parseFloat(discountAmount);
    if (!amt || amt <= 0) { setDiscountError('Enter a valid discount amount'); return; }
    if (!discountReason.trim()) { setDiscountError('Reason is required'); return; }
    setDiscountLoading(true);
    setDiscountError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data, error: apiErr } = await api.POST('/encounters/{encounterId}:apply-discount', {
        params: { path: { encounterId: financials.encounter.id } },
        body: { discountAmount: amt, reason: discountReason } as any,
      });
      if (apiErr) { setDiscountError((apiErr as any)?.message ?? 'Failed to apply discount'); return; }
      setActionSuccess(`Discount of PKR ${amt.toLocaleString()} applied`);
      setShowApplyDiscount(false);
      setDiscountAmount('');
      setDiscountReason('');
      await refreshFinancials();
    } catch {
      setDiscountError('Request failed');
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleCancelEncounter = async () => {
    if (!financials) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data, error: apiErr } = await api.POST('/encounters/{encounterId}:cancel', {
        params: { path: { encounterId: financials.encounter.id } },
        body: { reason: cancelReason } as any,
      });
      if (apiErr) { setCancelError((apiErr as any)?.message ?? 'Failed to cancel encounter'); return; }
      setActionSuccess('Encounter cancelled');
      setShowCancelConfirm(false);
      setCancelReason('');
      await refreshFinancials();
    } catch {
      setCancelError('Request failed');
    } finally {
      setCancelLoading(false);
    }
  };

  // Aggregate financials across lab orders
  const totalAmount = financials?.encounter.labOrders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0) ?? 0;
  const discountAmt = financials?.encounter.labOrders.reduce((s, o) => s + (Number(o.discountAmount) || 0), 0) ?? 0;
  const payableAmt = financials?.encounter.labOrders.reduce((s, o) => s + (Number(o.payableAmount) || 0), 0) ?? 0;
  const paidAmt = financials?.encounter.labOrders.reduce((s, o) => s + (Number(o.amountPaid) || 0), 0) ?? 0;
  const dueAmt = financials?.encounter.labOrders.reduce((s, o) => s + (Number(o.dueAmount) || 0), 0) ?? 0;

  const enc = financials?.encounter;
  const isCancelled = enc?.status === 'cancelled';
  const hasDue = dueAmt > 0;

  return (
    <div>
      <PageHeader title="Payments" />

      {/* Search bar */}
      <div className="flex gap-3 mb-6">
        <Input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="Enter encounter code (e.g. VXL-2602-001) or patient MRN"
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm mb-4">
          {error}
        </div>
      )}

      {actionSuccess && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm mb-4">
          ✓ {actionSuccess}
        </div>
      )}

      {financials && enc && (
        <div className="flex flex-col gap-5">
          {/* Patient / encounter card */}
          <SectionCard>
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <div className="text-lg font-bold text-foreground flex items-center gap-2">
                  {enc.patient.firstName} {enc.patient.lastName}
                  {hasDue && !isCancelled && (
                    <DueBadge amount={dueAmt} />
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  MRN: {enc.patient.mrn} &nbsp;·&nbsp; Mobile: {enc.patient.mobile}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-primary text-base">
                  {enc.encounterCode ?? enc.id.slice(0, 8)}
                </div>
                <Badge
                  variant="secondary"
                  className={isCancelled ? 'bg-red-50 text-red-700 mt-1' : 'bg-blue-50 text-blue-700 mt-1'}
                >
                  {enc.status.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
            </div>
          </SectionCard>

          {/* Financial summary */}
          <SectionCard title="Financial Summary">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  {['Total', 'Discount', 'Payable', 'Paid', 'Due'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[totalAmount, discountAmt, payableAmt, paidAmt, dueAmt].map((v, i) => (
                    <td key={i} className={`px-4 py-3 text-right text-base ${i === 4 ? 'font-bold' : 'font-medium'} ${i === 4 && v > 0 ? 'text-destructive' : 'text-foreground'}`}>
                      PKR {v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </SectionCard>

          {/* Action buttons */}
          {!isCancelled && (
            <div className="flex gap-3 flex-wrap">
              {hasDue && (
                <Button
                  onClick={() => { setShowCollectDue(v => !v); setShowApplyDiscount(false); setShowCancelConfirm(false); }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  💵 Collect Due
                </Button>
              )}
              <Button
                onClick={() => { setShowApplyDiscount(v => !v); setShowCollectDue(false); setShowCancelConfirm(false); }}
                className="bg-amber-500 hover:bg-amber-600"
              >
                🏷 Apply Discount
              </Button>
              <Button
                onClick={() => { setShowCancelConfirm(v => !v); setShowCollectDue(false); setShowApplyDiscount(false); }}
                variant="destructive"
              >
                ✕ Cancel Encounter
              </Button>
            </div>
          )}

          {/* Collect Due form */}
          {showCollectDue && (
            <SectionCard className="bg-emerald-50 border-emerald-200">
              <h3 className="text-sm font-bold text-emerald-700 mb-3">Collect Due Payment</h3>
              <div className="flex gap-2.5 items-end flex-wrap">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Amount (PKR)</Label>
                  <Input
                    type="number" min="1" value={collectAmount}
                    onChange={e => setCollectAmount(e.target.value)}
                    placeholder={`Max: ${dueAmt}`}
                    className="w-40"
                  />
                </div>
                <Button onClick={handleCollectDue} disabled={collectLoading} className="bg-emerald-600 hover:bg-emerald-700">
                  {collectLoading ? 'Saving…' : 'Confirm'}
                </Button>
                <Button variant="outline" onClick={() => setShowCollectDue(false)}>Cancel</Button>
              </div>
              {collectError && <p className="mt-2 text-destructive text-sm">{collectError}</p>}
            </SectionCard>
          )}

          {/* Apply Discount form */}
          {showApplyDiscount && (
            <SectionCard className="bg-amber-50 border-amber-200">
              <h3 className="text-sm font-bold text-amber-700 mb-3">Apply Discount</h3>
              <div className="flex flex-col gap-2.5 max-w-sm">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Discount Amount (PKR)</Label>
                  <Input
                    type="number" min="1" value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Reason <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="text" value={discountReason}
                    onChange={e => setDiscountReason(e.target.value)}
                    placeholder="e.g. Staff discount, Senior citizen"
                  />
                </div>
                <div className="flex gap-2.5">
                  <Button onClick={handleApplyDiscount} disabled={discountLoading} className="bg-amber-500 hover:bg-amber-600">
                    {discountLoading ? 'Saving…' : 'Apply'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowApplyDiscount(false)}>Cancel</Button>
                </div>
              </div>
              {discountError && <p className="mt-2 text-destructive text-sm">{discountError}</p>}
            </SectionCard>
          )}

          {/* Cancel confirmation */}
          {showCancelConfirm && (
            <SectionCard className="bg-red-50 border-red-200">
              <h3 className="text-sm font-bold text-red-700 mb-2">Cancel Encounter</h3>
              <p className="text-sm text-muted-foreground mb-3">
                This will cancel the encounter. This action cannot be undone.
              </p>
              <div className="flex flex-col gap-2.5 max-w-sm">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Reason (optional)</Label>
                  <Textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    rows={2}
                    className="border-red-200"
                  />
                </div>
                <div className="flex gap-2.5">
                  <Button onClick={handleCancelEncounter} disabled={cancelLoading} variant="destructive">
                    {cancelLoading ? 'Cancelling…' : 'Confirm Cancel'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>Go Back</Button>
                </div>
              </div>
              {cancelError && <p className="mt-2 text-destructive text-sm">{cancelError}</p>}
            </SectionCard>
          )}

          {/* Transaction history */}
          <SectionCard title="Transaction History">
            {financials.transactions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No transactions recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {financials.transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center px-3.5 py-2.5 bg-muted/30 rounded-md gap-3 flex-wrap">
                    <div>
                      <Badge variant={(TRANSACTION_VARIANT[tx.type] ?? 'secondary') as any} className="mr-2">
                        {TRANSACTION_LABELS[tx.type] ?? tx.type}
                      </Badge>
                      {tx.reason && <span className="text-sm text-muted-foreground">{tx.reason}</span>}
                    </div>
                    <div className="flex gap-5 items-center">
                      {tx.actor && (
                        <span className="text-xs text-muted-foreground">
                          {tx.actor.firstName} {tx.actor.lastName}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                      <span className="font-bold text-sm min-w-24 text-right text-foreground">
                        PKR {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
