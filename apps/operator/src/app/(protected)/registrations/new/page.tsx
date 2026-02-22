'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

type Step = 1 | 2 | 3;

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
};

export default function NewRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1: Patient
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({ firstName: '', lastName: '', mrn: '', dateOfBirth: '', gender: 'male', phone: '' });
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [patientError, setPatientError] = useState('');

  // Step 2: Tests
  const [catalogTests, setCatalogTests] = useState<any[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());

  // Step 3: Confirm
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdEncounterId, setCreatedEncounterId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/patients', { params: { query: { search: search.trim(), limit: 10 } } });
      setSearchResults(Array.isArray(data) ? data : (data as any)?.data ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleCreatePatient = async () => {
    if (!newPatient.firstName || !newPatient.lastName || !newPatient.mrn) {
      setPatientError('First name, last name, and MRN are required');
      return;
    }
    setCreatingPatient(true);
    setPatientError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data, error } = await api.POST('/patients', { body: newPatient as any });
      if (error || !data) { setPatientError('Failed to create patient'); return; }
      setSelectedPatient(data);
      goToStep2(data);
    } catch {
      setPatientError('Failed to create patient');
    } finally {
      setCreatingPatient(false);
    }
  };

  const goToStep2 = async (patient: any) => {
    setSelectedPatient(patient);
    setStep(2);
    setLoadingTests(true);
    try {
      const api = getApiClient(getToken() ?? undefined);
      // @ts-ignore
      const { data } = await api.GET('/catalog/tests', { params: { query: { limit: 50 } } });
      setCatalogTests(Array.isArray(data) ? data : (data as any)?.data ?? []);
    } catch {
      setCatalogTests([]);
    } finally {
      setLoadingTests(false);
    }
  };

  const toggleTest = (testId: string) => {
    setSelectedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId); else next.add(testId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!selectedPatient || selectedTests.size === 0) return;
    setCreating(true);
    setCreateError('');
    try {
      const api = getApiClient(getToken() ?? undefined);
      // Create encounter
      const { data: enc, error: encErr } = await api.POST('/encounters', {
        body: { patientId: selectedPatient.id } as any,
      });
      if (encErr || !enc) { setCreateError('Failed to create encounter'); return; }
      const encounterId = (enc as any).id;
      // Order each test
      for (const testId of selectedTests) {
        // @ts-ignore
        await api.POST('/encounters/{encounterId}:order-lab', {
          params: { path: { encounterId } },
          body: { testId, priority: 'routine' } as any,
        });
      }
      setCreatedEncounterId(encounterId);
      setStep(3);
    } catch {
      setCreateError('Failed to create registration');
    } finally {
      setCreating(false);
    }
  };

  if (step === 3 && createdEncounterId) {
    const selectedTestList = catalogTests.filter(t => selectedTests.has(t.id));
    const patientName = `${selectedPatient?.firstName ?? ''} ${selectedPatient?.lastName ?? ''}`.trim();
    return (
      <div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 8px', color: '#15803d', fontSize: '20px' }}>✓ Registration Complete</h2>
          <p style={{ margin: 0, color: '#166534' }}>
            Encounter created for <strong>{patientName}</strong> with {selectedTestList.length} test(s) ordered.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link
            href={`/encounters/${createdEncounterId}`}
            style={{ padding: '10px 20px', background: '#2563eb', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
          >
            View Encounter
          </Link>
          <Link
            href={`/encounters/${createdEncounterId}/reports`}
            style={{ padding: '10px 20px', background: 'white', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}
          >
            Print Receipt
          </Link>
          <Link
            href="/worklist"
            style={{ padding: '10px 20px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}
          >
            Back to Worklist
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/worklist" style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none' }}>← Worklist</Link>
        <h1 style={{ margin: '8px 0 0', fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>New Registration</h1>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        {(['1. Select Patient', '2. Choose Tests', '3. Confirm'] as const).map((label, i) => (
          <div key={i} style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: step === i + 1 ? 600 : 400, background: step === i + 1 ? '#2563eb' : step > i + 1 ? '#d1fae5' : '#f1f5f9', color: step === i + 1 ? 'white' : step > i + 1 ? '#065f46' : '#64748b' }}>
            {label}
          </div>
        ))}
      </div>

      {/* Step 1: Patient Selection */}
      {step === 1 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Search Patient</h2>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name or MRN..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
              {searchResults.map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#1e293b' }}>{p.firstName} {p.lastName}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      MRN: {p.mrn ?? '—'} {p.dateOfBirth ? `• DOB: ${new Date(p.dateOfBirth).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => goToStep2(p)}
                    style={{ padding: '6px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
            <button
              onClick={() => setShowNewPatient(!showNewPatient)}
              style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '14px', fontWeight: 500, padding: 0 }}
            >
              {showNewPatient ? '▲ Hide' : '▼ Create New Patient'}
            </button>

            {showNewPatient && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>First Name *</label>
                    <input value={newPatient.firstName} onChange={e => setNewPatient(p => ({ ...p, firstName: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Last Name *</label>
                    <input value={newPatient.lastName} onChange={e => setNewPatient(p => ({ ...p, lastName: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>MRN *</label>
                    <input value={newPatient.mrn} onChange={e => setNewPatient(p => ({ ...p, mrn: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Date of Birth</label>
                    <input type="date" value={newPatient.dateOfBirth} onChange={e => setNewPatient(p => ({ ...p, dateOfBirth: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Gender</label>
                    <select value={newPatient.gender} onChange={e => setNewPatient(p => ({ ...p, gender: e.target.value }))} style={{ ...inputStyle, background: 'white' }}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Phone</label>
                    <input value={newPatient.phone} onChange={e => setNewPatient(p => ({ ...p, phone: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                {patientError && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 8px' }}>{patientError}</p>}
                <button
                  onClick={handleCreatePatient}
                  disabled={creatingPatient}
                  style={{ padding: '10px 24px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {creatingPatient ? 'Creating...' : 'Create Patient & Continue'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Test Selection */}
      {step === 2 && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>Patient: </span>
            <strong style={{ color: '#1e293b' }}>{selectedPatient?.firstName} {selectedPatient?.lastName}</strong>
            {selectedPatient?.mrn && <span style={{ fontSize: '13px', color: '#94a3b8', marginLeft: '8px' }}>MRN: {selectedPatient.mrn}</span>}
          </div>
          <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Select Tests</h2>
          {loadingTests ? (
            <p style={{ color: '#94a3b8' }}>Loading tests...</p>
          ) : catalogTests.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No tests available in catalog.</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
              {catalogTests.map((t: any) => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', border: `1px solid ${selectedTests.has(t.id) ? '#2563eb' : '#e2e8f0'}`, borderRadius: '6px', cursor: 'pointer', background: selectedTests.has(t.id) ? '#eff6ff' : 'white' }}>
                  <input
                    type="checkbox"
                    checked={selectedTests.has(t.id)}
                    onChange={() => toggleTest(t.id)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#1e293b' }}>{t.name}</div>
                    {t.code && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{t.code}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}
          {selectedTests.size > 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 16px', marginBottom: '16px' }}>
              <span style={{ color: '#166534', fontSize: '14px' }}>{selectedTests.size} test(s) selected</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setStep(1)} style={{ padding: '10px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedTests.size === 0}
              style={{ padding: '10px 24px', background: selectedTests.size === 0 ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: selectedTests.size === 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && !createdEncounterId && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Confirm Registration</h2>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Patient</div>
            <div style={{ fontWeight: 600, color: '#1e293b' }}>{selectedPatient?.firstName} {selectedPatient?.lastName}</div>
            {selectedPatient?.mrn && <div style={{ fontSize: '13px', color: '#94a3b8' }}>MRN: {selectedPatient.mrn}</div>}
          </div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Tests Ordered ({selectedTests.size})</div>
            {catalogTests.filter(t => selectedTests.has(t.id)).map(t => (
              <div key={t.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '4px', marginBottom: '4px', fontSize: '14px', color: '#1e293b' }}>
                {t.name}
              </div>
            ))}
          </div>
          {createError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{createError}</p>}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setStep(2)} style={{ padding: '10px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
              ← Back
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{ padding: '10px 24px', background: creating ? '#94a3b8' : '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: creating ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px' }}
            >
              {creating ? 'Creating...' : 'Create Encounter + Order Tests'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
