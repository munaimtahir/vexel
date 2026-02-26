'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { TenantScopeBanner } from '@/components/tenant-scope-banner';

const HEADER_LAYOUTS = [
  { value: 'default', label: 'Default — Logo left, name centered, address right' },
  { value: 'classic', label: 'Classic — Logo left, name + address right' },
  { value: 'minimal', label: 'Minimal — Text only, name + address centered' },
];

const FOOTER_LAYOUTS = [
  { value: 'text', label: 'Text only' },
  { value: 'image', label: 'Image only' },
  { value: 'both', label: 'Both — image above text' },
];

const RECEIPT_LAYOUTS = [
  { value: 'a4', label: 'A4 — Dual copy (patient + office) on one A4 sheet' },
  { value: 'thermal', label: 'Thermal — 80mm roll (coming soon)' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid hsl(var(--border))',
  borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box',
  background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px',
  color: 'hsl(var(--foreground))',
};
const hintStyle: React.CSSProperties = {
  fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginTop: '4px',
};
const sectionStyle: React.CSSProperties = {
  background: 'hsl(var(--card))', padding: '20px 24px', borderRadius: '8px',
  boxShadow: 'var(--shadow-sm)', marginBottom: '16px',
};
const sectionTitle: React.CSSProperties = {
  fontSize: '14px', fontWeight: 700, color: 'hsl(var(--foreground))',
  marginBottom: '16px', paddingBottom: '8px',
  borderBottom: '1px solid hsl(var(--border))',
};

function Field({ label, hint, value, onChange, placeholder, type = 'text' }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={labelStyle}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      ) : (
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={inputStyle}
        />
      )}
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

function Select({ label, hint, value, onChange, options }: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

export default function BrandingPage() {
  const searchParams = useSearchParams();
  const qTenantId = searchParams.get('tenantId');
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [cfg, setCfg] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key: string) => (val: string) => setCfg((c: any) => ({ ...c, [key]: val }));
  const get = (key: string, def = '') => cfg[key] ?? def;

  useEffect(() => {
    async function init() {
      const api = getApiClient(getToken() ?? undefined);
      const [meRes, tenantsRes] = await Promise.all([api.GET('/me'), api.GET('/tenants')]);
      const myTenantId = meRes.data?.tenantId ?? '';
      const all: any[] = (tenantsRes.data as any)?.data ?? [];
      setTenants(all);
      setTenantId(qTenantId ?? myTenantId ?? all[0]?.id ?? '');
    }
    init();
  }, [qTenantId]);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/tenants/{tenantId}/config' as any, { params: { path: { tenantId } } })
      .then(({ data }) => { setCfg(data ?? {}); setLoading(false); });
  }, [tenantId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    const api = getApiClient(getToken() ?? undefined);
    await api.PATCH('/tenants/{tenantId}/config' as any, { params: { path: { tenantId } }, body: cfg });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const selectedTenant = tenants.find(t => t.id === tenantId);

  return (
    <div style={{ maxWidth: '680px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}>
        Branding &amp; PDF Layout
      </h1>
      <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '20px' }}>
        Configure how your lab name, logo, and document layouts appear on printed receipts and lab reports.
      </p>

      {tenants.length > 1 && (
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>Tenant:</label>
          <select value={tenantId} onChange={e => setTenantId(e.target.value)} style={{ ...selectStyle, width: 'auto' }}>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      {selectedTenant && (
        <p style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginBottom: '16px' }}>
          Configuring: <strong>{selectedTenant.name}</strong>
        </p>
      )}
      <div style={{ marginBottom: '16px' }}>
        <TenantScopeBanner
          mode="explicit"
          pageLabel="Branding & Config"
          tenantId={tenantId}
          tenantName={selectedTenant?.name}
          note="This page reads and saves /tenants/{tenantId}/config for the selected tenant."
        />
      </div>

      {loading ? <p>Loading...</p> : (
        <form onSubmit={handleSave}>
          {/* ── General Branding ─────────────────────────────── */}
          <div style={sectionStyle}>
            <p style={sectionTitle}>🏥 General Branding</p>
            <Field label="Lab / Brand Name" value={get('brandName')} onChange={set('brandName')}
              placeholder="e.g. City Diagnostics Lab" />
            <Field label="Logo URL" value={get('logoUrl')} onChange={set('logoUrl')}
              placeholder="https://..." hint="Used in both lab report and receipt headers when logo layout is selected." />
            <Field label="Primary Color" value={get('primaryColor')} onChange={set('primaryColor')}
              placeholder="e.g. brand-primary-blue" hint="Used in the web app UI (not in PDFs)." />
            {get('primaryColor') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '12px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: get('primaryColor'), border: '1px solid hsl(var(--border))' }} />
                Preview: {get('primaryColor')}
              </div>
            )}
            <Field label="App Header Text" value={get('headerText')} onChange={set('headerText')}
              hint="Displayed in the web app header bar." />
            <Field label="App Footer Text" value={get('footerText')} onChange={set('footerText')}
              hint="Displayed in the web app footer." />
          </div>

          {/* ── Lab Report — Header ────────────────────────────── */}
          <div style={sectionStyle}>
            <p style={sectionTitle}>📋 Lab Report — Header</p>
            <Field label="Address / Contact Line" value={get('reportHeader')} onChange={set('reportHeader')}
              placeholder="123 Main St, Karachi | 021-111-2222"
              hint="Printed below the lab name in the report header." type="textarea" />
            <Select label="Header Layout"
              value={get('reportHeaderLayout', 'default')} onChange={set('reportHeaderLayout')}
              options={HEADER_LAYOUTS}
              hint="Controls how the logo, lab name, and address are arranged at the top of each page." />
          </div>

          {/* ── Lab Report — Footer ────────────────────────────── */}
          <div style={sectionStyle}>
            <p style={sectionTitle}>📋 Lab Report — Footer</p>
            <Field label="Footer Text" value={get('reportFooter')} onChange={set('reportFooter')}
              placeholder="Results are valid for 30 days. Verified by Pathologist."
              type="textarea"
              hint="Printed at the bottom of every report page." />
            <Field label="Footer Image URL" value={get('reportFooterImageUrl')} onChange={set('reportFooterImageUrl')}
              placeholder="https://... (stamp, signature, or logo image)"
              hint="Optional image shown in the footer (e.g. pathologist stamp)." />
            <Select label="Footer Layout"
              value={get('reportFooterLayout', 'text')} onChange={set('reportFooterLayout')}
              options={FOOTER_LAYOUTS}
              hint="Choose whether to show text, image, or both in the footer." />
          </div>

          {/* ── Receipt — Header ──────────────────────────────── */}
          <div style={sectionStyle}>
            <p style={sectionTitle}>🧾 Receipt — Header</p>
            <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '12px' }}>
              The receipt uses the same <strong>lab name</strong>, <strong>logo</strong>, and <strong>address</strong> as the lab report.
              Choose a layout style below.
            </p>
            <Select label="Receipt Header Layout"
              value={get('receiptHeaderLayout', 'default')} onChange={set('receiptHeaderLayout')}
              options={HEADER_LAYOUTS}
              hint="Controls how branding appears at the top of each receipt copy." />
          </div>

          {/* ── Receipt — Footer ──────────────────────────────── */}
          <div style={sectionStyle}>
            <p style={sectionTitle}>🧾 Receipt — Footer</p>
            <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginBottom: '12px' }}>
              The receipt uses the same <strong>footer text</strong> and <strong>footer image</strong> as the lab report.
              Set the content in the Lab Report footer section above, then choose the layout here.
            </p>
            <Select label="Receipt Footer Layout"
              value={get('receiptFooterLayout', 'text')} onChange={set('receiptFooterLayout')}
              options={FOOTER_LAYOUTS}
              hint="Choose whether to show text, image, or both in the receipt footer." />
            <Select label="Receipt Paper Format"
              value={get('receiptLayout', 'a4')} onChange={set('receiptLayout')}
              options={RECEIPT_LAYOUTS}
              hint="A4 prints two copies (patient + office) on one sheet, separated by a cut line." />
          </div>

          {/* ── Save ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <button type="submit" disabled={saving}
              style={{ padding: '10px 24px', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && <span style={{ color: 'hsl(var(--status-success-fg))', fontSize: '14px' }}>✓ Saved successfully</span>}
          </div>
        </form>
      )}
    </div>
  );
}
