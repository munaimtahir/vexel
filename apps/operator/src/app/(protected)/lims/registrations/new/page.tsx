'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { PageHeader, SectionCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PatientData = { fullName: string; dateOfBirth: string; gender: string; cnic: string; address: string };
type CatalogTestSearchItem = {
  id: string;
  name: string;
  testCode?: string | null;
  userCode?: string | null;
  sampleTypeName?: string | null;
  departmentName?: string | null;
  price?: number | null;
};
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
  const [testResults, setTestResults] = useState<CatalogTestSearchItem[]>([]);
  const [topTests, setTopTests] = useState<CatalogTestSearchItem[]>([]);
  const [loadingTopTests, setLoadingTopTests] = useState(false);
  const [testDropOpen, setTestDropOpen] = useState(false);
  const [testDropIdx, setTestDropIdx] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestSeqRef = useRef(0);

  // Payment
  const [discountPKR, setDiscountPKR] = useState('0');
  const [discountPct, setDiscountPct] = useState('0');
  const [paid, setPaid] = useState('0');

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedEncounterId, setSavedEncounterId] = useState<string | null>(null);
  const [receiptDocId, setReceiptDocId] = useState<string | null>(null);
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
  const registerBtnRef = useRef<HTMLButtonElement>(null);
  const [patientRegisteredMsg, setPatientRegisteredMsg] = useState('');

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
    setTimeout(() => testSearchRef.current?.focus(), 50);
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
  const getTestCodeSubtitle = (t: CatalogTestSearchItem | SelectedTest) => {
    if ('code' in t) return t.code;
    const parts = [t.userCode, t.testCode].filter(Boolean);
    return parts.join(' • ');
  };

  const loadTopTests = useCallback(async () => {
    setLoadingTopTests(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/operator/catalog/tests/top');
      const list = Array.isArray(data) ? (data as CatalogTestSearchItem[]) : [];
      setTopTests(list);
    } catch {
      setTopTests([]);
    } finally {
      setLoadingTopTests(false);
    }
  }, []);

  const doTestSearch = useCallback(async (q: string) => {
    const query = q.trim();
    if (query.length < 2) {
      searchRequestSeqRef.current += 1;
      setSearching(false);
      setTestResults([]);
      setTestDropOpen(false);
      setTestDropIdx(-1);
      return;
    }

    const requestId = ++searchRequestSeqRef.current;
    setSearching(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/operator/catalog/tests/search', { params: { query: { q: query, limit: 20 } } });
      if (requestId !== searchRequestSeqRef.current) return;
      const list: CatalogTestSearchItem[] = Array.isArray(data) ? data : [];
      setTestResults(list);
      setTestDropOpen(list.length > 0);
      setTestDropIdx(list.length > 0 ? 0 : -1);
    } catch {
      if (requestId !== searchRequestSeqRef.current) return;
      setTestResults([]);
      setTestDropOpen(false);
      setTestDropIdx(-1);
    } finally {
      if (requestId === searchRequestSeqRef.current) setSearching(false);
    }
  }, []);

  // Focus mobile field on mount
  useEffect(() => {
    mob1Ref.current?.focus();
    loadTopTests();
  }, [loadTopTests]);

  useEffect(() => {
    searchTimerRef.current = setTimeout(() => doTestSearch(testSearch), 250);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [testSearch, doTestSearch]);

  const addTest = (t: CatalogTestSearchItem) => {
    if (selectedTests.some(x => x.id === t.id)) return;
    const normalizedPrice = t.price == null ? null : Number(t.price);
    setSelectedTests(prev => [...prev, {
      id: t.id,
      name: t.name,
      code: getTestCodeSubtitle(t),
      price: Number.isFinite(normalizedPrice) ? normalizedPrice : null,
    }]);
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
    setSaving(true); setSaveError(''); setPatientRegisteredMsg('');
    try {
      const api = getApiClient(getToken() ?? undefined);
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

      if (existingPatient) {
        // Update existing patient with any changed fields
        // @ts-ignore
        await api.PATCH('/patients/{patientId}', { params: { path: { patientId: existingPatient.id } }, body: body as any });
        setRegisteredMRN(existingPatient.mrn);
        setPatientRegisteredMsg('✓ Patient record updated');
      } else {
        const { data: pt, error: ptErr } = await api.POST('/patients', { body: body as any });
        if (ptErr || !pt) { setSaveError((ptErr as any)?.message ?? 'Registration failed'); return; }
        setExistingPatient(pt);
        setRegisteredMRN((pt as any).mrn);
        setPatientRegisteredMsg(`✓ Patient registered — MRN: ${(pt as any).mrn}`);
      }
      setTimeout(() => testSearchRef.current?.focus(), 100);
      setTimeout(() => setPatientRegisteredMsg(''), 4000);
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

      const discountPctNum = parseFloat(discountPct) || 0;
      for (let ti = 0; ti < selectedTests.length; ti++) {
        const test = selectedTests[ti];
        // @ts-ignore
        await api.POST('/encounters/{encounterId}:order-lab', {
          params: { path: { encounterId } },
          body: {
            testId: test.id,
            priority: 'routine',
            ...(ti === 0 ? {
              totalAmount: total,
              discountAmount: discPKRNum,
              discountPct: discountPctNum,
              payableAmount: total - discPKRNum,
              amountPaid: paidNum,
              dueAmount: Math.max(0, (total - discPKRNum) - paidNum),
            } : {}),
          } as any,
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

      // Poll for receipt PDF in background with exponential backoff
      // Stops as soon as status is RENDERED or PUBLISHED (receipts auto-publish after render)
      setPollingReceipt(true);
      (async () => {
        const delays = [500, 1000, 2000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000];
        for (let i = 0; i < delays.length; i++) {
          await new Promise(r => setTimeout(r, delays[i]));
          try {
            const { data: docs } = await api.GET('/documents' as any, { params: { query: { sourceRef: encounterId, docType: 'RECEIPT', limit: 1 } } });
            // API returns a plain array
            const items: any[] = Array.isArray(docs) ? docs : ((docs as any)?.items ?? (docs as any)?.data ?? []);
            const ready = items.find((d: any) => d.status === 'PUBLISHED' || d.status === 'RENDERED');
            if (ready) { setReceiptDocId(ready.id); break; }
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
    setSaveError(''); setSavedEncounterId(null); setReceiptDocId(null); setPollingReceipt(false);
    setTimeout(() => mob1Ref.current?.focus(), 50);
  };

  // ── Success Banner ────────────────────────────────────────────────
  if (savedEncounterId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-5xl mb-6">✅</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Registration &amp; Order Saved</h2>
        {registeredMRN && (
          <p className="text-muted-foreground mb-1">
            MRN: <strong className="text-foreground">{registeredMRN}</strong>
          </p>
        )}
        <div className="my-4 min-h-[40px]">
          {pollingReceipt && !receiptDocId && (
            <p className="text-muted-foreground text-sm">⏳ Generating receipt…</p>
          )}
          {receiptDocId && (
            <a
              href={`/lims/print/${receiptDocId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(handleReset, 100)}
              className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-semibold text-sm no-underline hover:bg-primary/90"
            >
              🖨 Print / Download Receipt
            </a>
          )}
          {!pollingReceipt && !receiptDocId && (
            <p className="text-muted-foreground text-xs">Receipt not ready — check reports later.</p>
          )}
        </div>
        <div className="flex gap-3 justify-center flex-wrap mt-4">
          <Button onClick={() => router.push(`/lims/encounters/${savedEncounterId}`)}>
            Open Encounter →
          </Button>
          <Button variant="outline" className="bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" onClick={handleReset}>
            + New Patient
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Patient Picker Modal ─────────────────────────────────── */}
      {pickerPatients.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            ref={pickerRef}
            tabIndex={-1}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setPickerIdx(i => Math.min(i + 1, pickerPatients.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setPickerIdx(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); selectPickerPatient(pickerPatients[pickerIdx]); }
              else if (e.key === 'Escape') { e.preventDefault(); closePickerNew(); }
            }}
            className="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col outline-none"
          >
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-border bg-muted/40 flex justify-between items-center">
              <div>
                <div className="font-bold text-sm text-foreground">
                  {pickerPatients.length} patient{pickerPatients.length > 1 ? 's' : ''} found for <span className="font-mono">{mobileValue}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">↑↓ navigate · Enter select · Esc = new patient</div>
              </div>
              <button onClick={closePickerNew} className="bg-transparent border-none text-xl cursor-pointer text-muted-foreground leading-none hover:text-foreground">×</button>
            </div>

            {/* Patient list */}
            <div className="max-h-[340px] overflow-y-auto">
              {pickerPatients.map((p, i) => {
                const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—';
                const age = p.dateOfBirth ? ageFromDob(p.dateOfBirth) : p.ageYears != null ? String(p.ageYears) : null;
                return (
                  <div
                    key={p.id}
                    onClick={() => selectPickerPatient(p)}
                    className={cn(
                      'px-5 py-3.5 cursor-pointer border-b border-border flex justify-between items-center border-l-[3px]',
                      i === pickerIdx ? 'bg-muted border-l-blue-600' : 'bg-background border-l-transparent hover:bg-muted/30'
                    )}
                    onMouseEnter={() => setPickerIdx(i)}
                  >
                    <div>
                      <div className="font-semibold text-sm text-foreground">{name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        MRN: <strong>{p.mrn ?? '—'}</strong>
                        {age && ` · ${age}y`}
                        {p.gender && ` · ${p.gender.charAt(0).toUpperCase()}`}
                        {p.cnic && ` · CNIC: ${p.cnic}`}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted rounded px-2 py-0.5">Select</span>
                  </div>
                );
              })}
            </div>

            {/* New registration option */}
            <div className="px-5 py-3.5 border-t border-border bg-muted/20 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Not listed? Register a new patient for this number.</span>
              <Button size="sm" onClick={closePickerNew}>+ New Registration</Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <PageHeader title="New Registration" description="Patient · Order · Payment" />

      {/* SECTION 1 — Patient */}
      <SectionCard className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-0 uppercase tracking-wide">Patient Registration</h3>
          {registeredMRN && (
            <Badge variant="outline" className="bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))] border-[hsl(var(--status-success-border))]">
              MRN: {registeredMRN}
            </Badge>
          )}
          {!registeredMRN && lookupDone && pickerPatients.length === 0 && !mobileLooking && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
              New Patient · MRN: Auto-generated
            </Badge>
          )}
          {mobileLooking && (
            <span className="text-muted-foreground text-xs">Looking up…</span>
          )}
        </div>

        {/* Mobile — two subfields with visual dash */}
        <div className="mb-4 max-w-[300px]">
          <Label className="block text-xs font-medium text-muted-foreground mb-1">Mobile</Label>
          <div className="flex items-center">
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
              className="w-[72px] px-2.5 py-2 border border-input rounded-l-md border-r-0 text-sm bg-background outline-none focus:ring-1 focus:ring-ring text-center tracking-widest"
            />
            <span className="px-1.5 py-2 bg-muted border border-input border-l-0 border-r-0 text-muted-foreground text-base leading-none select-none">-</span>
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
              className="flex-1 px-2.5 py-2 border border-input rounded-r-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring tracking-wider"
            />
          </div>
        </div>

        {/* Full Name */}
        <div className="mb-3">
          <Label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</Label>
          <input
            ref={fullNameRef}
            value={patient.fullName}
            onChange={e => setField('fullName', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(ageRef); } }}
            placeholder="e.g. Ali Hassan"
            className={cn(
              'w-full px-2.5 py-2 border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring',
              fieldErrors.fullName ? 'border-destructive focus:ring-destructive' : 'border-input'
            )}
          />
          {fieldErrors.fullName && <p className="text-destructive text-xs mt-0.5">{fieldErrors.fullName}</p>}
        </div>

        {/* Age + DOB + Gender + CNIC */}
        <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-3 mb-3">
          <div>
            <Label className="block text-xs font-medium text-muted-foreground mb-1">Age (yrs)</Label>
            <input
              ref={ageRef}
              type="number" min="0" max="150"
              value={displayAge}
              onChange={e => handleAgeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(dobRef); } }}
              placeholder="yrs"
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <Label className="block text-xs font-medium text-muted-foreground mb-1">Date of Birth</Label>
            <input
              ref={dobRef}
              type="date"
              value={patient.dateOfBirth}
              onChange={e => setField('dateOfBirth', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); genderRef.current?.focus(); } }}
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <Label className="block text-xs font-medium text-muted-foreground mb-1">Gender *</Label>
            <select
              ref={genderRef}
              value={patient.gender}
              onChange={e => setField('gender', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(cnicRef); } }}
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-background outline-none"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {fieldErrors.gender && <p className="text-destructive text-xs mt-0.5">{fieldErrors.gender}</p>}
          </div>
          <div>
            <Label className="block text-xs font-medium text-muted-foreground mb-1">CNIC</Label>
            <input
              ref={cnicRef}
              value={patient.cnic}
              onChange={e => setField('cnic', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addressRef.current?.focus(); } }}
              placeholder="XXXXX-XXXXXXX-X"
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Address */}
        <div className="mb-4">
          <Label className="block text-xs font-medium text-muted-foreground mb-1">Address</Label>
          <textarea
            ref={addressRef}
            value={patient.address}
            onChange={e => setField('address', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); registerBtnRef.current?.focus(); } }}
            rows={2}
            placeholder="Press Enter to go to Register Patient, Shift+Enter for new line"
            className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </div>

        {/* Register Patient button */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            ref={registerBtnRef}
            onClick={handleRegisterPatient}
            disabled={saving}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRegisterPatient(); } }}
          >
            {saving ? 'Registering…' : '👤 Register Patient'}
          </Button>
          {registeredMRN && !patientRegisteredMsg && (
            <span className="text-sm text-[hsl(var(--status-success-fg))] font-semibold">
              ✓ Registered — MRN: {registeredMRN}
            </span>
          )}
          {patientRegisteredMsg && (
            <span className="text-sm text-[hsl(var(--status-success-fg))] font-semibold animate-pulse">
              {patientRegisteredMsg}
            </span>
          )}
        </div>
      </SectionCard>

      {/* SECTION 2+3 — Order + Payment */}
      <div className="grid grid-cols-[1fr_340px] gap-4 mb-4">

        {/* SECTION 2 — Order */}
        <SectionCard>
          <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Order Tests</h3>
          <div className="relative mb-3">
            <input
              ref={testSearchRef}
              value={testSearch}
              onChange={e => {
                setTestSearch(e.target.value);
                setTestDropIdx(-1);
              }}
              onKeyDown={handleTestKeyDown}
              onBlur={() => setTimeout(() => setTestDropOpen(false), 150)}
              onFocus={() => testResults.length > 0 && setTestDropOpen(true)}
              placeholder="Type at least 2 chars (name, test code, or user code)"
              className={cn(
                'w-full px-2.5 py-2 border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring',
                fieldErrors.tests ? 'border-destructive focus:ring-destructive' : 'border-input'
              )}
            />
            {searching && <span className="absolute right-2.5 top-2 text-muted-foreground text-xs">Searching…</span>}
            {testDropOpen && testResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-background border border-input rounded-md shadow-md z-[100] max-h-[240px] overflow-y-auto">
                {testResults.map((t, i) => (
                  <div
                    key={t.id}
                    onMouseDown={() => addTest(t)}
                    className={cn(
                      'px-3.5 py-2.5 cursor-pointer border-b border-border flex justify-between items-center',
                      i === testDropIdx ? 'bg-muted' : 'bg-background hover:bg-muted/30'
                    )}
                    >
                      <div>
                        <div className="font-medium text-sm text-foreground">{t.name}</div>
                      {getTestCodeSubtitle(t) && <div className="text-xs text-muted-foreground">{getTestCodeSubtitle(t)}</div>}
                      {(t.sampleTypeName || t.departmentName) && (
                        <div className="text-[11px] text-muted-foreground/90">
                          {[t.sampleTypeName, t.departmentName].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{t.price != null ? `PKR ${t.price}` : 'N/A'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {testSearch.trim().length < 2 && (
            <div className="mb-3 rounded-md border border-input bg-muted/20 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top tests</div>
              {loadingTopTests ? (
                <div className="text-xs text-muted-foreground">Loading top tests…</div>
              ) : topTests.length === 0 ? (
                <div className="text-xs text-muted-foreground">No pinned tests configured for this tenant.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topTests.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => addTest(t)}
                      className="rounded-md border border-input bg-background px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                    >
                      <div className="font-semibold">{t.name}</div>
                      {getTestCodeSubtitle(t) && <div className="text-muted-foreground">{getTestCodeSubtitle(t)}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {fieldErrors.tests && <p className="text-destructive text-xs -mt-2 mb-2">{fieldErrors.tests}</p>}

          {selectedTests.length === 0 ? (
            <div className="text-center py-7 px-4 text-muted-foreground text-sm border border-dashed border-input rounded-md">
              Search and add tests · Press <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">Enter</kbd> to add, <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">Tab</kbd> for payment
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {selectedTests.map(t => (
                <div key={t.id} className="flex justify-between items-center px-3.5 py-2.5 bg-muted/30 rounded-md border border-border">
                  <div>
                    <div className="font-medium text-sm text-foreground">{t.name}</div>
                    {t.code && <div className="text-xs text-muted-foreground">{t.code}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{t.price != null ? `PKR ${t.price}` : 'N/A'}</span>
                    <button onClick={() => removeTest(t.id)} className="bg-transparent border-none text-destructive cursor-pointer text-lg leading-none px-1 hover:opacity-70">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* SECTION 3 — Payment */}
        <SectionCard>
          <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Payment</h3>
          <div className="mb-3">
            <Label className="block text-xs font-medium text-muted-foreground mb-1">Total (PKR)</Label>
            <div className="px-2.5 py-2 bg-muted/40 border border-input rounded-md text-[15px] font-bold text-foreground">
              {total.toLocaleString()}
            </div>
          </div>
          <div className="mb-3">
            <Label className="block text-xs font-medium text-muted-foreground mb-1">Discount</Label>
            <div className="flex gap-2">
              <input
                ref={discountRef}
                type="number" min="0" value={discountPKR}
                onChange={e => handleDiscountPKRChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(paidRef); } }}
                placeholder="PKR"
                className="flex-[2] px-2.5 py-2 border border-input rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="number" min="0" max="100" value={discountPct}
                onChange={e => handleDiscountPctChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusAndSelect(paidRef); } }}
                placeholder="%"
                className="flex-1 px-2.5 py-2 border border-input rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="mb-3">
            <Label className="block text-xs font-medium text-muted-foreground mb-1">Paid (PKR)</Label>
            <input
              ref={paidRef}
              type="number" min="0" value={paid}
              onChange={e => setPaid(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
              className="w-full px-2.5 py-2 border border-input rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className={cn('px-3.5 py-2.5 rounded-md border', due > 0 ? 'bg-[hsl(var(--status-destructive-bg))] border-[hsl(var(--status-destructive-border))]' : 'bg-[hsl(var(--status-success-bg))] border-[hsl(var(--status-success-border))]')}>
            <div className="text-xs text-muted-foreground">Due (PKR)</div>
            <div className={cn('text-2xl font-bold', due > 0 ? 'text-destructive' : 'text-[hsl(var(--status-success-fg))]')}>{due.toLocaleString()}</div>
          </div>
        </SectionCard>
      </div>

      {/* Action bar */}
      {saveError && <p className="text-destructive text-sm mb-2">{saveError}</p>}
      <div className="flex gap-3 justify-end items-center">
        <Button variant="outline" onClick={handleReset}>Reset</Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {saving ? 'Saving…' : '💾 Save & Print Receipt'}
        </Button>
      </div>
    </div>
  );
}
