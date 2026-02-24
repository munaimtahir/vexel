'use client';
import { useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

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

const TRANSACTION_COLORS: Record<string, string> = {
  PAYMENT: '#16a34a',
  DISCOUNT: '#d97706',
  REFUND: '#2563eb',
  DUE_RECEIVED: '#16a34a',
  CANCELLATION_REFUND: '#dc2626',
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
      <h1 style={{ margin: '0 0 24px', fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>Payments</h1>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="Enter encounter code (e.g. VXL-2602-001) or patient MRN"
          style={{
            flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '6px',
            fontSize: '14px', outline: 'none',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none',
            borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {actionSuccess && (
        <div style={{ padding: '12px 16px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '6px', color: '#065f46', marginBottom: '16px', fontSize: '14px' }}>
          ✓ {actionSuccess}
        </div>
      )}

      {financials && enc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Patient / encounter card */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                  {enc.patient.firstName} {enc.patient.lastName}
                  {hasDue && !isCancelled && (
                    <span style={{ marginLeft: '10px', padding: '2px 10px', background: '#fee2e2', color: '#dc2626', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                      DUE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  MRN: {enc.patient.mrn} &nbsp;·&nbsp; Mobile: {enc.patient.mobile}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', fontSize: '15px' }}>
                  {enc.encounterCode ?? enc.id.slice(0, 8)}
                </div>
                <div style={{
                  marginTop: '4px', padding: '3px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, display: 'inline-block',
                  background: isCancelled ? '#fee2e2' : '#dbeafe', color: isCancelled ? '#dc2626' : '#1d4ed8',
                }}>
                  {enc.status.replace(/_/g, ' ').toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Financial summary */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Financial Summary</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Total', 'Discount', 'Payable', 'Paid', 'Due'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[totalAmount, discountAmt, payableAmt, paidAmt, dueAmt].map((v, i) => (
                    <td key={i} style={{
                      padding: '12px 16px', textAlign: 'right', fontWeight: i === 4 ? 700 : 500,
                      color: i === 4 && v > 0 ? '#dc2626' : '#1e293b', fontSize: '15px',
                    }}>
                      PKR {v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          {!isCancelled && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {hasDue && (
                <button
                  onClick={() => { setShowCollectDue(v => !v); setShowApplyDiscount(false); setShowCancelConfirm(false); }}
                  style={{ padding: '10px 18px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  💵 Collect Due
                </button>
              )}
              <button
                onClick={() => { setShowApplyDiscount(v => !v); setShowCollectDue(false); setShowCancelConfirm(false); }}
                style={{ padding: '10px 18px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                🏷 Apply Discount
              </button>
              <button
                onClick={() => { setShowCancelConfirm(v => !v); setShowCollectDue(false); setShowApplyDiscount(false); }}
                style={{ padding: '10px 18px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                ✕ Cancel Encounter
              </button>
            </div>
          )}

          {/* Collect Due form */}
          {showCollectDue && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#15803d' }}>Collect Due Payment</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Amount (PKR)</label>
                  <input
                    type="number" min="1" value={collectAmount}
                    onChange={e => setCollectAmount(e.target.value)}
                    placeholder={`Max: ${dueAmt}`}
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '160px' }}
                  />
                </div>
                <button
                  onClick={handleCollectDue} disabled={collectLoading}
                  style={{ marginTop: '20px', padding: '8px 18px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: collectLoading ? 'not-allowed' : 'pointer', opacity: collectLoading ? 0.7 : 1 }}
                >
                  {collectLoading ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowCollectDue(false)}
                  style={{ marginTop: '20px', padding: '8px 16px', background: 'transparent', color: '#64748b', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
              {collectError && <p style={{ margin: '8px 0 0', color: '#dc2626', fontSize: '13px' }}>{collectError}</p>}
            </div>
          )}

          {/* Apply Discount form */}
          {showApplyDiscount && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#b45309' }}>Apply Discount</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Discount Amount (PKR)</label>
                  <input
                    type="number" min="1" value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Reason <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="text" value={discountReason}
                    onChange={e => setDiscountReason(e.target.value)}
                    placeholder="e.g. Staff discount, Senior citizen"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleApplyDiscount} disabled={discountLoading}
                    style={{ padding: '8px 18px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: discountLoading ? 'not-allowed' : 'pointer', opacity: discountLoading ? 0.7 : 1 }}
                  >
                    {discountLoading ? 'Saving…' : 'Apply'}
                  </button>
                  <button
                    onClick={() => setShowApplyDiscount(false)}
                    style={{ padding: '8px 16px', background: 'transparent', color: '#64748b', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
              {discountError && <p style={{ margin: '8px 0 0', color: '#dc2626', fontSize: '13px' }}>{discountError}</p>}
            </div>
          )}

          {/* Cancel confirmation */}
          {showCancelConfirm && (
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#be123c' }}>Cancel Encounter</h3>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b' }}>
                This will cancel the encounter. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>Reason (optional)</label>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleCancelEncounter} disabled={cancelLoading}
                    style={{ padding: '8px 18px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: cancelLoading ? 'not-allowed' : 'pointer', opacity: cancelLoading ? 0.7 : 1 }}
                  >
                    {cancelLoading ? 'Cancelling…' : 'Confirm Cancel'}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    style={{ padding: '8px 16px', background: 'transparent', color: '#64748b', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
                  >
                    Go Back
                  </button>
                </div>
              </div>
              {cancelError && <p style={{ margin: '8px 0 0', color: '#dc2626', fontSize: '13px' }}>{cancelError}</p>}
            </div>
          )}

          {/* Transaction history */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Transaction History</h2>
            {financials.transactions.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>No transactions recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {financials.transactions.map(tx => (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '6px', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                        background: `${TRANSACTION_COLORS[tx.type] ?? '#94a3b8'}22`,
                        color: TRANSACTION_COLORS[tx.type] ?? '#64748b',
                        marginRight: '8px',
                      }}>
                        {TRANSACTION_LABELS[tx.type] ?? tx.type}
                      </span>
                      {tx.reason && <span style={{ fontSize: '13px', color: '#64748b' }}>{tx.reason}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                      {tx.actor && (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {tx.actor.firstName} {tx.actor.lastName}
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                      <span style={{ fontWeight: 700, color: TRANSACTION_COLORS[tx.type] ?? '#1e293b', fontSize: '14px', minWidth: '100px', textAlign: 'right' }}>
                        PKR {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
