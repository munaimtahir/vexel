'use client';
import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function BrandingPage() {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tenantId, setTenantId] = useState('system');

  useEffect(() => {
    async function load() {
      const api = getApiClient(getToken() ?? undefined);
      const meRes = await api.GET('/me');
      const tid = meRes.data?.tenantId ?? 'system';
      setTenantId(tid);
      // @ts-ignore - dynamic tenant path pending in openapi contract
      const { data } = await api.GET(`/tenants/${tid}/config` as any);
      setConfig(data ?? {});
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    const api = getApiClient(getToken() ?? undefined);
    // @ts-ignore - dynamic tenant path pending in openapi contract
    await api.PATCH(`/tenants/${tenantId}/config` as any, { body: config });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <p>Loading...</p>;

  const fields = [
    { key: 'brandName', label: 'Brand Name', placeholder: undefined },
    { key: 'logoUrl', label: 'Logo URL', placeholder: undefined },
    { key: 'primaryColor', label: 'Primary Color (hex)', placeholder: '#3b82f6' },
    { key: 'reportHeader', label: 'Report Header', placeholder: undefined },
    { key: 'reportFooter', label: 'Report Footer', placeholder: undefined },
    { key: 'headerText', label: 'App Header Text', placeholder: undefined },
    { key: 'footerText', label: 'App Footer Text', placeholder: undefined },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>Branding &amp; Config</h1>
      <p style={{ color: '#64748b', marginBottom: '8px' }}>Customize the look and report headers for this tenant.</p>
      <p style={{ color: '#3b82f6', fontSize: '13px', marginBottom: '24px', background: '#eff6ff', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
        ℹ️ <strong>brandName</strong>, <strong>logoUrl</strong>, <strong>reportHeader</strong>, and <strong>reportFooter</strong> are injected into all generated PDF documents (receipts and lab reports).
      </p>
      <div style={{ background: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: '600px' }}>
        <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>{label}</label>
              <input
                value={config[key] ?? ''}
                onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                placeholder={placeholder}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && <span style={{ color: '#22c55e', fontSize: '14px' }}>✓ Saved</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
