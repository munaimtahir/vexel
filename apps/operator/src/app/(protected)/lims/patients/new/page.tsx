'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function NewPatientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    mrn: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const api = getApiClient(getToken() ?? undefined);
      const body: Record<string, string> = {
        firstName: form.firstName,
        lastName: form.lastName,
        mrn: form.mrn,
      };
      if (form.dateOfBirth) body.dateOfBirth = form.dateOfBirth;
      if (form.gender) body.gender = form.gender;
      if (form.phone) body.phone = form.phone;

      const { data, error: apiError, response } = await api.POST('/patients', { body: body as any });

      if (response?.status === 409) {
        setError('MRN already exists for this tenant');
        return;
      }
      if (apiError || !data) {
        setError('Failed to create patient');
        return;
      }
      router.push('/lims/patients');
    } catch {
      setError('Failed to create patient');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
    background: 'white',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '6px',
    color: '#374151',
  };
  const fieldStyle: React.CSSProperties = { marginBottom: '20px' };

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>New Patient</h2>
        <p style={{ color: '#64748b', margin: '4px 0 0' }}>Register a new patient record</p>
      </div>

      <div style={{ background: 'white', padding: '32px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={fieldStyle}>
              <label htmlFor="firstName" style={labelStyle}>First Name *</label>
              <input id="firstName" name="firstName" required value={form.firstName} onChange={handleChange} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label htmlFor="lastName" style={labelStyle}>Last Name *</label>
              <input id="lastName" name="lastName" required value={form.lastName} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={fieldStyle}>
            <label htmlFor="mrn" style={labelStyle}>MRN *</label>
            <input id="mrn" name="mrn" required value={form.mrn} onChange={handleChange} style={inputStyle} placeholder="e.g. MRN-001" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={fieldStyle}>
              <label htmlFor="dateOfBirth" style={labelStyle}>Date of Birth</label>
              <input id="dateOfBirth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label htmlFor="gender" style={labelStyle}>Gender</label>
              <select id="gender" name="gender" value={form.gender} onChange={handleChange} style={inputStyle}>
                <option value="">Select...</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div style={fieldStyle}>
            <label htmlFor="phone" style={labelStyle}>Phone</label>
            <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} style={inputStyle} />
          </div>

          {error && <p style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{ flex: 1, padding: '10px', background: loading ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Creating...' : 'Create Patient'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              style={{ padding: '10px 20px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
