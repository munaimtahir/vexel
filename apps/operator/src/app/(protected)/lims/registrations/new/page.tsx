'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const inp: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px',
  fontSize: '14px', width: '100%', boxSizing: 'border-box', outline: 'none',
};
const inpErr: React.CSSProperties = { ...inp, border: '1px solid #ef4444' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 };

type PatientData = { fullName: string; dateOfBirth: string; gender: string; cnic: string; address: string };
type SelectedTest = { id: string; name: string; code: string; price: number | null };
type FieldErrors = Partial<Record<keyof PatientData | 'mobile' | 'tests', string>>;
const EMPTY: PatientData = { fullName: '', dateOfBirth: '', gender: 'male', cnic: '', address: '' };

function dobFromAge(age: string): string {
  const n = parseInt(age, 10);
  if (isNaN(n) || n < 0 || n > 150) return '';
  return `${new Date().getFullYear() - n}-01-01`;
}
function ageFromDob(dob: string): string {
  if (!dob) return '';
  const diff = Date.now() - new Date(dob).getTime();
  return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
}
// Parse mobile string (with or without dash) into [part1, part2]
function parseMobile(m: string): [string, string] {
  const clean = m.replace(/[^0-9]/g, '');
  return [clean.slice(0, 4), clean.slice(4, 11)];
}

export default function NewRegistrationPage() {
  const router = useRouter();

  // Mobile split fields
  const [mob1, setMob1] = useState('');
  const [mob2, setMob2] = useState('');
  const mobileValue = mob1 || mob2 ? `${mob1}-${mob2}` : '';
  const [lookupDone, setLookupDone] = useState(false);

  // Patient
  const [patient, setPatient] = useState<PatientData>(EMPTY);
  const [existingPatient, setExistingPatient] = useState<any>(null);
  const [registeredMRN, setRegisteredMRN] = useState<string | null>(null);
  const [mobileLooking, setMobileLooking] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Patient picker modal
  const [pickerPatients, setPickerPatients] = useState<any[]>([]);
  const [pickerIdx, setPickerIdx] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const displayAge = patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : '';

  // Order
  const [testSearch, setTestSearch] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testDropOpen, setTestDropOpen] = useState(false);
  const [testDropIdx, setTestDropIdx] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payment
  const [discountPKR, setDiscountPKR] = useState('0');
  const [discountPct, setDiscountPct] = useState('0');
  const [paid, setPaid] = useState('0');

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedEncounterId, setSavedEncounterId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [pollingReceipt, setPollingReceipt] = useState(false);

  // ── Field refs for keyboard nav ──────────────────────────────────
  const mob1Ref = useRef<HTMLInputElement>(null);
  const mob2Ref = useRef<HTMLInputElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);
  const genderRef = useRef<HTMLSelectElement>(null);
  const cnicRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const testSearchRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const paidRef = useRef<HTMLInputElement>(null);

  const focusAndSelect = (ref: React.RefObject<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if ('select' in el) (el as HTMLInputElement).select();
  };

  // ── Payment derived ──────────────────────────────────────────────
  const total = selectedTests.reduce((s, t) => s + (t.price ?? 0), 0);
  const discPKRNum = parseFloat(discountPKR) || 0;
  const paidNum = parseFloat(paid) || 0;
  const due = total - discPKRNum - paidNum;

  // ── Mobile lookup → show picker if any matches ──────────────────
  const handleMobileLookup = useCallback(async () => {
    const mobile = mobileValue.replace(/[^0-9]/g, '');
    if (mobile.length < 7) return;
    setMobileLooking(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/patients', { params: { query: { mobile: mobileValue, limit: 20 } } });
      const found: any[] = (data as any)?.data ?? [];
      if (found.length > 0) {
        setPickerPatients(found);
        setPickerIdx(0);
        setTimeout(() => pickerRef.current?.focus(), 50);
      } else {
        setPickerPatients([]);
        setExistingPatient(null);
        setRegisteredMRN(null);
      }
      setLookupDone(true);
    } catch { setExistingPatient(null); setPickerPatients([]); setLookupDone(true); }
    finally { setMobileLooking(false); }
  }, [mobileValue]);

  const selectPickerPatient = (p: any) => {
    setExistingPatient(p);
    setRegisteredMRN(p.mrn);
    const [p1, p2] = parseMobile(p.mobile ?? mobileValue);
    setMob1(p1); setMob2(p2);
    setPatient({
      fullName: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
      dateOfBirth: p.dateOfBirth ?? '',
      gender: p.gender ?? 'male',
      cnic: p.cnic ?? '',
      address: p.address ?? '',
    });
    setPickerPatients([]);
    setTimeout(() => fullNameRef.current?.focus(), 50);
  };

  const closePickerNew = () => {
    setPickerPatients([]);
    setExistingPatient(null);
    setRegisteredMRN(null);
    setTimeout(() => fullNameRef.current?.focus(), 50);
  };

  // ── Field helpers ────────────────────────────────────────────────
  const setField = (k: keyof PatientData, v: string) => {
    setPatient(p => ({ ...p, [k]: v }));
    setFieldErrors(e => ({ ...e, [k]: undefined }));
  };
  const handleAgeInput = (v: string) => { const dob = dobFromAge(v); if (dob) setField('dateOfBirth', dob); };

  // ── Test search ──────────────────────────────────────────────────
  const doTestSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setTestResults([]); setTestDropOpen(false); return; }
    setSearching(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/catalog/tests', { params: { query: { search: q.trim(), limit: 10 } } });
      const list: any[] = (data as any)?.data ?? [];
      setTestResults(list);
      setTestDropOpen(list.length > 0);
      setTestDropIdx(list.length > 0 ? 0 : -1);
    } catch { setTestResults([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doTestSearch(testSearch), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [testSearch, doTestSearch]);

  const addTest = (t: any) => {
    if (selectedTests.some(x => x.id === t.id)) return;
    setSelectedTests(prev => [...prev, { id: t.id, name: t.name, code: t.code ?? '', price: (t as any).price ?? null }]);
    setTestSearch('');
    setTestDropOpen(false);
    setTestDropIdx(-1);
    setFieldErrors(e => ({ ...e, tests: undefined }));
    // Return focus to search so user can add another test immediately
    setTimeout(() => testSearchRef.current?.focus(), 10);
  };
  const removeTest = (id: string) => setSelectedTests(prev => prev.filter(x => x.id !== id));

  const handleTestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setTestDropIdx(i => Math.min(i + 1, testResults.length - 1)); setTestDropOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setTestDropIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (testDropOpen && testDropIdx >= 0 && testResults[testDropIdx]) {
        addTest(testResults[testDropIdx]);
      } else if (testDropOpen && testResults.length === 1) {
        addTest(testResults[0]);
      }
    }
    else if (e.key === 'Tab' && !e.shiftKey) {
      // Tab from test search → discount field
      setTestDropOpen(false);
      e.preventDefault();
      focusAndSelect(discountRef);
    }
    else if (e.key === 'Escape') { setTestDropOpen(false); }
  };

  // ── Payment sync ─────────────────────────────────────────────────
  const handleDiscountPKRChange = (v: string) => {
    setDiscountPKR(v);
    const n = parseFloat(v) || 0;
    setDiscountPct(total > 0 ? String(((n / total) * 100).toFixed(1)) : '0');
    setPaid(String(Math.max(0, total - n)));
  };
  const handleDiscountPctChange = (v: string) => {
    setDiscountPct(v);
    const pkr = ((parseFloat(v) || 0) / 100) * total;
    setDiscountPKR(pkr.toFixed(2));
    setPaid(String(Math.max(0, total - pkr)));
  };
  useEffect(() => {
    setPaid(String(Math.max(0, total - (parseFloat(discountPKR) || 0))));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // ── Validation ───────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!patient.fullName.trim()) errs.fullName = 'Required';
    if (!patient.gender) errs.gender = 'Required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Register Patient (patient only, no order) ────────────────────
  const handleRegisterPatient = async () => {
    if (!validate()) return;
    setSaving(true); setSaveError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      if (existingPatient) { setRegisteredMRN(existingPatient.mrn); return; }
      const parts = patient.fullName.trim().split(/\s+/);
      const body: Record<string, unknown> = {
        firstName: parts[0] || '',
        lastName: parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || '',
        gender: patient.gender,
      };
      if (mobileValue.replace(/[^0-9]/g, '').length >= 4) body.mobile = mobileValue;
      if (patient.dateOfBirth) body.dateOfBirth = patient.dateOfBirth;
      if (patient.cnic.trim()) body.cnic = patient.cnic.trim();
      if (patient.address.trim()) body.address = patient.address.trim();
      const { data: pt, error: ptErr } = await api.POST('/patients', { body: body as any });
      if (ptErr || !pt) { setSaveError((ptErr as any)?.message ?? 'Registration failed'); return; }
      setExistingPatient(pt);
      setRegisteredMRN((pt as any).mrn);
      setTimeout(() => testSearchRef.current?.focus(), 100);
    } finally { setSaving(false); }
  };

  // ── Save & Print ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    if (selectedTests.length === 0) { setSaveError('Add at least one test'); setFieldErrors(e => ({ ...e, tests: 'Add at least one test' })); return; }
    setSaving(true); setSaveError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      let patientId = existingPatient?.id;

      if (!patientId) {
        const parts = patient.fullName.trim().split(/\s+/);
        const body: Record<string, unknown> = {
          firstName: parts[0] || '',
          lastName: parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || '',
          gender: patient.gender,
        };
        if (mobileValue.replace(/[^0-9]/g, '').length >= 4) body.mobile = mobileValue;
        if (patient.dateOfBirth) body.dateOfBirth = patient.dateOfBirth;
        if (patient.cnic.trim()) body.cnic = patient.cnic.trim();
        if (patient.address.trim()) body.address = patient.address.trim();
        const { data: pt, error: ptErr } = await api.POST('/patients', { body: body as any });
        if (ptErr || !pt) { setSaveError((ptErr as any)?.message ?? 'Failed to create patient'); return; }
        patientId = (pt as any).id;
        setExistingPatient(pt);
        setRegisteredMRN((pt as any).mrn);
      }

      const { data: enc, error: encErr } = await api.POST('/encounters', { body: { patientId } as any });
      if (encErr || !enc) { setSaveError('Failed to create encounter'); return; }
      const encounterId = (enc as any).id;

      for (const test of selectedTests) {
        // @ts-ignore
        await api.POST('/encounters/{encounterId}:order-lab', {
          params: { path: { encounterId } },
          body: { testId: test.id, priority: 'routine' } as any,
        });
      }

      // Queue receipt
      try {
        // @ts-ignore
        await api.POST('/documents/receipt:generate', {
          body: {
            receiptNumber: (enc as any).encounterCode ?? encounterId,
            patientName: patient.fullName.trim(),
            patientMrn: existingPatient?.mrn ?? 'Auto',
            issuedAt: new Date().toISOString(),
            items: selectedTests.map(t => ({ description: t.name, quantity: 1, unitPrice: t.price ?? 0, total: t.price ?? 0 })),
            subtotal: total, tax: 0, grandTotal: total,
            sourceRef: encounterId, sourceType: 'encounter',
          } as any,
        });
      } catch { /* best-effort */ }

      // Show success screen immediately
      setSavedEncounterId(encounterId);

      // Poll for receipt PDF in background (up to 30 seconds)
      setPollingReceipt(true);
      (async () => {
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 1500));
          try {
            const { data: docs } = await api.GET('/documents' as any, { params: { query: { sourceRef: encounterId, status: 'PUBLISHED', docType: 'RECEIPT', limit: 1 } } });
            // API returns a plain array
            const items: any[] = Array.isArray(docs) ? docs : ((docs as any)?.items ?? (docs as any)?.data ?? []);
            if (items.length > 0) {
              const { data: dl } = await api.GET('/documents/{id}/download' as any, { params: { path: { id: items[0].id } } });
              const url = (dl as any)?.url;
              if (url) { setReceiptUrl(url); break; }
            }
          } catch { /* keep trying */ }
        }
        setPollingReceipt(false);
      })();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  // ── Reset ────────────────────────────────────────────────────────
  const handleReset = () => {
    setMob1(''); setMob2('');
    setPatient(EMPTY); setExistingPatient(null); setRegisteredMRN(null);
    setPickerPatients([]); setLookupDone(false);
    setFieldErrors({}); setSelectedTests([]);
    setTestSearch(''); setTestResults([]); setTestDropOpen(false);
    setDiscountPKR('0'); setDiscountPct('0'); setPaid('0');
    setSaveError(''); setSavedEncounterId(null); setReceiptUrl(null); setPollingReceipt(false);
    setTimeout(() => mob1Ref.current?.focus(), 50);
  };

  const card: React.CSSProperties = { background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' };
  const sectionTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#64748b', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' };

  // ── Success Banner ────────────────────────────────────────────────
  if (savedEncounterId) {
    return (
      <div style={{ maxWidth: '520px', margin: '48px auto', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>Registration & Order Saved</h2>
        {registeredMRN && (
          <p style={{ margin: '0 0 4px', color: '#64748b', fontSize: '15px' }}>
            MRN: <strong style={{ color: '#1e293b' }}>{registeredMRN}</strong>
          </p>
        )}
        <div style={{ margin: '16px 0 24px', minHeight: '40px' }}>
          {pollingReceipt && !receiptUrl && (
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>⏳ Generating receipt…</p>
          )}
          {receiptUrl && (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', padding: '10px 24px', background: '#0891b2', color: 'white', borderRadius: '6px', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}
            >
              🖨 Download / Print Receipt
            </a>
          )}
          {!pollingReceipt && !receiptUrl && (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>Receipt not ready — check reports later.</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push(`/lims/encounters/${savedEncounterId}`)}
            style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
          >
            Open Encounter →
          </button>
          <button
            onClick={handleReset}
            style={{ padding: '10px 24px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
          >
            + New Patient
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Patient Picker Modal ─────────────────────────────────── */}
      {pickerPatients.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div
            ref={pickerRef}
            tabIndex={-1}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setPickerIdx(i => Math.min(i + 1, pickerPatients.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setPickerIdx(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); selectPickerPatient(pickerPatients[pickerIdx]); }
              else if (e.key === 'Escape') { e.preventDefault(); closePickerNew(); }
            }}
            style={{ background: 'white', borderRadius: '10px', width: '520px', maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', overflow: 'hidden', outline: 'none' }}
          >
            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>
                  {pickerPatients.length} patient{pickerPatients.length > 1 ? 's' : ''} found for <span style={{ fontFamily: 'monospace' }}>{mobileValue}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>↑↓ navigate · Enter select · Esc = new patient</div>
              </div>
              <button onClick={closePickerNew} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
            </div>

            {/* Patient list */}
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {pickerPatients.map((p, i) => {
                const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—';
                const age = p.dateOfBirth ? ageFromDob(p.dateOfBirth) : p.ageYears != null ? String(p.ageYears) : null;
                return (
                  <div
                    key={p.id}
                    onClick={() => selectPickerPatient(p)}
                    style={{ padding: '14px 20px', cursor: 'pointer', background: i === pickerIdx ? '#eff6ff' : 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: i === pickerIdx ? '3px solid #2563eb' : '3px solid transparent' }}
                    onMouseEnter={() => setPickerIdx(i)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>{name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        MRN: <strong>{p.mrn ?? '—'}</strong>
                        {age && ` · ${age}y`}
                        {p.gender && ` · ${p.gender.charAt(0).toUpperCase()}`}
                        {p.cnic && ` · CNIC: ${p.cnic}`}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', background: '#f1f5f9', borderRadius: '4px', padding: '2px 8px' }}>Select</span>
                  </div>
                );
              })}
            </div>

            {/* New registration option */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Not listed? Register a new patient for this number.</span>
              <button
                onClick={closePickerNew}
                style={{ padding: '7px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                + New Registration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>New Registration</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Patient · Order · Payment</p>
      </div>

      {/* SECTION 1 — Patient */}
      <div style={{ ...card, marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={sectionTitle}>Patient Registration</p>
          {registeredMRN && (
            <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: '20px', padding: '3px 14px', fontSize: '12px', fontWeight: 700 }}>
              MRN: {registeredMRN}
            </span>
          )}
          {!registeredMRN && lookupDone && pickerPatients.length === 0 && !mobileLooking && (
            <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: 600 }}>
              New Patient · MRN: Auto-generated
            </span>
          )}
          {mobileLooking && (
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Looking up…</span>
          )}
        </div>

        {/* Mobile — two subfields with visual dash */}
        <div style={{ marginBottom: '16px', maxWidth: '300px' }}>
          <label style={lbl}>Mobile</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <input
              ref={mob1Ref}
              value={mob1}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                setMob1(v);
                setLookupDone(false);
                if (v.length === 4) mob2Ref.current?.focus();
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); mob2Ref.current?.focus(); }
              }}
              placeholder="0300"
              maxLength={4}
              style={{ ...inp, width: '72px', borderRadius: '6px 0 0 6px', borderRight: 'none', textAlign: 'center', letterSpacing: '2px' }}
            />
            <span style={{ padding: '8px 6px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderLeft: 'none', borderRight: 'none', color: '#64748b', fontSize: '16px', lineHeight: 1, userSelect: 'none' }}>-</span>
            <input
              ref={mob2Ref}
              value={mob2}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 7);
                setMob2(v);
                setLookupDone(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Backspace' && mob2 === '') { e.preventDefault(); mob1Ref.current?.focus(); }
                if (e.key === 'Enter') { e.preventDefault(); handleMobileLookup().then(() => focusAndSelect(fullNameRef)); }
              }}
              onBlur={handleMobileLookup}
              placeholder="1234567"
              maxLength={7}
              style={{ ...inp, flex: 1, borderRadius: '0 6px 6px 0', letterSpacing: '1px' }}
            />
          </div>
        </div>

        {/* Full Name */}
        <div style={{ marginBottom: '12px' }}>
          <label style={lbl}>Full Name *</label>
          <input
            ref={fullNameRef}
            value={patient.fullName}
            onChange={e => setField('fullName', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(ageRef); } }}
            placeholder="e.g. Ali Hassan"
            style={fieldErrors.fullName ? inpErr : inp}
          />
          {fieldErrors.fullName && <p style={{ color: '#ef4444', fontSize: '11px', margin: '2px 0 0' }}>{fieldErrors.fullName}</p>}
        </div>

        {/* Age + DOB + Gender + CNIC */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={lbl}>Age (yrs)</label>
            <input
              ref={ageRef}
              type="number" min="0" max="150"
              value={displayAge}
              onChange={e => handleAgeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(dobRef); } }}
              placeholder="yrs"
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>Date of Birth</label>
            <input
              ref={dobRef}
              type="date"
              value={patient.dateOfBirth}
              onChange={e => setField('dateOfBirth', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); genderRef.current?.focus(); } }}
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>Gender *</label>
            <select
              ref={genderRef}
              value={patient.gender}
              onChange={e => setField('gender', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(cnicRef); } }}
              style={{ ...inp, background: 'white' }}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {fieldErrors.gender && <p style={{ color: '#ef4444', fontSize: '11px', margin: '2px 0 0' }}>{fieldErrors.gender}</p>}
          </div>
          <div>
            <label style={lbl}>CNIC</label>
            <input
              ref={cnicRef}
              value={patient.cnic}
              onChange={e => setField('cnic', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addressRef.current?.focus(); } }}
              placeholder="XXXXX-XXXXXXX-X"
              style={inp}
            />
          </div>
        </div>

        {/* Address */}
        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Address</label>
          <textarea
            ref={addressRef}
            value={patient.address}
            onChange={e => setField('address', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); testSearchRef.current?.focus(); } }}
            rows={2}
            placeholder="Press Enter to move to order, Shift+Enter for new line"
            style={{ ...inp, resize: 'vertical' }}
          />
        </div>

        {/* Register Patient button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleRegisterPatient}
            disabled={saving}
            style={{ padding: '8px 20px', background: saving ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px' }}
          >
            {saving ? 'Registering…' : '👤 Register Patient'}
          </button>
          {registeredMRN && (
            <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 600 }}>
              ✓ Registered — MRN: {registeredMRN}
            </span>
          )}
        </div>
      </div>

      {/* SECTION 2+3 — Order + Payment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', marginBottom: '16px' }}>

        {/* SECTION 2 — Order */}
        <div style={card}>
          <p style={sectionTitle}>Order Tests</p>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              ref={testSearchRef}
              value={testSearch}
              onChange={e => setTestSearch(e.target.value)}
              onKeyDown={handleTestKeyDown}
              onBlur={() => setTimeout(() => setTestDropOpen(false), 150)}
              onFocus={() => testResults.length > 0 && setTestDropOpen(true)}
              placeholder="Type test name or code, Enter to add…"
              style={fieldErrors.tests ? inpErr : inp}
            />
            {searching && <span style={{ position: 'absolute', right: '10px', top: '9px', color: '#94a3b8', fontSize: '12px' }}>Searching…</span>}
            {testDropOpen && testResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: '240px', overflowY: 'auto' }}>
                {testResults.map((t, i) => (
                  <div
                    key={t.id}
                    onMouseDown={() => addTest(t)}
                    style={{ padding: '10px 14px', cursor: 'pointer', background: i === testDropIdx ? '#eff6ff' : 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '14px', color: '#1e293b' }}>{t.name}</div>
                      {t.code && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{t.code}</div>}
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{t.price != null ? `PKR ${t.price}` : 'N/A'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {fieldErrors.tests && <p style={{ color: '#ef4444', fontSize: '12px', margin: '-8px 0 8px' }}>{fieldErrors.tests}</p>}

          {selectedTests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 16px', color: '#94a3b8', fontSize: '14px', border: '1px dashed #e2e8f0', borderRadius: '6px' }}>
              Search and add tests · Press <kbd style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '3px', fontSize: '12px' }}>Enter</kbd> to add, <kbd style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '3px', fontSize: '12px' }}>Tab</kbd> for payment
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedTests.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '14px', color: '#1e293b' }}>{t.name}</div>
                    {t.code && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{t.code}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>{t.price != null ? `PKR ${t.price}` : 'N/A'}</span>
                    <button onClick={() => removeTest(t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3 — Payment */}
        <div style={card}>
          <p style={sectionTitle}>Payment</p>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Total (PKR)</label>
            <div style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              {total.toLocaleString()}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Discount</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={discountRef}
                type="number" min="0" value={discountPKR}
                onChange={e => handleDiscountPKRChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(paidRef); } }}
                placeholder="PKR" style={{ ...inp, flex: 2 }}
              />
              <input
                type="number" min="0" max="100" value={discountPct}
                onChange={e => handleDiscountPctChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(paidRef); } }}
                placeholder="%" style={{ ...inp, flex: 1 }}
              />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Paid (PKR)</label>
            <input
              ref={paidRef}
              type="number" min="0" value={paid}
              onChange={e => setPaid(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
              style={inp}
            />
          </div>
          <div style={{ padding: '10px 14px', background: due > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '6px', border: `1px solid ${due > 0 ? '#fecaca' : '#bbf7d0'}` }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Due (PKR)</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: due > 0 ? '#ef4444' : '#15803d' }}>{due.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      {saveError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '8px' }}>{saveError}</p>}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          onClick={handleReset}
          style={{ padding: '10px 24px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#64748b' }}
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '10px 28px', background: saving ? '#94a3b8' : '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px' }}
        >
          {saving ? 'Saving…' : '💾 Save & Print Receipt'}
        </button>
      </div>
    </div>
  );
}
