'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

const inp: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};
const inpErr: React.CSSProperties = { ...inp, border: '1px solid #ef4444' };
const label: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 };

type PatientData = {
  mobile: string; firstName: string; lastName: string;
  age: string; dateOfBirth: string; gender: string; cnic: string; address: string;
};

type SelectedTest = { id: string; name: string; code: string; price: number | null };

type FieldErrors = Partial<Record<keyof PatientData, string>>;

const EMPTY_PATIENT: PatientData = { mobile: '', firstName: '', lastName: '', age: '', dateOfBirth: '', gender: 'male', cnic: '', address: '' };

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

export default function NewRegistrationPage() {
  // Patient state
  const [patient, setPatient] = useState<PatientData>(EMPTY_PATIENT);
  const [existingPatient, setExistingPatient] = useState<any>(null);
  const [mobileLooking, setMobileLooking] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Order state
  const [testSearch, setTestSearch] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testDropOpen, setTestDropOpen] = useState(false);
  const [testDropIdx, setTestDropIdx] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payment state
  const [discountPKR, setDiscountPKR] = useState('0');
  const [discountPct, setDiscountPct] = useState('0');
  const [paid, setPaid] = useState('0');

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedEncounterId, setSavedEncounterId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  // ── derived payment ──────────────────────────────────────────────
  const total = selectedTests.reduce((s, t) => s + (t.price ?? 0), 0);
  const discPKRNum = parseFloat(discountPKR) || 0;
  const paidNum = parseFloat(paid) || 0;
  const due = total - discPKRNum - paidNum;

  // ── mobile lookup ────────────────────────────────────────────────
  const handleMobileBlur = async () => {
    const mobile = patient.mobile.trim();
    if (mobile.length < 7) return;
    setMobileLooking(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/patients', { params: { query: { mobile, limit: 1 } } });
      const found = ((data as any)?.data ?? [])[0];
      if (found) {
        setExistingPatient(found);
        setPatient({
          mobile: found.mobile ?? mobile,
          firstName: found.firstName ?? '',
          lastName: found.lastName ?? '',
          age: found.ageYears != null ? String(found.ageYears) : (found.dateOfBirth ? ageFromDob(found.dateOfBirth) : ''),
          dateOfBirth: found.dateOfBirth ?? '',
          gender: found.gender ?? 'male',
          cnic: found.cnic ?? '',
          address: found.address ?? '',
        });
      } else {
        setExistingPatient(null);
      }
    } catch {
      setExistingPatient(null);
    } finally {
      setMobileLooking(false);
    }
  };

  // ── field change handlers ────────────────────────────────────────
  const setField = (k: keyof PatientData, v: string) => {
    setPatient(p => ({ ...p, [k]: v }));
    setFieldErrors(e => ({ ...e, [k]: undefined }));
  };

  const handleAgeChange = (v: string) => {
    setField('age', v);
    const dob = dobFromAge(v);
    if (dob) setField('dateOfBirth', dob);
  };
  const handleDobChange = (v: string) => {
    setField('dateOfBirth', v);
    setField('age', ageFromDob(v));
  };

  // ── test search (debounced) ──────────────────────────────────────
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
      setTestDropIdx(-1);
    } catch {
      setTestResults([]);
    } finally {
      setSearching(false);
    }
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
  };
  const removeTest = (id: string) => setSelectedTests(prev => prev.filter(x => x.id !== id));

  const handleTestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!testDropOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setTestDropIdx(i => Math.min(i + 1, testResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setTestDropIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (testDropIdx >= 0 && testResults[testDropIdx]) addTest(testResults[testDropIdx]); }
    else if (e.key === 'Escape') { setTestDropOpen(false); }
  };

  // ── payment sync ─────────────────────────────────────────────────
  const handleDiscountPKRChange = (v: string) => {
    setDiscountPKR(v);
    const n = parseFloat(v) || 0;
    setDiscountPct(total > 0 ? String(((n / total) * 100).toFixed(1)) : '0');
    const newPaid = Math.max(0, total - n);
    setPaid(String(newPaid));
  };
  const handleDiscountPctChange = (v: string) => {
    setDiscountPct(v);
    const pct = parseFloat(v) || 0;
    const pkr = (pct / 100) * total;
    setDiscountPKR(pkr.toFixed(2));
    setPaid(String(Math.max(0, total - pkr)));
  };

  useEffect(() => {
    setPaid(String(Math.max(0, total - (parseFloat(discountPKR) || 0))));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // ── validation ───────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!patient.firstName.trim()) errs.firstName = 'Required';
    if (!patient.lastName.trim()) errs.lastName = 'Required';
    if (!patient.gender) errs.gender = 'Required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    if (selectedTests.length === 0) { setSaveError('Add at least one test'); return; }
    setSaving(true); setSaveError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      let patientId = existingPatient?.id;

      if (!patientId) {
        const body: Record<string, unknown> = {
          firstName: patient.firstName.trim(),
          lastName: patient.lastName.trim(),
          gender: patient.gender,
        };
        if (patient.mobile.trim()) body.mobile = patient.mobile.trim();
        if (patient.dateOfBirth) body.dateOfBirth = patient.dateOfBirth;
        if (patient.age) body.ageYears = parseInt(patient.age, 10) || undefined;
        if (patient.cnic.trim()) body.cnic = patient.cnic.trim();
        if (patient.address.trim()) body.address = patient.address.trim();

        const { data: pt, error: ptErr } = await api.POST('/patients', { body: body as any });
        if (ptErr || !pt) { setSaveError((ptErr as any)?.message ?? 'Failed to create patient'); return; }
        patientId = (pt as any).id;
        setExistingPatient(pt);
      }

      const { data: enc, error: encErr } = await api.POST('/encounters', { body: { patientId } as any });
      if (encErr || !enc) { setSaveError('Failed to create encounter'); return; }
      const encounterId = (enc as any).id;
      const encounterCode = (enc as any).encounterCode ?? encounterId;

      for (const test of selectedTests) {
        // @ts-ignore
        await api.POST('/encounters/{encounterId}:order-lab', {
          params: { path: { encounterId } },
          body: { testId: test.id, priority: 'routine' } as any,
        });
      }

      // Generate receipt
      try {
        const receiptBody = {
          receiptNumber: encounterCode,
          patientName: `${patient.firstName} ${patient.lastName}`.trim(),
          patientMrn: existingPatient?.mrn ?? 'Auto',
          issuedAt: new Date().toISOString(),
          items: selectedTests.map(t => ({
            description: t.name,
            quantity: 1,
            unitPrice: t.price ?? 0,
            total: t.price ?? 0,
          })),
          subtotal: total,
          tax: 0,
          grandTotal: total,
          sourceRef: encounterId,
          sourceType: 'encounter',
        };
        // @ts-ignore
        await api.POST('/documents/receipt:generate', { body: receiptBody as any });
        setToast('Saved! Receipt queued for printing.');
      } catch {
        setToast('Saved! Receipt PDF coming soon.');
      }

      setSavedEncounterId(encounterId);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── reset ────────────────────────────────────────────────────────
  const handleReset = () => {
    setPatient(EMPTY_PATIENT);
    setExistingPatient(null);
    setFieldErrors({});
    setSelectedTests([]);
    setTestSearch('');
    setTestResults([]);
    setTestDropOpen(false);
    setDiscountPKR('0');
    setDiscountPct('0');
    setPaid('0');
    setSaveError('');
    setSavedEncounterId(null);
    setToast('');
  };

  // ── success state ────────────────────────────────────────────────
  if (savedEncounterId && toast) {
    return (
      <div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '28px', marginBottom: '24px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
          <h2 style={{ margin: '0 0 8px', color: '#15803d', fontSize: '20px' }}>Registration Complete</h2>
          <p style={{ margin: 0, color: '#166534' }}>{toast}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a href={`/lims/encounters/${savedEncounterId}`} style={{ padding: '10px 20px', background: '#2563eb', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
            View Encounter
          </a>
          <button onClick={handleReset} style={{ padding: '10px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#1e293b' }}>
            New Registration
          </button>
        </div>
      </div>
    );
  }

  const sectionCard: React.CSSProperties = { background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' };
  const sectionTitle: React.CSSProperties = { fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>New Registration</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Patient • Order • Payment</p>
      </div>

      {/* SECTION 1 — Patient Form */}
      <div style={{ ...sectionCard, marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={sectionTitle}>Patient Registration</p>
          {existingPatient && (
            <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: 600 }}>
              Existing Patient · MRN: {existingPatient.mrn}
            </span>
          )}
          {!existingPatient && patient.mobile && !mobileLooking && (
            <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: 600 }}>
              New Patient · MRN: Auto-generated
            </span>
          )}
        </div>

        {/* Mobile */}
        <div style={{ marginBottom: '16px', maxWidth: '280px' }}>
          <label style={label}>Mobile {mobileLooking && <span style={{ color: '#94a3b8' }}>· Looking up…</span>}</label>
          <input
            value={patient.mobile}
            onChange={e => setField('mobile', e.target.value)}
            onBlur={handleMobileBlur}
            placeholder="03XX-XXXXXXX"
            style={inp}
          />
        </div>

        {/* Name row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={label}>First Name *</label>
            <input value={patient.firstName} onChange={e => setField('firstName', e.target.value)} style={fieldErrors.firstName ? inpErr : inp} />
            {fieldErrors.firstName && <p style={{ color: '#ef4444', fontSize: '11px', margin: '2px 0 0' }}>{fieldErrors.firstName}</p>}
          </div>
          <div>
            <label style={label}>Last Name *</label>
            <input value={patient.lastName} onChange={e => setField('lastName', e.target.value)} style={fieldErrors.lastName ? inpErr : inp} />
            {fieldErrors.lastName && <p style={{ color: '#ef4444', fontSize: '11px', margin: '2px 0 0' }}>{fieldErrors.lastName}</p>}
          </div>
        </div>

        {/* Age + DOB + Gender */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={label}>Age</label>
            <input type="number" min="0" max="150" value={patient.age} onChange={e => handleAgeChange(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={label}>Date of Birth</label>
            <input type="date" value={patient.dateOfBirth} onChange={e => handleDobChange(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={label}>Gender *</label>
            <select value={patient.gender} onChange={e => setField('gender', e.target.value)} style={{ ...inp, background: 'white' }}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {fieldErrors.gender && <p style={{ color: '#ef4444', fontSize: '11px', margin: '2px 0 0' }}>{fieldErrors.gender}</p>}
          </div>
          <div>
            <label style={label}>CNIC</label>
            <input value={patient.cnic} onChange={e => setField('cnic', e.target.value)} placeholder="XXXXX-XXXXXXX-X" style={inp} />
          </div>
        </div>

        {/* Address */}
        <div>
          <label style={label}>Address</label>
          <textarea value={patient.address} onChange={e => setField('address', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
        </div>
      </div>

      {/* SECTIONS 2+3 — two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', marginBottom: '16px' }}>

        {/* SECTION 2 — Order */}
        <div style={sectionCard}>
          <p style={sectionTitle}>Order</p>

          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              value={testSearch}
              onChange={e => setTestSearch(e.target.value)}
              onKeyDown={handleTestKeyDown}
              onBlur={() => setTimeout(() => setTestDropOpen(false), 150)}
              onFocus={() => testResults.length > 0 && setTestDropOpen(true)}
              placeholder="Search test name or code…"
              style={inp}
            />
            {searching && (
              <span style={{ position: 'absolute', right: '10px', top: '9px', color: '#94a3b8', fontSize: '12px' }}>Searching…</span>
            )}

            {/* Dropdown */}
            {testDropOpen && testResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '220px', overflowY: 'auto' }}>
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
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{t.price != null ? `PKR ${t.price}` : 'PKR N/A'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected tests */}
          {selectedTests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '14px', border: '1px dashed #e2e8f0', borderRadius: '6px' }}>
              Search and add tests above
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
                    <span style={{ fontSize: '13px', color: '#64748b' }}>{t.price != null ? `PKR ${t.price}` : 'PKR N/A'}</span>
                    <button onClick={() => removeTest(t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3 — Payment */}
        <div style={sectionCard}>
          <p style={sectionTitle}>Payment</p>

          <div style={{ marginBottom: '12px' }}>
            <label style={label}>Total (PKR)</label>
            <div style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
              {total.toLocaleString()}
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={label}>Discount</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number" min="0" value={discountPKR}
                onChange={e => handleDiscountPKRChange(e.target.value)}
                placeholder="PKR" style={{ ...inp, flex: 2 }}
              />
              <input
                type="number" min="0" max="100" value={discountPct}
                onChange={e => handleDiscountPctChange(e.target.value)}
                placeholder="%" style={{ ...inp, flex: 1 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={label}>Paid (PKR)</label>
            <input
              type="number" min="0" value={paid}
              onChange={e => setPaid(e.target.value)}
              style={inp}
            />
          </div>

          <div style={{ padding: '10px 14px', background: due > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '6px', border: `1px solid ${due > 0 ? '#fecaca' : '#bbf7d0'}` }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Due (PKR)</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: due > 0 ? '#ef4444' : '#15803d' }}>
              {due.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      {saveError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '8px' }}>{saveError}</p>}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
