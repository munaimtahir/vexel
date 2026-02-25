'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export default function BrandingPage() {
  const searchParams = useSearchParams();
  const qTenantId = searchParams.get('tenantId');

  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function init() {
      const api = getApiClient(getToken() ?? undefined);
      const [meRes, tenantsRes] = await Promise.all([api.GET('/me'), api.GET('/tenants')]);
      const myTenantId = meRes.data?.tenantId ?? '';
      const all: any[] = tenantsRes.data?.data ?? [];
      setTenants(all);
      const target = qTenantId ?? myTenantId ?? all[0]?.id ?? '';
      setTenantId(target);
    }
    init();
  }, [qTenantId]);

  useEffect(() => {
    if (!tenantId) return;
    async function loadConfig() {
      setLoading(true);
      const api = getApiClient(getToken() ?? undefined);
      const { data } = await api.GET('/tenants/{tenantId}/config' as any, { params: { path: { tenantId } } });
      setConfig(data ?? {});
      setLoading(false);
    }
    loadConfig();
  }, [tenantId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    const api = getApiClient(getToken() ?? undefined);
    await api.PATCH('/tenants/{tenantId}/config' as any, { params: { path: { tenantId } }, body: config });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const fields = [
    { key: 'brandName', label: 'Brand Name' },
    { key: 'logoUrl', label: 'Logo URL' },
    { key: 'primaryColor', label: 'Primary Color (hex)', placeholder: 'hsl(var(--primary))' },
    { key: 'reportHeader', label: 'Report Header' },
    { key: 'reportFooter', label: 'Report Footer' },
    { key: 'headerText', label: 'App Header Text' },
    { key: 'footerText', label: 'App Footer Text' },
  ];

  const selectedTenant = tenants.find((t) => t.id === tenantId);

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'hsl(var(--foreground))' }}>Branding &amp; Config</h1>

      {/* Tenant selector */}
      {tenants.length > 1 && (
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Tenant:</label>
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', background: 'hsl(var(--card))' }}>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {selectedTenant && (
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '8px' }}>Configuring: <strong>{selectedTenant.name}</strong></p>
      )}
      <p style={{ color: 'hsl(var(--primary))', fontSize: '13px', marginBottom: '24px', background: 'hsl(var(--status-info-bg))', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid hsl(var(--primary))' }}>
        ℹ️ <strong>brandName</strong>, <strong>logoUrl</strong>, <strong>reportHeader</strong>, and <strong>reportFooter</strong> are injected into all generated PDF documents.
      </p>

      {loading ? <p>Loading...</p> : (
        <div style={{ background: 'hsl(var(--card))', padding: '24px', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', maxWidth: '600px' }}>
          <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
            {fields.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'hsl(var(--foreground))' }}>{label}</label>
                <input
                  value={config[key] ?? ''}
                  onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {config.primaryColor && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: config.primaryColor, border: '1px solid hsl(var(--border))' }} />
                Preview: {config.primaryColor}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && <span style={{ color: 'hsl(var(--status-success-fg))', fontSize: '14px' }}>✓ Saved</span>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
